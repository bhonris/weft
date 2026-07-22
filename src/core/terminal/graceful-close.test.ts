import { describe, it, expect } from 'vitest'
import { gracefulCloseSequence, GRACEFUL_CLOSE_TIMEOUT_MS } from './graceful-close'

describe('gracefulCloseSequence', () => {
  it('asks Claude Code to exit with two Ctrl-C presses, with a pause between', () => {
    const steps = gracefulCloseSequence('claude')
    expect(steps.map((s) => s.data)).toEqual(['\x03', '\x03'])
    // The first press needs a beat to land (interrupt/clear) before the second.
    expect(steps[0]!.pauseMs).toBeGreaterThan(0)
    expect(steps[1]!.pauseMs).toBe(0)
  })

  it('has no sequence for a plain shell (it is just killed)', () => {
    expect(gracefulCloseSequence('shell')).toEqual([])
  })

  it('treats any unknown command like a shell — no sequence', () => {
    expect(gracefulCloseSequence('bash')).toEqual([])
    expect(gracefulCloseSequence('')).toEqual([])
  })

  it('exposes a bounded, positive grace timeout', () => {
    expect(GRACEFUL_CLOSE_TIMEOUT_MS).toBeGreaterThan(0)
    expect(GRACEFUL_CLOSE_TIMEOUT_MS).toBeLessThanOrEqual(5000)
  })
})
