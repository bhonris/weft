import { describe, it, expect } from 'vitest'
import { resolveClickedPath } from './path-resolve'

describe('resolveClickedPath', () => {
  it('joins a relative token onto a Windows cwd (backslash output)', () => {
    expect(resolveClickedPath('C:\\repos\\weft', 'src/x.ts')).toBe('C:\\repos\\weft\\src\\x.ts')
  })

  it('joins a relative token onto a POSIX cwd (forward-slash output)', () => {
    expect(resolveClickedPath('/home/u/proj', 'src/x.ts')).toBe('/home/u/proj/src/x.ts')
  })

  it('strips a leading ./', () => {
    expect(resolveClickedPath('/home/u/proj', './a/b.ts')).toBe('/home/u/proj/a/b.ts')
  })

  it('collapses ../ segments', () => {
    expect(resolveClickedPath('C:\\a\\b', '..\\c\\x.ts')).toBe('C:\\a\\c\\x.ts')
    expect(resolveClickedPath('/a/b/c', '../../x.ts')).toBe('/a/x.ts')
  })

  it('passes a Windows-absolute token through, collapsing dots', () => {
    expect(resolveClickedPath('C:\\repos\\weft', 'C:\\other\\y.ts')).toBe('C:\\other\\y.ts')
    expect(resolveClickedPath('C:\\repos\\weft', 'C:/other/./y.ts')).toBe('C:\\other\\y.ts')
  })

  it('passes a POSIX-absolute token through even from a Windows cwd', () => {
    expect(resolveClickedPath('C:\\repos\\weft', '/usr/local/x.ts')).toBe('/usr/local/x.ts')
  })

  it('resolves a bare filename against the cwd', () => {
    expect(resolveClickedPath('/home/u/proj', 'README.md')).toBe('/home/u/proj/README.md')
  })

  it('resolves "." to the cwd itself', () => {
    expect(resolveClickedPath('/home/u/proj', '.')).toBe('/home/u/proj')
  })
})
