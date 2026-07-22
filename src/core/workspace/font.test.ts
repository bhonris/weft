import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FONT,
  FONT_STEP,
  ZOOM_STEP,
  clampTerminalFontSize,
  clampEditorFontSize,
  clampZoom
} from './font'

describe('DEFAULT_FONT', () => {
  it('ships a comfortable 15px terminal, 14px editor, 100% zoom', () => {
    expect(DEFAULT_FONT).toEqual({ terminalFontSize: 15, editorFontSize: 14, uiZoom: 1 })
  })

  it('exposes sensible step sizes', () => {
    expect(FONT_STEP).toBe(1)
    expect(ZOOM_STEP).toBeCloseTo(0.1)
  })
})

describe('clampTerminalFontSize', () => {
  it('keeps an in-range size (rounded to a whole px)', () => {
    expect(clampTerminalFontSize(15)).toBe(15)
    expect(clampTerminalFontSize(16.4)).toBe(16)
  })

  it('clamps below the floor and above the ceiling', () => {
    expect(clampTerminalFontSize(2)).toBe(8)
    expect(clampTerminalFontSize(999)).toBe(32)
  })

  it('falls back to the default for a non-finite value (corrupt blob)', () => {
    expect(clampTerminalFontSize(NaN)).toBe(15)
    expect(clampTerminalFontSize(Infinity)).toBe(15)
  })
})

describe('clampEditorFontSize', () => {
  it('keeps an in-range size and clamps the extremes', () => {
    expect(clampEditorFontSize(14)).toBe(14)
    expect(clampEditorFontSize(1)).toBe(8)
    expect(clampEditorFontSize(200)).toBe(40)
  })

  it('falls back to the default for NaN', () => {
    expect(clampEditorFontSize(NaN)).toBe(14)
  })
})

describe('clampZoom', () => {
  it('keeps an in-range factor', () => {
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(1.5)).toBe(1.5)
  })

  it('clamps below 50% and above 300%', () => {
    expect(clampZoom(0.1)).toBe(0.5)
    expect(clampZoom(10)).toBe(3)
  })

  it('rounds away float drift from repeated 0.1 steps', () => {
    // 1 + 0.1 + 0.1 in float is 1.2000000000000002 — must clamp to a clean 1.2.
    expect(clampZoom(0.1 + 0.1 + 1)).toBe(1.2)
  })

  it('falls back to the default zoom for a non-finite factor', () => {
    expect(clampZoom(NaN)).toBe(1)
  })
})
