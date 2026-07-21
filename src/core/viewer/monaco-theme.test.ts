import { describe, it, expect } from 'vitest'
import { monacoThemeForApp } from './monaco-theme'

describe('monacoThemeForApp', () => {
  it('maps explicit themes directly (ignoring the OS preference)', () => {
    expect(monacoThemeForApp('light', true)).toBe('weft-light')
    expect(monacoThemeForApp('light', false)).toBe('weft-light')
    expect(monacoThemeForApp('dark', false)).toBe('weft-dark')
    expect(monacoThemeForApp('dark', true)).toBe('weft-dark')
    expect(monacoThemeForApp('cyberpunk', false)).toBe('weft-cyberpunk')
    expect(monacoThemeForApp('cyberpunk', true)).toBe('weft-cyberpunk')
  })

  it('follows the OS preference for system', () => {
    expect(monacoThemeForApp('system', true)).toBe('weft-dark')
    expect(monacoThemeForApp('system', false)).toBe('weft-light')
  })
})
