import { describe, it, expect } from 'vitest'
import {
  emptyOpenFiles,
  openFile,
  closeFile,
  setActiveFile,
  activeFile,
  type OpenFilesState
} from './open-files'

const f = (p: string): { path: string; name: string } => ({ path: p, name: p.split('/').pop()! })
const withFiles = (paths: string[], activeIndex: number): OpenFilesState => ({
  files: paths.map(f),
  activeIndex
})

describe('open-files reducer', () => {
  it('opens a file as a new active tab', () => {
    const s = openFile(emptyOpenFiles, f('a.ts'))
    expect(s.files.map((x) => x.path)).toEqual(['a.ts'])
    expect(s.activeIndex).toBe(0)
    expect(activeFile(s)?.path).toBe('a.ts')
  })

  it('re-activates an already-open file instead of duplicating it', () => {
    let s = openFile(emptyOpenFiles, f('a.ts'))
    s = openFile(s, f('b.ts'))
    expect(s.activeIndex).toBe(1)
    s = openFile(s, f('a.ts')) // already open
    expect(s.files.map((x) => x.path)).toEqual(['a.ts', 'b.ts']) // no dup
    expect(s.activeIndex).toBe(0) // re-activated
  })

  it('activeFile is null when nothing is open', () => {
    expect(activeFile(emptyOpenFiles)).toBeNull()
  })

  it('closing the active tab lands on the neighbour', () => {
    const s = closeFile(withFiles(['a', 'b', 'c'], 1), 'b')
    expect(s.files.map((x) => x.path)).toEqual(['a', 'c'])
    expect(s.activeIndex).toBe(1) // 'c' takes b's slot
  })

  it('closing a tab before the active one shifts the active index left', () => {
    const s = closeFile(withFiles(['a', 'b', 'c'], 2), 'a')
    expect(s.files.map((x) => x.path)).toEqual(['b', 'c'])
    expect(s.activeIndex).toBe(1) // still 'c'
  })

  it('closing a tab after the active one leaves the active tab unchanged', () => {
    const s = closeFile(withFiles(['a', 'b', 'c'], 0), 'c')
    expect(s.files.map((x) => x.path)).toEqual(['a', 'b']) // 'c' removed
    expect(s.activeIndex).toBe(0)
    expect(activeFile(s)?.path).toBe('a')
  })

  it('closing the last tab returns to the empty state', () => {
    expect(closeFile(withFiles(['a'], 0), 'a')).toEqual(emptyOpenFiles)
  })

  it('closing the last (highest-index) active tab clamps onto the new last', () => {
    const s = closeFile(withFiles(['a', 'b'], 1), 'b')
    expect(s.files.map((x) => x.path)).toEqual(['a'])
    expect(s.activeIndex).toBe(0)
  })

  it('closing an unknown path is a no-op', () => {
    const before = withFiles(['a', 'b'], 0)
    expect(closeFile(before, 'zzz')).toBe(before)
  })

  it('setActiveFile switches tabs and ignores out-of-range indices', () => {
    const before = withFiles(['a', 'b'], 0)
    expect(setActiveFile(before, 1).activeIndex).toBe(1)
    expect(setActiveFile(before, 5)).toBe(before)
    expect(setActiveFile(before, -1)).toBe(before)
  })
})
