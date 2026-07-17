import type { HookPayload } from '@shared/status/hook-events'

/** The subset of a tab's identity used to route incoming hook payloads. */
export interface TabRef {
  tabId: string
  sessionId: string
  cwd: string
}

/**
 * Resolve which tab a hook payload belongs to, in priority order:
 *   1. `session_id` (primary, pinned via `claude --session-id`)
 *   2. `tabId` (redundant, from the `CLAUDE_IDE_TAB` env var)
 *   3. `cwd` (last-resort, only when exactly one tab matches)
 *
 * Returns the resolved `tabId`, or `null` when nothing matches (the caller then
 * drops and logs the payload rather than mutating an unrelated tab).
 */
export function correlate(payload: HookPayload, tabs: readonly TabRef[]): string | null {
  if (payload.session_id !== undefined) {
    const bySession = tabs.find((t) => t.sessionId === payload.session_id)
    if (bySession) return bySession.tabId
  }

  if (payload.tabId !== undefined) {
    const byTab = tabs.find((t) => t.tabId === payload.tabId)
    if (byTab) return byTab.tabId
  }

  if (payload.cwd !== undefined) {
    const byCwd = tabs.filter((t) => t.cwd === payload.cwd)
    // Only trust cwd when it is unambiguous.
    if (byCwd.length === 1) return byCwd[0]!.tabId
  }

  return null
}
