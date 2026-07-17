import { OutputRingBuffer } from '@core/terminal/output-ring-buffer'
import { Throttle, type ThrottleDeps } from '@core/terminal/resize-throttle'

/** Real-timer throttle deps for production (the pure core injects these). */
export const realThrottleDeps: ThrottleDeps = {
  now: () => Date.now(),
  setTimer: (cb, ms) => setTimeout(cb, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>)
}

/** The minimal PTY surface Weft needs — satisfied by node-pty, and by a fake in tests. */
export interface IPtyProcess {
  readonly pid: number
  onData(cb: (data: string) => void): void
  onExit(cb: (e: { exitCode: number }) => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
}

export interface PtySpawnOptions {
  file: string
  args: string[]
  cwd: string
  env: Record<string, string>
  cols: number
  rows: number
}

/** Injected so unit tests never need the native node-pty module. */
export interface PtyFactory {
  spawn(opts: PtySpawnOptions): IPtyProcess
}

export interface CreateSpec {
  tabId: string
  sessionId: string
  file: string
  args?: string[]
  cwd: string
  /** The logical command kind ('claude' | 'shell') — carried for re-dock/persist. */
  command?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export interface PtyManagerOptions {
  maxBufferChars?: number
  resizeIntervalMs?: number
  throttleDeps?: ThrottleDeps
}

type DataListener = (data: string) => void
type ExitListener = (e: { exitCode: number }) => void

/** A handle returned by {@link PtyManager.attach}: the replay snapshot + a detach fn. */
export interface AttachHandle {
  snapshot: string
  /** True when the process already exited — the view should render it as dead. */
  exited: boolean
  exitCode: number | null
  detach: () => void
}

interface Session {
  tabId: string
  sessionId: string
  cwd: string
  command: string
  proc: IPtyProcess
  buffer: OutputRingBuffer
  dataListeners: Set<DataListener>
  exitListeners: Set<ExitListener>
  resizeThrottle: Throttle<[number, number]>
  exited: boolean
  exitCode: number | null
}

/**
 * Owns every live PTY. The renderer is a detachable *view*: `attach` replays the
 * ring buffer and subscribes to live output; `detach` unsubscribes but leaves the
 * process running. A PTY is killed ONLY by {@link close} (explicit tab close) or
 * by the process exiting — NEVER by a renderer reload/HMR/crash (spec §4.7).
 */
export class PtyManager {
  private readonly sessions = new Map<string, Session>()

  constructor(
    private readonly factory: PtyFactory,
    private readonly options: PtyManagerOptions = {}
  ) {}

  create(spec: CreateSpec): { tabId: string; pid: number } {
    if (this.sessions.has(spec.tabId)) {
      throw new Error(`tab ${spec.tabId} already has a session`)
    }
    const proc = this.factory.spawn({
      file: spec.file,
      args: spec.args ?? [],
      cwd: spec.cwd,
      env: spec.env ?? {},
      cols: spec.cols ?? 80,
      rows: spec.rows ?? 24
    })
    const session: Session = {
      tabId: spec.tabId,
      sessionId: spec.sessionId,
      cwd: spec.cwd,
      command: spec.command ?? 'shell',
      proc,
      buffer: new OutputRingBuffer(this.options.maxBufferChars),
      dataListeners: new Set(),
      exitListeners: new Set(),
      resizeThrottle: new Throttle<[number, number]>(
        (cols, rows) => {
          // The trailing call runs inside a timer — a dead PTY here would be
          // an uncatchable throw, so guard and swallow.
          if (session.exited) return
          try {
            proc.resize(cols, rows)
          } catch {
            /* PTY died between the check and the call — ignore. */
          }
        },
        this.options.resizeIntervalMs ?? 50,
        this.options.throttleDeps ?? realThrottleDeps
      ),
      exited: false,
      exitCode: null
    }
    proc.onData((data) => {
      session.buffer.push(data)
      for (const listener of session.dataListeners) listener(data)
    })
    proc.onExit((e) => {
      session.exited = true
      session.exitCode = e.exitCode
      for (const listener of session.exitListeners) listener(e)
    })
    this.sessions.set(spec.tabId, session)
    return { tabId: spec.tabId, pid: proc.pid }
  }

  write(tabId: string, data: string): void {
    const session = this.require(tabId)
    if (session.exited) return // typing into a dead terminal is a no-op
    session.proc.write(data)
  }

  resize(tabId: string, cols: number, rows: number): void {
    const session = this.require(tabId)
    if (session.exited) return
    session.resizeThrottle.call(cols, rows)
  }

  /** Explicitly terminate and deregister a session (tab close). */
  close(tabId: string): void {
    const session = this.sessions.get(tabId)
    if (!session) return
    session.resizeThrottle.dispose()
    session.proc.kill()
    session.dataListeners.clear()
    session.exitListeners.clear()
    this.sessions.delete(tabId)
  }

  /**
   * Attach a view to a live session: returns the buffered output to replay, and
   * subscribes `onData`/`onExit` to the live stream. Attaching NEVER respawns the
   * PTY (the PID is unchanged), so a renderer reload re-attaches to the same
   * process. `detach` removes exactly the listeners this call added.
   */
  attach(tabId: string, onData: DataListener, onExit?: ExitListener): AttachHandle {
    const session = this.require(tabId)
    session.dataListeners.add(onData)
    if (onExit) session.exitListeners.add(onExit)
    return {
      snapshot: session.buffer.snapshot(),
      exited: session.exited,
      exitCode: session.exitCode,
      detach: () => {
        session.dataListeners.delete(onData)
        if (onExit) session.exitListeners.delete(onExit)
      }
    }
  }

  /** Live sessions for renderer reconciliation after a reload. */
  listSessions(): Array<{ tabId: string; cwd: string; command: string; exited: boolean }> {
    return [...this.sessions.values()].map((s) => ({
      tabId: s.tabId,
      cwd: s.cwd,
      command: s.command,
      exited: s.exited
    }))
  }

  has(tabId: string): boolean {
    return this.sessions.has(tabId)
  }

  pidOf(tabId: string): number | undefined {
    return this.sessions.get(tabId)?.proc.pid
  }

  snapshot(tabId: string): string {
    return this.require(tabId).buffer.snapshot()
  }

  dataListenerCount(tabId: string): number {
    return this.require(tabId).dataListeners.size
  }

  isExited(tabId: string): boolean {
    return this.require(tabId).exited
  }

  tabIds(): string[] {
    return [...this.sessions.keys()]
  }

  /** Identity snapshot used to correlate incoming hook payloads to tabs. */
  tabRefs(): Array<{ tabId: string; sessionId: string; cwd: string; command: string }> {
    return [...this.sessions.values()].map((s) => ({
      tabId: s.tabId,
      sessionId: s.sessionId,
      cwd: s.cwd,
      command: s.command
    }))
  }

  private require(tabId: string): Session {
    const session = this.sessions.get(tabId)
    if (!session) throw new Error(`no session for tab ${tabId}`)
    return session
  }
}
