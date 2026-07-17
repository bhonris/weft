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
  it('maps the reserved Ctrl chords', () => {
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

  it('passes terminal-bound Ctrl keys through (Ctrl+C, Ctrl+R, Ctrl+0…)', () => {
    for (const key of ['c', 'r', 'd', 'z', 'l', 'a', 'e', '0']) {
      expect(routeKey(k({ ctrlKey: true, key }))).toEqual({ kind: 'passthrough' })
    }
  })

  it('passes plain keys, Alt and Meta combos through', () => {
    expect(routeKey(k({ key: 't' }))).toEqual({ kind: 'passthrough' })
    expect(routeKey(k({ ctrlKey: true, altKey: true, key: 't' }))).toEqual({
      kind: 'passthrough'
    })
    expect(routeKey(k({ ctrlKey: true, metaKey: true, key: 'w' }))).toEqual({
      kind: 'passthrough'
    })
    expect(routeKey(k({ key: 'Tab' }))).toEqual({ kind: 'passthrough' })
  })

  it('passes Ctrl+Shift+letter through (reserved for future chords)', () => {
    expect(routeKey(k({ ctrlKey: true, shiftKey: true, key: 'T' }))).toEqual({
      kind: 'passthrough'
    })
  })
})
