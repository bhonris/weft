import { describe, it, expect } from 'vitest'
import { sortEntries, isIgnored, DEFAULT_IGNORES } from './dir-sort'
import type { DirEntry } from '@shared/ipc/api-contract'

const e = (name: string, kind: DirEntry['kind']): DirEntry => ({
  name,
  path: `/x/${name}`,
  kind
})

describe('sortEntries', () => {
  it('puts directories before files, each alphabetical (case-insensitive)', () => {
    const sorted = sortEntries([
      e('README.md', 'file'),
      e('src', 'dir'),
      e('Apple.txt', 'file'),
      e('assets', 'dir')
    ])
    expect(sorted.map((x) => x.name)).toEqual(['assets', 'src', 'Apple.txt', 'README.md'])
  })

  it('treats symlinks as files for ordering', () => {
    const sorted = sortEntries([e('link', 'symlink'), e('dir', 'dir')])
    expect(sorted.map((x) => x.name)).toEqual(['dir', 'link'])
  })

  it('does not mutate the input', () => {
    const input = [e('b', 'file'), e('a', 'file')]
    sortEntries(input)
    expect(input.map((x) => x.name)).toEqual(['b', 'a'])
  })
})

describe('isIgnored', () => {
  it('ignores node_modules and .git by default', () => {
    expect(isIgnored('node_modules')).toBe(true)
    expect(isIgnored('.git')).toBe(true)
    expect(isIgnored('src')).toBe(false)
  })

  it('accepts a custom ignore set', () => {
    expect(isIgnored('dist', new Set(['dist']))).toBe(true)
    expect(isIgnored('node_modules', new Set(['dist']))).toBe(false)
  })

  it('exposes the default ignore set', () => {
    expect(DEFAULT_IGNORES.has('node_modules')).toBe(true)
  })
})
