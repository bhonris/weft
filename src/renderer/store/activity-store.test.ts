import { describe, it, expect, beforeEach } from 'vitest'
import { useActivityStore } from './activity-store'

describe('useActivityStore', () => {
  beforeEach(() => {
    useActivityStore.setState({ active: 'explorer' })
  })

  it('defaults to the explorer panel', () => {
    expect(useActivityStore.getState().active).toBe('explorer')
  })

  it('setActive switches the panel', () => {
    useActivityStore.getState().setActive('usage')
    expect(useActivityStore.getState().active).toBe('usage')
    useActivityStore.getState().setActive('explorer')
    expect(useActivityStore.getState().active).toBe('explorer')
  })
})
