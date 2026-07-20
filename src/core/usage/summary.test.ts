import { describe, it, expect } from 'vitest'
import {
  emptySummary,
  summarize,
  formatTokens,
  formatUsd,
  formatUsageLabel,
  formatUsageTooltip
} from './summary'
import type { TokenUsage } from './pricing'

describe('emptySummary', () => {
  it('is all zeros', () => {
    expect(emptySummary()).toEqual({
      costUsd: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      sessionCount: 0
    })
  })
})

describe('summarize', () => {
  it('totals tokens and cost across models', () => {
    const byModel: Record<string, TokenUsage> = {
      'claude-opus-4-8': {
        input: 1_000_000,
        output: 0,
        cacheRead: 0,
        cacheWrite5m: 0,
        cacheWrite1h: 0
      },
      'claude-haiku-4-5': {
        input: 0,
        output: 1_000_000,
        cacheRead: 100,
        cacheWrite5m: 0,
        cacheWrite1h: 0
      }
    }
    const s = summarize(byModel, 2)
    expect(s.inputTokens).toBe(1_000_000)
    expect(s.outputTokens).toBe(1_000_000)
    expect(s.cacheReadTokens).toBe(100)
    expect(s.totalTokens).toBe(2_000_100)
    expect(s.sessionCount).toBe(2)
    // opus input $5 + haiku output $5 (+ trivial cache read) ≈ $10.00
    expect(s.costUsd).toBeCloseTo(5 + 5 + 100 * (1 / 1_000_000) * 0.1, 6)
  })

  it('defaults sessionCount to 0', () => {
    expect(summarize({}).sessionCount).toBe(0)
  })
})

describe('formatTokens', () => {
  it('formats sub-thousands, thousands, and millions', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(840)).toBe('840')
    expect(formatTokens(128_000)).toBe('128k')
    expect(formatTokens(1_200_000)).toBe('1.2M')
    expect(formatTokens(12_000_000)).toBe('12M')
  })
})

describe('formatUsd', () => {
  it('formats zero, sub-cent, and normal amounts', () => {
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(-1)).toBe('$0.00')
    expect(formatUsd(0.004)).toBe('<$0.01')
    expect(formatUsd(0.42)).toBe('$0.42')
    expect(formatUsd(12.3)).toBe('$12.30')
  })
})

describe('formatUsageLabel / formatUsageTooltip', () => {
  it('renders the compact label', () => {
    const s = { ...emptySummary(), costUsd: 0.42, totalTokens: 128_000 }
    expect(formatUsageLabel(s)).toBe('$0.42 · 128k tokens')
  })

  it('renders a breakdown tooltip and pluralizes sessions', () => {
    const one = formatUsageTooltip({ ...emptySummary(), sessionCount: 1 })
    expect(one).toContain('1 Claude session ')
    const many = formatUsageTooltip({
      ...emptySummary(),
      sessionCount: 3,
      costUsd: 1,
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 30,
      cacheWriteTokens: 40
    })
    expect(many).toContain('3 Claude sessions')
    expect(many).toContain('10 in · 20 out · 30 cache read · 40 cache write')
  })
})
