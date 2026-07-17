import { describe, it, expect } from 'vitest'
import { isPathInside, isInsideAnyRoot } from './path-guard'

describe('isPathInside', () => {
  it('accepts files under the root (mixed separators, case)', () => {
    expect(isPathInside('C:\\Proj', 'C:\\Proj\\src\\a.ts')).toBe(true)
    expect(isPathInside('C:/proj', 'C:\\PROJ\\a.ts')).toBe(true)
    expect(isPathInside('C:/proj/', 'C:/proj/a.ts')).toBe(true)
  })

  it('accepts the root itself', () => {
    expect(isPathInside('C:/proj', 'C:/proj')).toBe(true)
  })

  it('rejects siblings and prefix-lookalikes', () => {
    expect(isPathInside('C:/proj', 'C:/other/a.ts')).toBe(false)
    // "C:/proj-evil" must not pass a naive startsWith("C:/proj") check.
    expect(isPathInside('C:/proj', 'C:/proj-evil/a.ts')).toBe(false)
  })

  it('rejects an empty root', () => {
    expect(isPathInside('', 'C:/anything')).toBe(false)
  })
})

describe('isInsideAnyRoot', () => {
  it('accepts when any open root contains the path', () => {
    expect(isInsideAnyRoot(['C:/a', 'C:/b'], 'C:/b/x.txt')).toBe(true)
    expect(isInsideAnyRoot(['C:/a'], 'C:/b/x.txt')).toBe(false)
    expect(isInsideAnyRoot([], 'C:/b/x.txt')).toBe(false)
  })
})
