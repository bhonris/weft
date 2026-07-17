/**
 * Containment check for write access: the renderer may only save files inside
 * an open project root. Pure string logic (separators normalized, case-folded
 * to match Windows semantics, no fs access) — the caller passes RESOLVED
 * absolute paths.
 */
function normalize(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

export function isPathInside(root: string, candidate: string): boolean {
  const r = normalize(root)
  const c = normalize(candidate)
  if (r.length === 0) return false
  return c === r || c.startsWith(`${r}/`)
}

export function isInsideAnyRoot(roots: readonly string[], candidate: string): boolean {
  return roots.some((root) => isPathInside(root, candidate))
}
