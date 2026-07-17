import { FrameParser } from '@core/pipe/frame-parser'
import { correlate, type TabRef } from '@core/status/session-correlator'
import { mapHookToStatus } from '@core/status/status-mapper'
import type { HookPayload, SessionStatus } from '@shared/status/hook-events'

/** One connected hook client (a socket). */
export interface SocketLike {
  onData(cb: (chunk: string) => void): void
  onEnd(cb: () => void): void
}

/** The server transport — a named pipe / UDS listener; injectable for tests. */
export interface StatusTransport {
  listen(path: string, onConnection: (socket: SocketLike) => void): Promise<void>
  close(): Promise<void>
}

export interface StatusChange {
  tabId: string
  status: SessionStatus
  message?: string
}

export interface StatusServerDeps {
  transport: StatusTransport
  endpointPath: string
  /** Snapshot of live tabs for correlation. */
  getTabs: () => TabRef[]
  onStatus: (change: StatusChange) => void
  onDrop?: (reason: string, payload?: Record<string, unknown>) => void
}

/**
 * Receives forwarded Claude Code hook payloads over the local endpoint and
 * turns them into per-tab status changes: bytes → FrameParser → correlate →
 * mapHookToStatus → onStatus. Unknown/malformed payloads are dropped + logged;
 * they never mutate any tab (spec §4.4).
 */
export class StatusServer {
  private readonly statuses = new Map<string, SessionStatus>()

  constructor(private readonly deps: StatusServerDeps) {}

  async start(): Promise<void> {
    await this.deps.transport.listen(this.deps.endpointPath, (socket) => {
      const parser = new FrameParser(
        (frame) => this.handle(frame),
        (line) => this.deps.onDrop?.(`malformed line: ${line.slice(0, 200)}`)
      )
      socket.onData((chunk) => parser.push(chunk))
      socket.onEnd(() => parser.end())
    })
  }

  async stop(): Promise<void> {
    await this.deps.transport.close()
  }

  /** Current status for a tab ('unknown' until a hook has reported). */
  statusOf(tabId: string): SessionStatus {
    return this.statuses.get(tabId) ?? 'unknown'
  }

  /** A tab was closed — forget its status. */
  forget(tabId: string): void {
    this.statuses.delete(tabId)
  }

  private handle(frame: Record<string, unknown>): void {
    const payload = frame as unknown as HookPayload
    if (typeof payload.event !== 'string') {
      this.deps.onDrop?.('missing event field', frame)
      return
    }
    const tabId = correlate(payload, this.deps.getTabs())
    if (tabId === null) {
      this.deps.onDrop?.('no matching tab', frame)
      return
    }
    const prev = this.statuses.get(tabId) ?? 'unknown'
    const update = mapHookToStatus(payload, prev)
    if (update.status === null || update.status === prev) return
    this.statuses.set(tabId, update.status)
    const change: StatusChange = { tabId, status: update.status }
    if (update.message !== undefined) change.message = update.message
    this.deps.onStatus(change)
  }
}
