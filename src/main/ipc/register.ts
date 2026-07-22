import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { CH } from '@shared/ipc/channels'
import type { CreateSessionOpts } from '@shared/ipc/api-contract'
import type { PtyManager } from '../services/pty-manager'

/** The webContents-like sender carried on every IPC event. */
export interface IpcSenderLike {
  readonly id: number
  send(channel: string, payload: unknown): void
  /** Electron webContents exposes this; fakes may omit it. */
  isDestroyed?(): boolean
}

export interface IpcEventLike {
  readonly sender: IpcSenderLike
}

/** The ipcMain surface we depend on — satisfied by electron's ipcMain and by a fake. */
export interface IpcMainLike {
  handle(channel: string, listener: (event: IpcEventLike, ...args: unknown[]) => unknown): void
  on(channel: string, listener: (event: IpcEventLike, ...args: unknown[]) => void): void
}

export interface RegisterDeps {
  ipcMain: IpcMainLike
  pty: PtyManager
  /** Opens an OS directory picker; resolves to the chosen path or null. */
  pickDirectory: () => Promise<string | null>
  /** Injectable for deterministic tests. */
  generateId?: () => string
  /** Extra environment for spawned sessions (defaults to process.env). */
  baseEnv?: NodeJS.ProcessEnv
  /** Default shell when command is 'shell'. */
  shellPath?: string
  /** Command used by openProject (default 'claude'; tests may use 'shell'). */
  defaultCommand?: 'claude' | 'shell'
  /** Path/name of the claude binary (default 'claude'; E2E injects a broken one). */
  claudePath?: string
  /** Called after a session is explicitly closed (e.g. to forget its status). */
  onSessionClosed?: (tabId: string) => void
  /**
   * True when a resumable conversation transcript exists on disk for this
   * session id. Used to decide whether `--resume` will actually work: a pinned
   * id that was never used has no transcript, so resuming it would fail with
   * "No conversation found" and open a dead tab. When omitted, resume is
   * attempted unconditionally (the pre-check is opt-in, wired in the container).
   */
  transcriptExists?: (sessionId: string) => boolean
  /** Open a torn-off window hosting `tabId` (spec §4.2). */
  openTearOff?: (tabId: string, title: string) => void
  /** Status-reporting hook injection (spec §4.4). */
  hooks?: {
    /** Named-pipe/UDS path the forwarder writes to (set as WEFT_STATUS_ENDPOINT). */
    endpoint: string
    /** Inline JSON for `claude --settings` registering the reporting hooks. */
    settingsJson: string
  }
}

/** Build the child-process env, dropping undefined values and tagging the tab. */
function buildEnv(
  base: NodeJS.ProcessEnv,
  tabId: string,
  statusEndpoint?: string
): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined) env[key] = value
  }
  env['CLAUDE_IDE_TAB'] = tabId
  if (statusEndpoint !== undefined) env['WEFT_STATUS_ENDPOINT'] = statusEndpoint
  return env
}

/**
 * Wire the session-lifecycle IPC channels to the PtyManager. Attaching a
 * renderer view forwards live PTY output to that specific sender and returns the
 * replay snapshot; detaching leaves the PTY running (spec §4.7).
 */
