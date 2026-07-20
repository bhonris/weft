/**
 * Pure state + helpers for user-adjustable text sizing. Three independent knobs:
 *
 *   - `terminalFontSize` — xterm cell font size (px).
 *   - `editorFontSize`   — Monaco viewer/diff font size (px).
 *   - `uiZoom`           — a whole-window zoom factor applied on top of the two
 *                          font sizes (VS Code-style Ctrl+= / Ctrl+- / Ctrl+0).
 *
 * DOM-free and framework-free: the renderer maps `terminalFontSize`/`editorFontSize`
 * onto the live editors and `uiZoom` onto the app root. Every value is clamped on
 * the way in so a corrupt or hand-edited persisted blob can never produce an
 * unreadable (or invisible) UI — mirrors the `clampDockSize` precedent.
 */
export interface FontState {
  /** xterm terminal font size, px. */
  terminalFontSize: number
  /** Monaco viewer/diff font size, px. */
  editorFontSize: number
  /** Whole-window zoom factor (1 = 100%). */
  uiZoom: number
}

export const DEFAULT_FONT: FontState = {
  // 15px reads comfortably out of the box (13 was too small); editor stays 14
  // and the whole-window zoom starts at 100%.
  terminalFontSize: 15,
  editorFontSize: 14,
  uiZoom: 1
}

/** Inclusive bounds — kept generous but always legible. */
const TERMINAL_MIN = 8
const TERMINAL_MAX = 32
const EDITOR_MIN = 8
const EDITOR_MAX = 40
const ZOOM_MIN = 0.5
const ZOOM_MAX = 3

/** Step per +/- for the font-size status-bar buttons (px). */
export const FONT_STEP = 1
/** Step per Ctrl+= / Ctrl+- press for the whole-window zoom. */
export const ZOOM_STEP = 0.1

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function clampTerminalFontSize(size: number): number {
  return clampInt(size, TERMINAL_MIN, TERMINAL_MAX, DEFAULT_FONT.terminalFontSize)
}

export function clampEditorFontSize(size: number): number {
  return clampInt(size, EDITOR_MIN, EDITOR_MAX, DEFAULT_FONT.editorFontSize)
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return DEFAULT_FONT.uiZoom
  // Round to whole percent so repeated ±0.1 steps never accumulate float drift.
  const rounded = Math.round(zoom * 100) / 100
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, rounded))
}
