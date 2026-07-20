/**
 * v5 → v6: adds `activePanel` (which sidebar activity-bar panel is showing).
 * Defaults to the file explorer; other fields pass through untouched.
 */
export function v5ToV6(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 6, activePanel: 'explorer' }
}
