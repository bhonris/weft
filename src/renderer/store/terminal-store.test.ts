import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from './terminal-store'

describe('useTerminalStore', () => {
  beforeEach(() => useTerminalStore.setState({ searchTick: 0 }))

  it('starts at tick 0', () => {
    expect(useTerminalStore.getState().searchTick).toBe(0)
  })

  it('requestSearch bumps the tick (so the mounted TerminalPane opens search)', () => {
    useTerminalStore.getState().requestSearch()
    expect(useTerminalStore.getState().searchTick).toBe(1)
    useTerminalStore.getState().requestSearch()
    expect(useTerminalStore.getState().searchTick).toBe(2)
  })
})
