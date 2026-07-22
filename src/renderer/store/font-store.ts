import { create } from 'zustand'
import {
  DEFAULT_FONT,
  FONT_STEP,
  ZOOM_STEP,
  clampTerminalFontSize,
  clampEditorFontSize,
  clampZoom,
  type FontState
} from '@core/workspace/font'

/**
 * Renderer view of the three text-size knobs (see `@core/workspace/font`). Every
 * setter clamps through the pure helpers, so a corrupt persisted value or a
 * button held at the limit can never push the UI out of the legible range. The
 * TerminalPane / ViewerPane subscribe to the relevant field and apply it live;
 * App applies `uiZoom` to the app root and persists all three via workspace-sync.
 */
export interface FontUiState extends FontState {
  setTerminalFontSize: (size: number) => void
  setEditorFontSize: (size: number) => void
  setZoom: (zoom: number) => void
  /** Nudge the terminal font: +1 bigger, -1 smaller, 0 reset to default. */
  adjustTerminalFontSize: (dir: 1 | -1 | 0) => void
  /** Nudge the editor font by one step (+1 bigger, -1 smaller). */
  adjustEditorFontSize: (dir: 1 | -1) => void
  /** Zoom the whole window: +1 in, -1 out, 0 reset to 100%. */
  adjustZoom: (dir: 1 | -1 | 0) => void
  /** Replace all three from a restored workspace (re-clamped defensively). */
  restore: (font: FontState) => void
}

export const useFontStore = create<FontUiState>((set) => ({
  ...DEFAULT_FONT,
  setTerminalFontSize: (size) => set({ terminalFontSize: clampTerminalFontSize(size) }),
  setEditorFontSize: (size) => set({ editorFontSize: clampEditorFontSize(size) }),
  setZoom: (zoom) => set({ uiZoom: clampZoom(zoom) }),
  adjustTerminalFontSize: (dir) =>
    set((s) =>
      dir === 0
        ? { terminalFontSize: DEFAULT_FONT.terminalFontSize }
        : { terminalFontSize: clampTerminalFontSize(s.terminalFontSize + dir * FONT_STEP) }
    ),
  adjustEditorFontSize: (dir) =>
    set((s) => ({ editorFontSize: clampEditorFontSize(s.editorFontSize + dir * FONT_STEP) })),
  adjustZoom: (dir) =>
    set((s) =>
      dir === 0 ? { uiZoom: DEFAULT_FONT.uiZoom } : { uiZoom: clampZoom(s.uiZoom + dir * ZOOM_STEP) }
    ),
  restore: (font) =>
    set({
      terminalFontSize: clampTerminalFontSize(font.terminalFontSize),
      editorFontSize: clampEditorFontSize(font.editorFontSize),
      uiZoom: clampZoom(font.uiZoom)
    })
}))
