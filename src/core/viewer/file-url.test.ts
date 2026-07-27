import { describe, it, expect } from 'vitest'
import { fileUrl, pathFromFileUrl } from './file-url'

describe('fileUrl / pathFromFileUrl', () => {
  it('round-trips a Windows path (drive letter, spaces, backslashes)', () => {
    const p = 'C:\\Users\\me\\My Pics\\shot 1.png'
    const url = fileUrl(p)
    expect(url.startsWith('weft-file://f/')).toBe(true)
    expect(pathFromFileUrl(url)).toBe('C:/Users/me/My Pics/shot 1.png')
  })

  it('round-trips a POSIX path and preserves its leading slash', () => {
    const p = '/home/u/proj/a b/c.pdf'
    expect(pathFromFileUrl(fileUrl(p))).toBe(p)
  })

  it('percent-encodes reserved and unicode characters', () => {
    const url = fileUrl('/tmp/a?b#c/π.txt')
    expect(url).not.toContain('?')
    expect(url).not.toContain('#')
    expect(pathFromFileUrl(url)).toBe('/tmp/a?b#c/π.txt')
  })

  it('strips a query/fragment when decoding', () => {
    expect(pathFromFileUrl('weft-file://f/tmp/a.png?v=2')).toBe('/tmp/a.png')
    expect(pathFromFileUrl('weft-file://f/tmp/a.png#frag')).toBe('/tmp/a.png')
  })

  it('returns null for foreign or malformed URLs', () => {
    expect(pathFromFileUrl('https://example.com/a.png')).toBeNull()
    expect(pathFromFileUrl('file:///tmp/a.png')).toBeNull()
    expect(pathFromFileUrl('weft-file://f/%E0%A4%A.png')).toBeNull() // bad %-escape
  })
})
