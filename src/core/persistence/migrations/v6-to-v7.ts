import { DEFAULT_FONT } from '@core/workspace/font'

/**
 * v6 → v7: adds user-adjustable text sizing (`terminalFontSize`, `editorFontSize`,
 * `uiZoom`), defaulting to the historical hard-coded sizes so an upgraded
 * workspace looks identical until the user changes anything. Other fields pass
 * through untouched.
 */
export function v6ToV7(blob: Record<string, unknown>): Record<string, unknown> {
  return {
    ...blob,
    version: 7,
    terminalFontSize: DEFAULT_FONT.terminalFontSize,
    editorFontSize: DEFAULT_FONT.editorFontSize,
    uiZoom: DEFAULT_FONT.uiZoom
  }
}
