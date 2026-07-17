export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Minimum visible overlap for a restored window to count as reachable. */
const MIN_VISIBLE = 60

function intersects(a: Rect, b: Rect): boolean {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return overlapX >= MIN_VISIBLE && overlapY >= MIN_VISIBLE
}

/**
 * Validate restored window bounds against the current displays. A monitor
 * that was unplugged since last run must not leave the window stranded
 * off-screen — return undefined so the caller falls back to defaults.
 * Pure: display work areas are injected.
 */
export function clampBoundsToDisplays(
  bounds: Rect | undefined,
  displays: readonly Rect[]
): Rect | undefined {
  if (!bounds) return undefined
  const finite =
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height)
  if (!finite || bounds.width < 200 || bounds.height < 120) return undefined
  return displays.some((d) => intersects(bounds, d)) ? bounds : undefined
}
