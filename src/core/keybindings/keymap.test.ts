import { describe, it, expect } from 'vitest'
import {
  chordOf,
  DEFAULT_KEYMAP,
  isProtectedChord,
  bindChord,
  resetChord,
  resetAll,
  type Keymap
} from './keymap'
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

describe('isProtectedChord (criterion 3)', () => {
  it('never protects Ctrl+Shift chords (the safe app space)', () => {
    for (const c of ['ctrl+shift+p', 'ctrl+shift+g', 'ctrl+shift+f', 'ctrl+shift+1']) {
      expect(isProtectedChord(c)).toBe(false)
    }
  })

  it('protects the reserved terminal Ctrl keys and Ctrl+digit built-ins', () => {
    // readline / control keys the shell needs
    for (const c of ['ctrl+c', 'ctrl+r', 'ctrl+d', 'ctrl+z', 'ctrl+l', 'ctrl+a', 'ctrl+e',
      'ctrl+h', 'ctrl+s', 'ctrl+q', 'ctrl+u', 'ctrl+p', 'ctrl+n', 'ctrl+b']) {
      expect(isProtectedChord(c)).toBe(true)
    }
    for (const c of ['ctrl+1', 'ctrl+5', 'ctrl+9']) expect(isProtectedChord(c)).toBe(true)
  })

  it('allows rebinding the plain-Ctrl chords Weft already owns', () => {
    for (const c of ['ctrl+t', 'ctrl+w', 'ctrl+`']) expect(isProtectedChord(c)).toBe(false)
  })
})

describe('bindChord', () => {
  it('refuses a protected chord and leaves the keymap untouched (criterion 3)', () => {
    const r = bindChord(DEFAULT_KEYMAP, 'ctrl+c', { kind: 'new-tab' })
    expect(r).toEqual({ ok: false, reason: 'protected' })
    // The invariant that matters: a protected chord never enters the map, so it
    // still reaches the PTY even after an attempted arbitrary remap.
    expect(routeKey(k({ ctrlKey: true, key: 'c' }), DEFAULT_KEYMAP)).toEqual({ kind: 'passthrough' })
  })

  it('reports the displaced binding when the chord was already in use (criterion 4)', () => {
    const r = bindChord(DEFAULT_KEYMAP, 'ctrl+shift+p', { kind: 'new-tab' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.displaced).toEqual({ kind: 'command-palette' })
      // The new binding wins; resolving the chord now yields the new action.
      expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'p' }), r.keymap)).toEqual({
        kind: 'new-tab'
      })
      // Original map is untouched (pure).
      expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'p' }), DEFAULT_KEYMAP)).toEqual({
        kind: 'command-palette'
      })
    }
  })

  it('reports no conflict when binding a free chord', () => {
    const r = bindChord(DEFAULT_KEYMAP, 'ctrl+shift+g', { kind: 'command-palette' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.displaced).toBeNull()
  })
})

describe('resetChord / resetAll', () => {
  it('restores a rebound default chord to its built-in action', () => {
    const rebound = bindChord(DEFAULT_KEYMAP, 'ctrl+shift+p', { kind: 'new-tab' })
    expect(rebound.ok).toBe(true)
    if (rebound.ok) {
      const back = resetChord(rebound.keymap, 'ctrl+shift+p')
      expect(back['ctrl+shift+p']).toEqual({ kind: 'command-palette' })
    }
  })

  it('unbinds a non-default chord on reset', () => {
    const added = bindChord(DEFAULT_KEYMAP, 'ctrl+shift+g', { kind: 'command-palette' })
    expect(added.ok).toBe(true)
    if (added.ok) {
      const back = resetChord(added.keymap, 'ctrl+shift+g')
      expect('ctrl+shift+g' in back).toBe(false)
    }
  })

  it('resetAll returns a fresh copy of the defaults', () => {
    const all = resetAll()
    expect(all).toEqual(DEFAULT_KEYMAP)
    expect(all).not.toBe(DEFAULT_KEYMAP) // a copy, not the shared reference
  })
})
