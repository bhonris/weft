import { describe, it, expect, beforeEach } from 'vitest'
import { useDockStore } from './dock-store'
import { DEFAULT_DOCK } from '@core/workspace/dock'

beforeEach(() => useDockStore.setState({ ...DEFAULT_DOCK, maximized: false }))

describe('useDockStore', () => {
  it('defaults to a bottom dock at 0.4', () => {
    const s = useDockStore.getState()
    expect(s.position).toBe('bottom')
    expect(s.size).toBe(0.4)
  })

  it('setPosition re-docks to another edge', () => {
    useDockStore.getState().setPosition('right')
    expect(useDockStore.getState().position).toBe('right')
  })

  it('setSize clamps into range', () => {
    useDockStore.getState().setSize(2)
    expect(useDockStore.getState().size).toBe(0.85)
    useDockStore.getState().setSize(0.5)
    expect(useDockStore.getState().size).toBe(0.5)
  })

  it('restore replaces the whole dock (for workspace load)', () => {
    useDockStore.getState().restore({ position: 'left', size: 0.6 })
    const s = useDockStore.getState()
    expect(s.position).toBe('left')
    expect(s.size).toBe(0.6)
  })

  it('restore RE-CLAMPS a corrupt/out-of-range persisted size', () => {
    useDockStore.getState().restore({ position: 'right', size: 999 })
    expect(useDockStore.getState().size).toBe(0.85) // clamped, not 999
    useDockStore.getState().restore({ position: 'right', size: -5 })
    expect(useDockStore.getState().size).toBe(0.15)
  })

  it('setPosition preserves the current size', () => {
    useDockStore.getState().setSize(0.7)
    useDockStore.getState().setPosition('left')
    expect(useDockStore.getState().size).toBe(0.7)
  })

  it('defaults to not maximized', () => {
    expect(useDockStore.getState().maximized).toBe(false)
  })

  it('toggleMaximized flips the CLI focus mode', () => {
    useDockStore.getState().toggleMaximized()
    expect(useDockStore.getState().maximized).toBe(true)
    useDockStore.getState().toggleMaximized()
    expect(useDockStore.getState().maximized).toBe(false)
  })

  it('setMaximized sets the flag explicitly', () => {
    useDockStore.getState().setMaximized(true)
    expect(useDockStore.getState().maximized).toBe(true)
    useDockStore.getState().setMaximized(false)
    expect(useDockStore.getState().maximized).toBe(false)
  })

  it('restore leaves the transient maximize flag untouched (session-only)', () => {
    useDockStore.getState().setMaximized(true)
    useDockStore.getState().restore({ position: 'left', size: 0.6 })
    // Position/size come from the restore; maximize is not persisted, so it stays.
    expect(useDockStore.getState().position).toBe('left')
    expect(useDockStore.getState().maximized).toBe(true)
  })
})
