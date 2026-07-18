import { describe, it, expect } from 'vitest'
import { nextRegion, REGION_ORDER, type RegionId } from './region-cycle'

const ALL = [...REGION_ORDER] as RegionId[]

describe('nextRegion', () => {
  it('cycles forward in canonical order', () => {
    expect(nextRegion(ALL, 'tabs', 1)).toBe('explorer')
    expect(nextRegion(ALL, 'explorer', 1)).toBe('terminal')
    expect(nextRegion(ALL, 'status', 1)).toBe('tabs') // wraps
  })

  it('cycles backward', () => {
    expect(nextRegion(ALL, 'explorer', -1)).toBe('tabs')
    expect(nextRegion(ALL, 'tabs', -1)).toBe('status') // wraps
  })

  it('skips absent regions', () => {
    const present: RegionId[] = ['tabs', 'terminal', 'status'] // no explorer/viewer
    expect(nextRegion(present, 'tabs', 1)).toBe('terminal')
    expect(nextRegion(present, 'terminal', 1)).toBe('status')
    expect(nextRegion(present, 'status', 1)).toBe('tabs')
    expect(nextRegion(present, 'terminal', -1)).toBe('tabs')
  })

  it('ignores present-order and uses canonical order', () => {
    const scrambled: RegionId[] = ['status', 'terminal', 'tabs']
    expect(nextRegion(scrambled, 'tabs', 1)).toBe('terminal')
  })

  it('starts from the first (or last) present region when current is null/absent', () => {
    expect(nextRegion(ALL, null, 1)).toBe('tabs')
    expect(nextRegion(ALL, null, -1)).toBe('status')
    // 'viewer' absent → treated as no current
    expect(nextRegion(['tabs', 'terminal'], 'viewer', 1)).toBe('tabs')
    expect(nextRegion(['tabs', 'terminal'], 'viewer', -1)).toBe('terminal')
  })

  it('returns null when nothing is present', () => {
    expect(nextRegion([], 'tabs', 1)).toBeNull()
  })

  it('returns the sole region when only one is present', () => {
    expect(nextRegion(['terminal'], 'terminal', 1)).toBe('terminal')
    expect(nextRegion(['terminal'], 'terminal', -1)).toBe('terminal')
  })
})
