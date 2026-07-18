/**
 * v2 → v3: adds `notificationsEnabled` (OS toasts for unfocused waiting/done
 * sessions). Defaults to `true` so existing users keep the current behavior —
 * notifications were always on before this switch existed. Other fields pass
 * through untouched.
 */
export function v2ToV3(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 3, notificationsEnabled: true }
}
