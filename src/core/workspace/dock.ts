/**
 * Pure state + helpers for the always-present CLI dock pane. The dock can sit at
 * the bottom (default), right, or left of the editor area, and its size is a
 * ratio of the in-project area. DOM-free; the renderer maps this to fl?/grid.
 */
export type DockPosition = 'bottom' | 'right' | 'left'

export interface DockState {
  position: DockPosition
  /** Fraction (0..1) of the in-project area the CLI pane occupies. */
  size: number
}

export const DEFAULT_DOCK: DockState = { position: 'bottom', size: 0.4 }

/** Keep the dock a sensible fraction so neither pane can be dragged away. */
const MIN_SIZE = 0.15
const MAX_SIZE = 0.85

export function clampDockSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_DOCK.size
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, size))
}

export function setDockPosition(state: DockState, position: DockPosition): DockState {
  return { ...state, position }
}

export function setDockSize(state: DockState, size: number): DockState {
  return { ...state, size: clampDockSize(size) }
}

/** Cycle the dock edge: bottom → right → left → bottom. */
const DOCK_ORDER: DockPosition[] = ['bottom', 'right', 'left']
export function nextDockPosition(position: DockPosition): DockPosition {
  const i = DOCK_ORDER.indexOf(position)
  return DOCK_ORDER[(i + 1) % DOCK_ORDER.length]!
}

/** Default keyboard resize step (fraction of the area per arrow press). */
export const DOCK_RESIZE_STEP = 0.02

// The arrow key that GROWS the CLI dock for each edge — chosen so the divider
// moves in the direction of the arrow, matching what a mouse drag does:
//   bottom → the divider is horizontal; ArrowUp moves it up, growing the CLI below.
//   right  → the divider is vertical;  ArrowLeft moves it left, growing the CLI on the right.
//   left   → the divider is vertical;  ArrowRight moves it right, growing the CLI on the left.
const GROW_KEY: Record<DockPosition, string> = {
  bottom: 'ArrowUp',
  right: 'ArrowLeft',
  left: 'ArrowRight'
}
const SHRINK_KEY: Record<DockPosition, string> = {
  bottom: 'ArrowDown',
  right: 'ArrowRight',
  left: 'ArrowLeft'
}

/**
 * The signed size delta for an arrow key given the dock edge, so keyboard resize
 * moves the divider the SAME way a mouse drag would (grow = divider toward the
 * editor). Returns 0 for keys off the dock's resize axis. Fixes the prior
 * bug where a single Up/Left→shrink mapping was correct only for the left dock
 * and inverted for the bottom (default) and right docks.
 */
export function dockResizeDelta(
  position: DockPosition,
  key: string,
  step: number = DOCK_RESIZE_STEP
): number {
  if (key === GROW_KEY[position]) return step
  if (key === SHRINK_KEY[position]) return -step
  return 0
}
