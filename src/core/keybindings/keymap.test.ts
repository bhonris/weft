import { describe, it, expect } from 'vitest'
import { chordOf, DEFAULT_KEYMAP, type Keymap } from './keymap'
import { routeKey, type KeyLike } from './keybinding-router'

const k = (over: Partial<KeyLike>): KeyLike => ({
  key: '',
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...over
})

describe('chordOf', () => {
  it('canonicalizes Ctrl / Ctrl+Shift chords (lowercased, fixed order)', () => {
    expect(chordOf(k({ ctrlKey: true, key: 'T' }))).toBe('ctrl+t')
    expect(chordOf(k({ ctrlKey: true, key: 't' }))).toBe('ctrl+t')
    expect(chordOf(k({ ctrlKey: true, shiftKey: true, key: 'P' }))).toBe('ctrl+shift+p')
    expect(chordOf(k({ ctrlKey: true, key: 'Tab' }))).toBe('ctrl+tab')
    expect(chordOf(k({ ctrlKey: true, shiftKey: true, key: 'PageUp' }))).toBe('ctrl+shift+pageup')
    expect(chordOf(k({ ctrlKey: true, key: '`' }))).toBe('ctrl+`')
  })

  it('folds Shift+/ (which reports as ? on US layouts) to a single chord', () => {
    expect(chordOf(k({ ctrlKey: true, shiftKey: true, key: '?' }))).toBe('ctrl+shift+/')
    expect(chordOf(k({ ctrlKey: true, shiftKey: true, key: '/' }))).toBe('ctrl+shift+/')
  })

  it('returns null for anything that must pass through (no Ctrl / Alt / Meta / bare modifier)', () => {
    expect(chordOf(k({ key: 't' }))).toBeNull()
    expect(chordOf(k({ ctrlKey: true, altKey: true, key: 't' }))).toBeNull()
    expect(chordOf(k({ ctrlKey: true, metaKey: true, key: 'w' }))).toBeNull()
    expect(chordOf(k({ ctrlKey: true, key: 'Control' }))).toBeNull()
    expect(chordOf(k({ ctrlKey: true, key: '' }))).toBeNull()
  })
})

describe('DEFAULT_KEYMAP', () => {
  it('every default binding is reachable by routing its canonical chord', () => {
    for (const [chord, action] of Object.entries(DEFAULT_KEYMAP)) {
      const [mods, base] = chord.startsWith('ctrl+shift+')
        ? [{ ctrlKey: true, shiftKey: true }, chord.slice('ctrl+shift+'.length)]
        : [{ ctrlKey: true }, chord.slice('ctrl+'.length)]
      expect(routeKey(k({ ...mods, key: base }))).toEqual(action)
    }
  })
})

describe('routeKey (data-driven resolution)', () => {
  it('honors a custom keymap instead of the defaults', () => {
    const custom: Keymap = { 'ctrl+t': { kind: 'close-tab' } }
    // Rebound: Ctrl+T now closes.
    expect(routeKey(k({ ctrlKey: true, key: 't' }), custom)).toEqual({ kind: 'close-tab' })
    // A default chord absent from the custom map is no longer claimed.
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'p' }), custom)).toEqual({
      kind: 'passthrough'
    })
  })

  it('an empty keymap routes every non-jump chord to passthrough', () => {
    const empty: Keymap = {}
    expect(routeKey(k({ ctrlKey: true, key: 't' }), empty)).toEqual({ kind: 'passthrough' })
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'f' }), empty)).toEqual({
      kind: 'passthrough'
    })
    // jump-tab is a built-in and ignores the keymap entirely.
    expect(routeKey(k({ ctrlKey: true, key: '2' }), empty)).toEqual({ kind: 'jump-tab', index: 1 })
  })
})
