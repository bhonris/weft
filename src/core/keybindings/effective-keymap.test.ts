import { describe, it, expect } from 'vitest'
import {
  buildKeymap,
  chordForCommand,
  rebindCommand,
  clearCommandBinding,
  UNBOUND
} from './effective-keymap'
import { DEFAULT_KEYMAP } from './keymap'
import { routeKey, type KeyLike } from './keybinding-router'

const k = (over: Partial<KeyLike>): KeyLike => ({
  key: '',
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...over
})

describe('buildKeymap', () => {
  it('with no overrides equals the defaults (a copy, not the shared reference)', () => {
    const map = buildKeymap({})
    expect(map).toEqual(DEFAULT_KEYMAP)
    expect(map).not.toBe(DEFAULT_KEYMAP)
  })

  it('applies an override so the new chord routes to that command', () => {
    const map = buildKeymap({ 'ctrl+shift+g': 'general.commandPalette' })
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'g' }), map)).toEqual({
      kind: 'command-palette'
    })
    // The default chord for that command is still present (this leap only adds
    // the override; the editor will manage freeing the old chord).
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'p' }), map)).toEqual({
      kind: 'command-palette'
    })
  })

  it('can rebind an existing default chord to a different command', () => {
    const map = buildKeymap({ 'ctrl+t': 'tab.close' })
    expect(routeKey(k({ ctrlKey: true, key: 't' }), map)).toEqual({ kind: 'close-tab' })
  })

  it('reconstructs parameterized actions from their command id', () => {
    const map = buildKeymap({
      'ctrl+shift+arrowright': 'tab.moveRight',
      'ctrl+shift+g': 'focus.explorer'
    })
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'ArrowRight' }), map)).toEqual({
      kind: 'move-tab',
      dir: 1
    })
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'g' }), map)).toEqual({
      kind: 'focus-region',
      region: 'explorer'
    })
  })

  it('ignores an override on a protected chord (terminal keys stay passthrough)', () => {
    const map = buildKeymap({ 'ctrl+c': 'tab.new' })
    expect('ctrl+c' in map).toBe(false)
    expect(routeKey(k({ ctrlKey: true, key: 'c' }), map)).toEqual({ kind: 'passthrough' })
  })

  it('ignores an override naming an unknown or non-chord command', () => {
    const map = buildKeymap({ 'ctrl+shift+g': 'general.cycleTheme', 'ctrl+shift+j': 'bogus' })
    expect('ctrl+shift+g' in map).toBe(false) // cycleTheme has no chord form
    expect('ctrl+shift+j' in map).toBe(false) // unknown id
  })

  it('treats the UNBOUND sentinel as "delete this default chord"', () => {
    const map = buildKeymap({ 'ctrl+shift+p': UNBOUND })
    expect('ctrl+shift+p' in map).toBe(false)
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'p' }), map)).toEqual({
      kind: 'passthrough'
    })
  })
})

describe('chordForCommand', () => {
  it('returns the built-in chord with no overrides', () => {
    expect(chordForCommand({}, 'general.commandPalette')).toBe('ctrl+shift+p')
    expect(chordForCommand({}, 'tab.new')).toBe('ctrl+t')
  })

  it('returns null for a command with no chord form', () => {
    expect(chordForCommand({}, 'general.cycleTheme')).toBeNull()
  })
})

describe('rebindCommand', () => {
  it('moves a command to a new chord and unbinds its old default', () => {
    const r = rebindCommand({}, 'general.commandPalette', 'ctrl+shift+g')
    expect(r.ok).toBe(true)
    if (r.ok) {
      const map = buildKeymap(r.overrides)
      // New chord opens the palette; the old default no longer does.
      expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'g' }), map)).toEqual({
        kind: 'command-palette'
      })
      expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'p' }), map)).toEqual({
        kind: 'passthrough'
      })
    }
  })

  it('refuses a protected chord', () => {
    expect(rebindCommand({}, 'tab.new', 'ctrl+c')).toEqual({ ok: false, reason: 'protected' })
  })

  it('refuses an empty chord or a command with no chord form', () => {
    expect(rebindCommand({}, 'tab.new', '')).toEqual({ ok: false, reason: 'invalid' })
    expect(rebindCommand({}, 'general.cycleTheme', 'ctrl+shift+g')).toEqual({
      ok: false,
      reason: 'invalid'
    })
  })

  it('reports the displaced command AND that command actually loses its chord', () => {
    const r = rebindCommand({}, 'tab.new', 'ctrl+shift+p')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.displaced).toBe('general.commandPalette')
      const map = buildKeymap(r.overrides)
      // ctrl+shift+p now runs New Tab, and the palette has no chord left.
      expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'p' }), map)).toEqual({
        kind: 'new-tab'
      })
      expect(chordForCommand(r.overrides, 'general.commandPalette')).toBeNull()
    }
  })

  it('reports terminal-search as displaced even though it is a passthrough action', () => {
    // Ctrl+Shift+F defaults to terminal-search; rebinding another command onto it
    // must still surface the conflict (commandIdForAction maps it to null).
    const r = rebindCommand({}, 'tab.new', 'ctrl+shift+f')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.displaced).toBe('general.terminalSearch')
  })

  it('rebinding a command to its own current chord is a no-op-ish success', () => {
    const r = rebindCommand({}, 'general.commandPalette', 'ctrl+shift+p')
    expect(r.ok).toBe(true)
    if (r.ok) {
      const map = buildKeymap(r.overrides)
      expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'p' }), map)).toEqual({
        kind: 'command-palette'
      })
    }
  })

  it('drops a prior custom chord when the command is rebound again', () => {
    const first = rebindCommand({}, 'general.commandPalette', 'ctrl+shift+g')
    expect(first.ok).toBe(true)
    if (first.ok) {
      const second = rebindCommand(first.overrides, 'general.commandPalette', 'ctrl+shift+j')
      expect(second.ok).toBe(true)
      if (second.ok) {
        const map = buildKeymap(second.overrides)
        expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'j' }), map)).toEqual({
          kind: 'command-palette'
        })
        // The intermediate chord no longer opens the palette.
        expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'g' }), map)).toEqual({
          kind: 'passthrough'
        })
      }
    }
  })
})

describe('clearCommandBinding', () => {
  it('restores a moved command to its built-in default', () => {
    const moved = rebindCommand({}, 'general.commandPalette', 'ctrl+shift+g')
    expect(moved.ok).toBe(true)
    if (moved.ok) {
      const cleared = clearCommandBinding(moved.overrides, 'general.commandPalette')
      const map = buildKeymap(cleared)
      expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'p' }), map)).toEqual({
        kind: 'command-palette'
      })
      expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'g' }), map)).toEqual({
        kind: 'passthrough'
      })
    }
  })
})
