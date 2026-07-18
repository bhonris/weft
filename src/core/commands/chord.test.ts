import { describe, it, expect } from 'vitest'
import { parseChord } from './chord'

describe('parseChord', () => {
  it('parses modifiers + key', () => {
    expect(parseChord('Ctrl+Shift+P')).toEqual({
      key: 'P',
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false
    })
    expect(parseChord('Ctrl+T')).toMatchObject({ ctrlKey: true, key: 'T' })
    expect(parseChord('Ctrl+`')).toMatchObject({ ctrlKey: true, key: '`' })
    expect(parseChord('Ctrl+Shift+PageUp')).toMatchObject({
      ctrlKey: true,
      shiftKey: true,
      key: 'PageUp'
    })
    expect(parseChord('F2')).toMatchObject({ key: 'F2', ctrlKey: false })
  })

  it('is case-insensitive on modifier names and accepts aliases', () => {
    expect(parseChord('ctrl+shift+e')).toMatchObject({ ctrlKey: true, shiftKey: true, key: 'e' })
    expect(parseChord('Cmd+K')).toMatchObject({ metaKey: true, key: 'K' })
    expect(parseChord('Alt+F4')).toMatchObject({ altKey: true, key: 'F4' })
  })

  it('returns null for empty or modifier-only hints', () => {
    expect(parseChord('')).toBeNull()
    expect(parseChord('   ')).toBeNull()
    expect(parseChord('Ctrl')).toBeNull()
    expect(parseChord('Ctrl+Shift')).toBeNull()
  })

  it('returns null when a non-final token is not a known modifier', () => {
    expect(parseChord('Xyz+P')).toBeNull()
  })
})
