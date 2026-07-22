import { describe, it, expect, beforeEach } from 'vitest'
import { useFontStore } from './font-store'
import { DEFAULT_FONT } from '@core/workspace/font'

const reset = (): void =>
  useFontStore.setState({ ...DEFAULT_FONT }, false)

describe('useFontStore', () => {
  beforeEach(reset)

  it('starts at the shared defaults', () => {
    const s = useFontStore.getState()
    expect(s.terminalFontSize).toBe(15)
    expect(s.editorFontSize).toBe(14)
    expect(s.uiZoom).toBe(1)
  })

  it('setters clamp out-of-range values', () => {
    const s = useFontStore.getState()
    s.setTerminalFontSize(1000)
    s.setEditorFontSize(1)
    s.setZoom(99)
    const after = useFontStore.getState()
    expect(after.terminalFontSize).toBe(32)
    expect(after.editorFontSize).toBe(8)
    expect(after.uiZoom).toBe(3)
  })

  it('adjusts the terminal font by one step and stops at the ceiling', () => {
    const s = useFontStore.getState()
    s.adjustTerminalFontSize(1)
    expect(useFontStore.getState().terminalFontSize).toBe(16)
    useFontStore.getState().setTerminalFontSize(32)
    useFontStore.getState().adjustTerminalFontSize(1)
    expect(useFontStore.getState().terminalFontSize).toBe(32)
  })

  it('resets the terminal font to the default on dir 0', () => {
    useFontStore.getState().setTerminalFontSize(28)
    expect(useFontStore.getState().terminalFontSize).toBe(28)
    useFontStore.getState().adjustTerminalFontSize(0)
    expect(useFontStore.getState().terminalFontSize).toBe(DEFAULT_FONT.terminalFontSize)
  })

  it('adjusts the editor font down and stops at the floor', () => {
    useFontStore.getState().setEditorFontSize(8)
    useFontStore.getState().adjustEditorFontSize(-1)
    expect(useFontStore.getState().editorFontSize).toBe(8)
  })

  it('zooms in/out by a step and resets to 100%', () => {
    const s = useFontStore.getState()
    s.adjustZoom(1)
    expect(useFontStore.getState().uiZoom).toBe(1.1)
    s.adjustZoom(1)
    expect(useFontStore.getState().uiZoom).toBe(1.2) // no float drift
    s.adjustZoom(0)
    expect(useFontStore.getState().uiZoom).toBe(1)
    s.adjustZoom(-1)
    expect(useFontStore.getState().uiZoom).toBe(0.9)
  })

  it('restore re-clamps every field', () => {
    useFontStore.getState().restore({ terminalFontSize: 999, editorFontSize: 0, uiZoom: NaN })
    const s = useFontStore.getState()
    expect(s.terminalFontSize).toBe(32)
    expect(s.editorFontSize).toBe(8)
    expect(s.uiZoom).toBe(1)
  })
})
