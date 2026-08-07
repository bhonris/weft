import type { StatusChange } from './status-server'

export interface AutoMaximizeDeps {
  /** User's on/off switch — read per event so a toggle needs no restart. */
  isEnabled: () => boolean
  /** True when any Weft window currently has OS focus. */
  isAppFocused: () => boolean
  /** Restore (if minimized) and maximize the main window. */
  restoreAndMaximize: () => void
}

/**
 * App-owned attention policy, sibling to NotificationService: when a session
 * enters `waiting` or `done` while the app is unfocused, pull the main window
 * back into view. Default OFF (see workspace default) — unlike the toast,
 * this yanks the window, so it's opt-in. Pure decision logic; the actual
 * window calls are injected.
 */
export class AutoMaximizeService {
  constructor(private readonly deps: AutoMaximizeDeps) {}

  handleStatus(change: StatusChange): void {
    if (!this.deps.isEnabled()) return
    if (change.status !== 'waiting' && change.status !== 'done') return
    if (this.deps.isAppFocused()) return
    this.deps.restoreAndMaximize()
  }
}
