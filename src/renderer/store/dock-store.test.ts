import { describe, it, expect, beforeEach } from 'vitest'
import { useDockStore } from './dock-store'
import { DEFAULT_DOCK } from '@core/workspace/dock'

beforeEach(() => useDockStore.setState({ ...DEFAULT_DOCK }))

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
})
