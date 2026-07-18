import type { StatusChange } from './status-server'

export interface ToastRequest {
  title: string
  body: string
  tabId: string
  onClick: () => void
}

export interface NotificationDeps {
  /** User's on/off switch — read per event so a toggle needs no restart. */
  isEnabled: () => boolean
  /** True when any Weft window currently has OS focus. */
  isAppFocused: () => boolean
  /** Raise an OS toast (Electron Notification in production). */
  showToast: (toast: ToastRequest) => void
  /** Focus the window hosting the tab and activate it. */
  focusTab: (tabId: string) => void
  /** Human label for the tab (project name). */
  getTitle: (tabId: string) => string | undefined
  /** Injectable clock for the per-tab cooldown (defaults to Date.now). */
  now?: () => number
  /** Minimum ms between toasts for the same tab (spam guard; default 10s). */
  cooldownMs?: number
}

/**
 * App-owned notification policy (spec §2, §4.4.7): when a session enters
 * `waiting` or `done` while the app is unfocused, raise a toast whose click
 * focuses the correct window and activates the tab. Silent when focused —
 * the badge is already visible. Pure decision logic; OS I/O is injected.
 */
export class NotificationService {
  private readonly lastToastAt = new Map<string, number>()

  constructor(private readonly deps: NotificationDeps) {}

  handleStatus(change: StatusChange): void {
    // Muted by the user: suppress before the cooldown check so muting never
    // consumes a per-tab cooldown slot.
    if (!this.deps.isEnabled()) return
    if (change.status !== 'waiting' && change.status !== 'done') return
    if (this.deps.isAppFocused()) return

    // Spam guard: alternating hook events must not flood the action center.
    const now = (this.deps.now ?? Date.now)()
    const last = this.lastToastAt.get(change.tabId)
    const cooldown = this.deps.cooldownMs ?? 10_000
    if (last !== undefined && now - last < cooldown) return
    this.lastToastAt.set(change.tabId, now)

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
