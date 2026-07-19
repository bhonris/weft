import { describe, it, expect } from 'vitest'
import { buildKeymap } from './effective-keymap'
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
})
