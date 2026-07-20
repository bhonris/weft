import { describe, it, expect } from 'vitest'
import { usageInWindow, weeklySummary, dailySummary, WEEK_MS, DAY_MS } from './weekly'
import { emptyUsage } from './pricing'
import type { TranscriptEntry } from './transcript'

const NOW = Date.parse('2026-07-20T12:00:00Z')

const entry = (ageMs: number, model: string, input: number): TranscriptEntry => ({
  timestamp: NOW - ageMs,
  model,
  usage: { ...emptyUsage(), input, output: 0 }
})

describe('usageInWindow', () => {
  it('includes only entries inside [now-window, now]', () => {
    const entries = [
      entry(DAY_MS, 'claude-opus-4-8', 100), // 1 day ago — in the week
      entry(WEEK_MS + DAY_MS, 'claude-opus-4-8', 999), // 8 days ago — out
      entry(-DAY_MS, 'claude-opus-4-8', 5) // in the future — out
    ]
    const out = usageInWindow(entries, NOW, WEEK_MS)
    expect(out['claude-opus-4-8']?.input).toBe(100)
  })

  it('drops entries with a null timestamp', () => {
    const entries: TranscriptEntry[] = [
      { timestamp: null, model: 'm', usage: { ...emptyUsage(), input: 7 } }
    ]
    expect(usageInWindow(entries, NOW, WEEK_MS)).toEqual({})
  })

  it('sums per model across entries', () => {
    const entries = [
      entry(DAY_MS, 'a', 10),
      entry(2 * DAY_MS, 'a', 5),
      entry(DAY_MS, 'b', 3)
    ]
    const out = usageInWindow(entries, NOW, WEEK_MS)
    expect(out['a']?.input).toBe(15)
    expect(out['b']?.input).toBe(3)
  })
})

describe('weeklySummary / dailySummary', () => {
  const entries = [
    entry(2 * DAY_MS, 'claude-opus-4-8', 1_000_000), // within week, not within day
    entry(1000, 'claude-opus-4-8', 2_000_000) // within both
  ]

  it('weekly sums the last 7 days', () => {
    const s = weeklySummary(entries, NOW)
    expect(s.inputTokens).toBe(3_000_000)
    expect(s.costUsd).toBeGreaterThan(0)
  })

  it('daily sums only the last 24h', () => {
    const s = dailySummary(entries, NOW)
    expect(s.inputTokens).toBe(2_000_000)
  })

  it('empty entries give a zero summary', () => {
    expect(weeklySummary([], NOW).totalTokens).toBe(0)
  })
})
