import { describe, it, expect } from 'vitest'
import { routeKey, type KeyLike } from './keybinding-router'

const k = (over: Partial<KeyLike>): KeyLike => ({
  key: '',
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...over
})

describe('routeKey', () => {
  it('maps the reserved tab Ctrl chords', () => {
    expect(routeKey(k({ ctrlKey: true, key: 't' }))).toEqual({ kind: 'new-tab' })
    expect(routeKey(k({ ctrlKey: true, key: 'T' }))).toEqual({ kind: 'new-tab' })
    expect(routeKey(k({ ctrlKey: true, key: 'w' }))).toEqual({ kind: 'close-tab' })
    expect(routeKey(k({ ctrlKey: true, key: 'Tab' }))).toEqual({ kind: 'next-tab' })
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'Tab' }))).toEqual({
      kind: 'prev-tab'
    })
    expect(routeKey(k({ ctrlKey: true, key: '1' }))).toEqual({ kind: 'jump-tab', index: 0 })
    expect(routeKey(k({ ctrlKey: true, key: '9' }))).toEqual({ kind: 'jump-tab', index: 8 })
  })

  it('maps the Expansion 6 command / help chords', () => {
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'P' }))).toEqual({
      kind: 'command-palette'
    })
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'p' }))).toEqual({
      kind: 'command-palette'
    })
    // Ctrl+? (Shift+/ = '?' on US layouts) and the raw '/' both open help.
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: '?' }))).toEqual({
      kind: 'help-overlay'
    })
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: '/' }))).toEqual({
      kind: 'help-overlay'
    })
  })

  it('maps the focus-region chords', () => {
    expect(routeKey(k({ ctrlKey: true, key: '`' }))).toEqual({
      kind: 'focus-region',
      region: 'terminal'
    })
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'E' }))).toEqual({
      kind: 'focus-region',
      region: 'explorer'
    })
  })

  it('maps focus-cycle (Ctrl+F6 / Ctrl+Shift+F6)', () => {
    expect(routeKey(k({ ctrlKey: true, key: 'F6' }))).toEqual({ kind: 'focus-cycle', dir: 1 })
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'F6' }))).toEqual({
      kind: 'focus-cycle',
      dir: -1
    })
  })

  it('maps move-tab (Ctrl+Shift+PageUp / PageDown)', () => {
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'PageUp' }))).toEqual({
      kind: 'move-tab',
      dir: -1
    })
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'PageDown' }))).toEqual({
      kind: 'move-tab',
      dir: 1
    })
  })

  // ── The passthrough invariant (spec §7.4). New chords must never regress it. ──

  it('passes terminal-bound Ctrl letter/digit keys through', () => {
    // Ctrl+C interrupt, Ctrl+R reverse-search, Ctrl+D EOF, Ctrl+Z suspend,
    // Ctrl+L clear, Ctrl+A/E line start/end, Ctrl+S/Q flow control, Ctrl+0.
    for (const key of ['c', 'r', 'd', 'z', 'l', 'a', 'e', 's', 'q', 'k', 'u', '0']) {
      expect(routeKey(k({ ctrlKey: true, key }))).toEqual({ kind: 'passthrough' })
    }
  })

  it('passes plain keys, Alt and Meta combos through', () => {
    expect(routeKey(k({ key: 't' }))).toEqual({ kind: 'passthrough' })
    expect(routeKey(k({ key: 'Tab' }))).toEqual({ kind: 'passthrough' })
    expect(routeKey(k({ ctrlKey: true, altKey: true, key: 't' }))).toEqual({ kind: 'passthrough' })
    expect(routeKey(k({ ctrlKey: true, metaKey: true, key: 'w' }))).toEqual({ kind: 'passthrough' })
    // A new chord's base key without Ctrl must not trigger it.
    expect(routeKey(k({ shiftKey: true, key: 'P' }))).toEqual({ kind: 'passthrough' })
    expect(routeKey(k({ key: 'F6' }))).toEqual({ kind: 'passthrough' })
    expect(routeKey(k({ key: '`' }))).toEqual({ kind: 'passthrough' })
  })

  it('passes plain and Ctrl function keys (except Ctrl+F6) through for TUIs', () => {
    for (const key of ['F1', 'F2', 'F3', 'F4', 'F5', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']) {
      expect(routeKey(k({ ctrlKey: true, key }))).toEqual({ kind: 'passthrough' })
      expect(routeKey(k({ key }))).toEqual({ kind: 'passthrough' })
    }
    // F2 is the rename key but is handled locally by the focused tab, never as a
    // global chord — so it must pass through the router.
    expect(routeKey(k({ key: 'F2' }))).toEqual({ kind: 'passthrough' })
  })

  it('passes arrow keys and plain/Ctrl PageUp/PageDown through', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      expect(routeKey(k({ ctrlKey: true, key }))).toEqual({ kind: 'passthrough' })
      expect(routeKey(k({ key }))).toEqual({ kind: 'passthrough' })
    }
    // Only the Ctrl+SHIFT PageUp/PageDown variants are claimed; leave the rest
    // for terminal scrollback.
    expect(routeKey(k({ ctrlKey: true, key: 'PageUp' }))).toEqual({ kind: 'passthrough' })
    expect(routeKey(k({ ctrlKey: true, key: 'PageDown' }))).toEqual({ kind: 'passthrough' })
    expect(routeKey(k({ shiftKey: true, key: 'PageUp' }))).toEqual({ kind: 'passthrough' })
  })

  it('routes Ctrl+Shift+F to terminal-search (TerminalPane opens it when focused)', () => {
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'F' }))).toEqual({
      kind: 'terminal-search'
    })
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'f' }))).toEqual({
      kind: 'terminal-search'
    })
  })

  it('passes unclaimed Ctrl+Shift+letter chords through', () => {
    for (const key of ['R', 'S', 'D', 'G', 'Z']) {
      expect(routeKey(k({ ctrlKey: true, shiftKey: true, key }))).toEqual({ kind: 'passthrough' })
    }
  })
})
