/**
 * Pure region-cycling logic for keyboard focus navigation (Ctrl+F6 /
 * Ctrl+Shift+F6). DOM-free: the renderer owns the actual `.focus()` calls and
 * decides which regions are present; this just computes the next region to move
 * to, honoring the canonical order and skipping absent regions.
 */
export type RegionId = 'tabs' | 'explorer' | 'terminal' | 'viewer' | 'status'

/** Canonical left-to-right / top-to-bottom focus order. */
export const REGION_ORDER: readonly RegionId[] = ['tabs', 'explorer', 'terminal', 'viewer', 'status']

/**
 * The next present region after `current` in direction `dir` (+1 forward, -1
 * back), wrapping. `present` is the set of currently-focusable regions; order is
 * taken from REGION_ORDER regardless of `present`'s order. Returns null if no
 * region is present. If `current` is null or absent, starts from the first
 * (dir +1) or last (dir -1) present region.
 */
export function nextRegion(
  present: readonly RegionId[],
  current: RegionId | null,
  dir: 1 | -1
): RegionId | null {
  const ordered = REGION_ORDER.filter((r) => present.includes(r))
  if (ordered.length === 0) return null

  const i = current === null ? -1 : ordered.indexOf(current)
  if (i === -1) return dir === 1 ? ordered[0]! : ordered[ordered.length - 1]!

  const next = (i + dir + ordered.length) % ordered.length
  return ordered[next]!
}