export function registerSessionIpc(deps: RegisterDeps): void {
  const { ipcMain, pty } = deps
  const genId = deps.generateId ?? (() => randomUUID())
  const baseEnv = deps.baseEnv ?? process.env
  const shellPath =
    deps.shellPath ?? (process.platform === 'win32' ? 'powershell.exe' : 'bash')

  // Track live attachments per (sender, tab) so detach removes exactly one.
  const attachments = new Map<string, { detach: () => void }>()
  const key = (senderId: number, tabId: string): string => `${senderId}:${tabId}`

  function createSession(opts: CreateSessionOpts): { tabId: string; sessionId: string } {
    const tabId = genId()
    const isClaude = opts.command === 'claude'
    // Resuming CONTINUES the prior conversation under its original id, so we
    // reuse that id rather than pinning a fresh one. This keeps hook correlation
    // deterministic (claude emits hooks under the same id we already know) and,
    // crucially, avoids combining our own --session-id with --resume: the CLI
    // rejects that pairing unless --fork-session is set, and --session-id (pin
    // this id) + --fork-session (generate a NEW id) are contradictory.
    //
    // Only resume when a transcript for that id actually exists — a pinned id
    // that was never used has no conversation, so `--resume` would fail with
    // "No conversation found" and open a dead tab. In that case fall back to a
    // fresh session so the tab still opens working.
    const resuming =
      isClaude &&
      !!opts.resumeSessionId &&
      (deps.transcriptExists?.(opts.resumeSessionId) ?? true)
    const sessionId = resuming ? opts.resumeSessionId! : genId()
    const file = isClaude ? (deps.claudePath ?? 'claude') : shellPath
    const hookArgs =
      isClaude && deps.hooks ? ['--settings', deps.hooks.settingsJson] : []
    const idArgs = resuming
      ? ['--resume', opts.resumeSessionId!]
      : isClaude
        ? ['--session-id', sessionId]
        : []
    const args = isClaude
      ? [...idArgs, ...hookArgs, ...(opts.args ?? [])]
      : opts.args ?? []
    pty.create({
      tabId,
      sessionId,
      file,
      args,
      cwd: opts.cwd,
      command: opts.command,
      env: buildEnv(baseEnv, tabId, deps.hooks?.endpoint)
    })
    return { tabId, sessionId }
  }

  // ── Boundary validation: the renderer is semi-trusted; malformed IPC args
  // must be dropped, never allowed to throw inside main (spec §security).
  const isValidCreateOpts = (o: unknown): o is CreateSessionOpts => {
    if (o === null || typeof o !== 'object') return false
    const opts = o as Record<string, unknown>
    if (typeof opts['cwd'] !== 'string' || opts['cwd'].length === 0) return false
    if (opts['command'] !== 'claude' && opts['command'] !== 'shell') return false
    if (opts['args'] !== undefined) {
      if (!Array.isArray(opts['args'])) return false
      if (!(opts['args'] as unknown[]).every((a) => typeof a === 'string')) return false
    }
    if (opts['resumeSessionId'] !== undefined) {
      // Conversation ids are UUID-shaped; anything else is dropped (it would
      // otherwise flow into claude's argv). The leading character must be
      // alphanumeric so a flag-shaped string ("--dangerously-…") can never
      // masquerade as an id.
      if (
        typeof opts['resumeSessionId'] !== 'string' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9-]{7,63}$/.test(opts['resumeSessionId'])
      ) {
        return false
      }
    }
    return true
  }
  const isValidSize = (n: unknown): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n > 0 && n < 10_000

  ipcMain.handle(CH.createSession, (_event, opts) => {
    if (!isValidCreateOpts(opts)) throw new Error('invalid createSession options')
    const { tabId, sessionId } = createSession(opts)
    return { tabId, sessionId }
  })

  ipcMain.handle(CH.listSessions, () => pty.listSessions())

  ipcMain.on(CH.writeToSession, (_event, tabId, data) => {
    if (typeof tabId !== 'string' || typeof data !== 'string') return
    if (pty.has(tabId)) pty.write(tabId, data)
  })

  ipcMain.on(CH.resizeSession, (_event, tabId, cols, rows) => {
    if (typeof tabId !== 'string' || !isValidSize(cols) || !isValidSize(rows)) return
    if (pty.has(tabId)) pty.resize(tabId, cols, rows)
  })

  ipcMain.handle(CH.closeSession, (_event, tabId) => {
    pty.close(tabId as string)
    deps.onSessionClosed?.(tabId as string)
  })

  ipcMain.handle(CH.attachSession, (event, tabId) => {
    const id = tabId as string
    const sender = event.sender
    const attachmentKey = key(sender.id, id)

    // A window can be destroyed without unmounting (tear-off close, crash).
    // Sending to a dead webContents throws INSIDE the PTY data callback and
    // would take down main — so every forward is guarded and a dead sender
    // detaches itself automatically.
    const dropAttachment = (): void => {
      attachments.get(attachmentKey)?.detach()
      attachments.delete(attachmentKey)
    }
    const safeSend = (channel: string, payload: unknown): void => {
      if (sender.isDestroyed?.()) return dropAttachment()
      try {
        sender.send(channel, payload)
      } catch {
        dropAttachment()
      }
    }

    // Re-attach for the same (sender, tab) — e.g. a reload that never ran
    // React cleanup — must not leak the previous listeners.
    attachments.get(attachmentKey)?.detach()

    const handle = pty.attach(
      id,
      (data) => safeSend(CH.sessionData, { tabId: id, data }),
      ({ exitCode }) => safeSend(CH.sessionExit, { tabId: id, exitCode })
    )
    attachments.set(attachmentKey, handle)
    return { snapshot: handle.snapshot, exited: handle.exited, exitCode: handle.exitCode }
  })

  ipcMain.handle(CH.detachSession, (event, tabId) => {
    const k = key(event.sender.id, tabId as string)
    const handle = attachments.get(k)
    if (handle) {
      handle.detach()
      attachments.delete(k)
    }
  })

  ipcMain.handle(CH.moveTabToWindow, (_event, tabId, target, meta) => {
    if (target !== 'new') return // v1: tear-off only; re-dock is close-driven.
    if (!pty.has(tabId as string)) return
    const title = ((meta as { title?: string } | undefined)?.title ?? 'session').toString()
    deps.openTearOff?.(tabId as string, title)
  })

  ipcMain.handle(CH.openProject, async (_event, commandOverride) => {
    const dir = await deps.pickDirectory()
    if (!dir) return null
    const command =
      commandOverride === 'shell' || commandOverride === 'claude'
        ? commandOverride
        : (deps.defaultCommand ?? 'claude')
    const title = basename(dir) || dir
    try {
      const { tabId, sessionId } = createSession({ cwd: dir, command })
      return { tabId, sessionId, cwd: dir, title, command }
    } catch (e) {
      // Actionable failure (e.g. `claude` not on PATH) — never crash the app.
      const error = e instanceof Error ? e.message : String(e)
      return { error, cwd: dir, title, command }
    }
  })
}
