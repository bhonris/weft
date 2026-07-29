import { describe, it, expect } from 'vitest'
import { parseDelimited, delimiterForFile } from './delimited'

describe('delimiterForFile', () => {
  it('is tab for .tsv, comma otherwise', () => {
    expect(delimiterForFile('a.tsv')).toBe('\t')
    expect(delimiterForFile('a.csv')).toBe(',')
    expect(delimiterForFile('a.txt')).toBe(',')
  })
})

describe('parseDelimited', () => {
  it('parses a simple grid', () => {
    expect(parseDelimited('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3']
    ])
  })

  it('handles CRLF and a trailing newline without a spurious empty row', () => {
    expect(parseDelimited('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ])
  })

  it('handles a lone CR as a row separator', () => {
    expect(parseDelimited('a,b\r1,2')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ])
  })

  it('respects quoted fields with embedded delimiters, newlines, and "" escapes', () => {
    const text = '"a,1","b\nline","she said ""hi"""\nx,y,z'
    expect(parseDelimited(text)).toEqual([
      ['a,1', 'b\nline', 'she said "hi"'],
      ['x', 'y', 'z']
    ])
  })

  it('keeps empty fields', () => {
    expect(parseDelimited('a,,c\n,,')).toEqual([
      ['a', '', 'c'],
      ['', '', '']
    ])
  })

  it('parses TSV with an explicit tab delimiter', () => {
    expect(parseDelimited('a\tb\n1\t2', '\t')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ])
  })

  it('returns an empty grid for empty input', () => {
    expect(parseDelimited('')).toEqual([])
  })

  it('parses a single unterminated field', () => {
    expect(parseDelimited('solo')).toEqual([['solo']])
  })
})
