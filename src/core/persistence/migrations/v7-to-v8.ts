/**
 * v7 → v8: adds `autoMaximizeEnabled` (auto-restore + maximize the window on
 * unfocused waiting/done, sibling to `notificationsEnabled`). Defaults to
 * `false` — unlike notifications, this yanks the window into view, so it's
 * opt-in rather than preserving prior always-on behavior. Other fields pass
 * through untouched.
 */
export function v7ToV8(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 8, autoMaximizeEnabled: false }
}
