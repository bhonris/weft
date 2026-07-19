import { describe, it, expect } from 'vitest'
import {
  DEFAULT_DOCK,
  clampDockSize,
  setDockPosition,
  setDockSize,
  nextDockPosition
} from './dock'

describe('dock state', () => {
  it('defaults to a bottom dock at 0.4', () => {
    expect(DEFAULT_DOCK).toEqual({ position: 'bottom', size: 0.4 })
  })

  it('clamps the size into [0.15, 0.85]', () => {
    expect(clampDockSize(0.5)).toBe(0.5)
    expect(clampDockSize(0.01)).toBe(0.15)
    expect(clampDockSize(0.99)).toBe(0.85)
  })

  it('falls back to the default size for non-finite input', () => {
    expect(clampDockSize(NaN)).toBe(DEFAULT_DOCK.size)
    expect(clampDockSize(Infinity)).toBe(DEFAULT_DOCK.size) // non-finite -> default
  })

  it('re-docks to another edge', () => {
    expect(setDockPosition(DEFAULT_DOCK, 'right').position).toBe('right')
    expect(setDockPosition(DEFAULT_DOCK, 'left')).toEqual({ position: 'left', size: 0.4 })
  })

  it('setDockSize clamps as it sets', () => {
    expect(setDockSize(DEFAULT_DOCK, 0.6).size).toBe(0.6)
    expect(setDockSize(DEFAULT_DOCK, 2).size).toBe(0.85)
  })

  it('cycles the dock edge bottom → right → left → bottom', () => {
    expect(nextDockPosition('bottom')).toBe('right')
    expect(nextDockPosition('right')).toBe('left')
    expect(nextDockPosition('left')).toBe('bottom')
  })

  it('clamps exactly at the boundaries', () => {
    expect(clampDockSize(0.15)).toBe(0.15)
    expect(clampDockSize(0.85)).toBe(0.85)
    expect(clampDockSize(-Infinity)).toBe(DEFAULT_DOCK.size) // non-finite
  })
})
