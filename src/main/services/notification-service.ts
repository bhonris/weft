import type { StatusChange } from './status-server'

export interface ToastRequest {
  title: string
  body: string
  tabId: string
  onClick: () => void
}

export interface NotificationDeps {
  /** True when any Weft window currently has OS focus. */
  isAppFocused: () => boolean
  /** Raise an OS toast (Electron Notification in production). */
  showToast: (toast: ToastRequest) => void
  /** Focus the window hosting the tab and activate it. */
  focusTab: (tabId: string) => void
  /** Human label for the tab (project name). */
  getTitle: (tabId: string) => string | undefined
}

/**
 * App-owned notification policy (spec §2, §4.4.7): when a session enters
 * `waiting` or `done` while the app is unfocused, raise a toast whose click
 * focuses the correct window and activates the tab. Silent when focused —
 * the badge is already visible. Pure decision logic; OS I/O is injected.
 */
export class NotificationService {
  constructor(private readonly deps: NotificationDeps) {}

  handleStatus(change: StatusChange): void {
    if (change.status !== 'waiting' && change.status !== 'done') return
    if (this.deps.isAppFocused()) return

    const project = this.deps.getTitle(change.tabId) ?? 'Weft session'
    const needsYou = change.status === 'waiting'
    this.deps.showToast({
      title: needsYou ? `${project} — needs you` : `${project} — done`,
      body: needsYou ? (change.message ?? 'Claude is waiting on your input') : 'The session finished',
      tabId: change.tabId,
      onClick: () => this.deps.focusTab(change.tabId)
    })
  }
}
