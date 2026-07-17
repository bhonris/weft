import { describe, it, expect } from 'vitest'
import { clampBoundsToDisplays, type Rect } from './clamp-bounds'

const display: Rect = { x: 0, y: 0, width: 1920, height: 1080 }

describe('clampBoundsToDisplays', () => {
  it('accepts bounds visible on a current display', () => {
    const b = { x: 100, y: 100, width: 900, height: 700 }
    expect(clampBoundsToDisplays(b, [display])).toEqual(b)
  })

  it('rejects bounds stranded on an unplugged monitor', () => {
    const b = { x: -2500, y: 0, width: 900, height: 700 } // far left of any display
    expect(clampBoundsToDisplays(b, [display])).toBeUndefined()
  })

  it('accepts bounds on a secondary display', () => {
    const second: Rect = { x: 1920, y: 0, width: 1920, height: 1080 }
    const b = { x: 2000, y: 50, width: 800, height: 600 }
    expect(clampBoundsToDisplays(b, [display, second])).toEqual(b)
  })

  it('requires a meaningful visible overlap, not one pixel', () => {
    const b = { x: 1910, y: 0, width: 900, height: 700 } // only 10px on screen
    expect(clampBoundsToDisplays(b, [display])).toBeUndefined()
  })

  it('rejects NaN/Infinity and absurdly small bounds', () => {
    expect(
      clampBoundsToDisplays({ x: Number.NaN, y: 0, width: 900, height: 700 }, [display])
    ).toBeUndefined()
    expect(
      clampBoundsToDisplays({ x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 700 }, [
        display
      ])
    ).toBeUndefined()
    expect(clampBoundsToDisplays({ x: 0, y: 0, width: 50, height: 40 }, [display])).toBeUndefined()
  })

  it('passes undefined through', () => {
    expect(clampBoundsToDisplays(undefined, [display])).toBeUndefined()
  })
})
