import { describe, it, expect } from 'vitest'
import {
  DEFAULT_DOCK,
  DOCK_RESIZE_STEP,
  clampDockSize,
  setDockPosition,
  setDockSize,
  nextDockPosition,
  dockResizeDelta
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

describe('dockResizeDelta — keyboard resize matches mouse drag per edge', () => {
  // The GROW key must move the divider toward the editor (mouse-drag direction).
  it('bottom dock: ArrowUp grows, ArrowDown shrinks', () => {
    expect(dockResizeDelta('bottom', 'ArrowUp')).toBe(DOCK_RESIZE_STEP)
    expect(dockResizeDelta('bottom', 'ArrowDown')).toBe(-DOCK_RESIZE_STEP)
  })

  it('right dock: ArrowLeft grows, ArrowRight shrinks', () => {
    expect(dockResizeDelta('right', 'ArrowLeft')).toBe(DOCK_RESIZE_STEP)
    expect(dockResizeDelta('right', 'ArrowRight')).toBe(-DOCK_RESIZE_STEP)
  })

  it('left dock: ArrowRight grows, ArrowLeft shrinks', () => {
    expect(dockResizeDelta('left', 'ArrowRight')).toBe(DOCK_RESIZE_STEP)
    expect(dockResizeDelta('left', 'ArrowLeft')).toBe(-DOCK_RESIZE_STEP)
  })

  it('regression: bottom/right were previously inverted — Up/Left ≠ shrink', () => {
    // The old code shrank on Up/Left for every edge; grow must be positive now.
    expect(dockResizeDelta('bottom', 'ArrowUp')).toBeGreaterThan(0)
    expect(dockResizeDelta('right', 'ArrowLeft')).toBeGreaterThan(0)
  })

  it('ignores keys off the dock resize axis', () => {
    expect(dockResizeDelta('bottom', 'ArrowLeft')).toBe(0)
    expect(dockResizeDelta('bottom', 'ArrowRight')).toBe(0)
    expect(dockResizeDelta('right', 'ArrowUp')).toBe(0)
    expect(dockResizeDelta('left', 'ArrowDown')).toBe(0)
    expect(dockResizeDelta('bottom', 'Enter')).toBe(0)
  })

  it('honours a custom step', () => {
    expect(dockResizeDelta('bottom', 'ArrowUp', 0.05)).toBe(0.05)
    expect(dockResizeDelta('left', 'ArrowLeft', 0.05)).toBe(-0.05)
  })
})
