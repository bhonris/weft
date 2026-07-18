import { describe, it, expect } from 'vitest'
import { treeNav, type NavNode } from './tree-nav'

// A fixture tree:
//  0 src            (dir, expanded)
//  1   index.ts     (file, depth 1)
//  2   util         (dir, collapsed, depth 1)
//  3 README.md      (file, depth 0)
const NODES: NavNode[] = [
  { depth: 0, isDir: true, expanded: true },
  { depth: 1, isDir: false, expanded: false },
  { depth: 1, isDir: true, expanded: false },
  { depth: 0, isDir: false, expanded: false }
]

describe('treeNav', () => {
  it('moves down/up with clamping', () => {
    expect(treeNav(NODES, 0, 'ArrowDown')).toEqual({ type: 'move', index: 1 })
    expect(treeNav(NODES, 3, 'ArrowDown')).toEqual({ type: 'move', index: 3 }) // clamp
    expect(treeNav(NODES, 2, 'ArrowUp')).toEqual({ type: 'move', index: 1 })
    expect(treeNav(NODES, 0, 'ArrowUp')).toEqual({ type: 'move', index: 0 }) // clamp
  })

  it('Home/End jump to first/last', () => {
    expect(treeNav(NODES, 2, 'Home')).toEqual({ type: 'move', index: 0 })
    expect(treeNav(NODES, 0, 'End')).toEqual({ type: 'move', index: 3 })
  })

  it('ArrowRight expands a collapsed dir', () => {
    expect(treeNav(NODES, 2, 'ArrowRight')).toEqual({ type: 'expand' })
  })

  it('ArrowRight on an expanded dir moves to its first child', () => {
    expect(treeNav(NODES, 0, 'ArrowRight')).toEqual({ type: 'move', index: 1 })
  })

  it('ArrowRight on a file does nothing', () => {
    expect(treeNav(NODES, 1, 'ArrowRight')).toEqual({ type: 'none' })
  })

  it('ArrowLeft collapses an expanded dir', () => {
    expect(treeNav(NODES, 0, 'ArrowLeft')).toEqual({ type: 'collapse' })
  })

  it('ArrowLeft on a child moves to its parent', () => {
    expect(treeNav(NODES, 1, 'ArrowLeft')).toEqual({ type: 'move', index: 0 })
    expect(treeNav(NODES, 2, 'ArrowLeft')).toEqual({ type: 'move', index: 0 })
  })

  it('ArrowLeft on a top-level file with no parent does nothing', () => {
    expect(treeNav(NODES, 3, 'ArrowLeft')).toEqual({ type: 'none' })
  })

  it('Enter/Space activate', () => {
    expect(treeNav(NODES, 1, 'Enter')).toEqual({ type: 'activate' })
    expect(treeNav(NODES, 0, ' ')).toEqual({ type: 'activate' })
  })

  it('unknown keys and empty trees yield none', () => {
    expect(treeNav(NODES, 0, 'x')).toEqual({ type: 'none' })
    expect(treeNav([], 0, 'ArrowDown')).toEqual({ type: 'none' })
    expect(treeNav(NODES, 99, 'ArrowDown')).toEqual({ type: 'none' })
  })
})
