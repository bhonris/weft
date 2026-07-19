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
