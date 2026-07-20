import { describe, it, expect } from 'vitest'
import {
  emptyUsage,
  addUsage,
  mergeUsageInto,
  priceForModel,
  costForUsage,
  DEFAULT_PRICE,
  type TokenUsage
} from './pricing'

describe('emptyUsage / addUsage', () => {
  it('starts at all zeros', () => {
    expect(emptyUsage()).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite5m: 0,
      cacheWrite1h: 0
    })
  })

  it('adds field-wise', () => {
    const a: TokenUsage = { input: 1, output: 2, cacheRead: 3, cacheWrite5m: 4, cacheWrite1h: 5 }
    const b: TokenUsage = { input: 10, output: 20, cacheRead: 30, cacheWrite5m: 40, cacheWrite1h: 50 }
    expect(addUsage(a, b)).toEqual({
      input: 11,
      output: 22,
      cacheRead: 33,
      cacheWrite5m: 44,
      cacheWrite1h: 55
    })
  })
})

describe('mergeUsageInto', () => {
  it('accumulates per-model usage into the target', () => {
    const target: Record<string, TokenUsage> = {
      'claude-opus-4-8': { input: 5, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }
    }
    mergeUsageInto(target, {
      'claude-opus-4-8': { input: 5, output: 1, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
      'claude-haiku-4-5': { input: 2, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }
    })
    expect(target['claude-opus-4-8']!.input).toBe(10)
    expect(target['claude-opus-4-8']!.output).toBe(1)
    expect(target['claude-haiku-4-5']!.input).toBe(2)
  })
})

describe('priceForModel', () => {
  it('maps each model family to its rate (incl. dated snapshots)', () => {
    expect(priceForModel('claude-opus-4-8')).toEqual({ input: 5, output: 25 })
    expect(priceForModel('claude-opus-4-1-20250805')).toEqual({ input: 15, output: 75 })
    expect(priceForModel('claude-3-opus-20240229')).toEqual({ input: 15, output: 75 })
    expect(priceForModel('claude-fable-5')).toEqual({ input: 10, output: 50 })
    expect(priceForModel('claude-sonnet-5')).toEqual({ input: 3, output: 15 })
    expect(priceForModel('claude-sonnet-4-5-20250929')).toEqual({ input: 3, output: 15 })
    expect(priceForModel('claude-haiku-4-5')).toEqual({ input: 1, output: 5 })
    expect(priceForModel('claude-3-5-haiku-20241022')).toEqual({ input: 0.8, output: 4 })
    expect(priceForModel('claude-3-haiku-20240307')).toEqual({ input: 0.25, output: 1.25 })
  })

  it('falls back to the default rate for unknown models', () => {
    expect(priceForModel('some-future-model')).toEqual(DEFAULT_PRICE)
  })
})

describe('costForUsage', () => {
  it('prices input, output, and cache tiers at their multipliers', () => {
    // Opus 4.8: input $5/1M, output $25/1M.
    const usage: TokenUsage = {
      input: 1_000_000,
      output: 1_000_000,
      cacheRead: 1_000_000, // 0.1x input = $0.50
      cacheWrite5m: 1_000_000, // 1.25x input = $6.25
      cacheWrite1h: 1_000_000 // 2x input = $10.00
    }
    // 5 + 25 + 0.5 + 6.25 + 10 = 46.75
    expect(costForUsage(usage, 'claude-opus-4-8')).toBeCloseTo(46.75, 6)
  })

  it('is zero for empty usage', () => {
    expect(costForUsage(emptyUsage(), 'claude-opus-4-8')).toBe(0)
  })
})
