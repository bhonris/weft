import { describe, it, expect } from 'vitest'
import { parseFileLinks } from './file-link'

describe('parseFileLinks', () => {
  it('finds a bare relative path', () => {
    const [m, ...rest] = parseFileLinks('see src/core/x.ts for details')
    expect(rest).toEqual([])
    expect(m?.path).toBe('src/core/x.ts')
    expect(m?.line).toBeUndefined()
    expect(m?.column).toBeUndefined()
    expect('see '.length).toBe(m!.start)
    expect(m!.end).toBe('see src/core/x.ts'.length)
  })

  it('parses a :line suffix', () => {
    const [m] = parseFileLinks('src/x.ts:42')
    expect(m).toMatchObject({ path: 'src/x.ts', line: 42 })
    expect(m!.column).toBeUndefined()
  })

  it('parses a :line:col suffix', () => {
    const [m] = parseFileLinks('at src/x.ts:42:7 now')
    expect(m).toMatchObject({ path: 'src/x.ts', line: 42, column: 7 })
    // The whole token (path + position) is covered by the offsets.
    expect('at '.length).toBe(m!.start)
    expect(m!.end).toBe('at src/x.ts:42:7'.length)
  })

  it('recognizes a bare dotted filename', () => {
    const [m] = parseFileLinks('edited README.md')
    expect(m?.path).toBe('README.md')
  })

  it('recognizes ./ and ../ prefixes', () => {
    expect(parseFileLinks('./a/b.ts')[0]?.path).toBe('./a/b.ts')
    expect(parseFileLinks('..\\a\\b.ts')[0]?.path).toBe('..\\a\\b.ts')
  })

  it('recognizes a POSIX absolute path', () => {
    const [m] = parseFileLinks('/usr/local/x.ts:3')
    expect(m).toMatchObject({ path: '/usr/local/x.ts', line: 3 })
  })

  it('recognizes a Windows absolute path and keeps the drive colon', () => {
    const [m] = parseFileLinks('C:\\Users\\a\\b.ts')
    expect(m?.path).toBe('C:\\Users\\a\\b.ts')
    expect(m?.line).toBeUndefined()
  })

  it('recognizes a Windows absolute path WITH a line:col suffix', () => {
    const [m] = parseFileLinks('C:\\Users\\a\\b.ts:12:5')
    expect(m).toMatchObject({ path: 'C:\\Users\\a\\b.ts', line: 12, column: 5 })
  })

  it('recognizes a Windows path with forward slashes', () => {
    const [m] = parseFileLinks('C:/proj/x.ts:9')
    expect(m).toMatchObject({ path: 'C:/proj/x.ts', line: 9 })
  })

  it('does not treat a bare drive letter as a path', () => {
    expect(parseFileLinks('drive C: is full')).toEqual([])
  })

  it('rejects plain words and bare numbers', () => {
    expect(parseFileLinks('the quick brown fox 12345')).toEqual([])
    expect(parseFileLinks('ERROR: something went wrong')).toEqual([])
  })

  it('rejects a bare :line:col token with no path in front of it', () => {
    expect(parseFileLinks('jumped to :42:7 somehow')).toEqual([])
  })

  it('strips wrapping quotes and parens', () => {
    expect(parseFileLinks('opened "src/x.ts"')[0]?.path).toBe('src/x.ts')
    expect(parseFileLinks('(src/x.ts)')[0]?.path).toBe('src/x.ts')
  })

  it('strips a trailing sentence period and colon', () => {
    expect(parseFileLinks('failed in src/x.ts.')[0]?.path).toBe('src/x.ts')
    expect(parseFileLinks('Error in src/x.ts: boom')[0]?.path).toBe('src/x.ts')
  })

  it('finds multiple tokens on one line with correct offsets', () => {
    const line = 'copy src/a.ts to lib/b.ts'
    const ms = parseFileLinks(line)
    expect(ms.map((m) => m.path)).toEqual(['src/a.ts', 'lib/b.ts'])
    expect(line.slice(ms[0]!.start, ms[0]!.end)).toBe('src/a.ts')
    expect(line.slice(ms[1]!.start, ms[1]!.end)).toBe('lib/b.ts')
  })

  it('returns an empty array for an empty or whitespace line', () => {
    expect(parseFileLinks('')).toEqual([])
    expect(parseFileLinks('   \t  ')).toEqual([])
  })
})
