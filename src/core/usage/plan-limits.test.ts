import { describe, it, expect } from 'vitest'
import {
  parseWindow,
  parsePlanLimits,
  isEmptyPlanLimits,
  maxUtilization,
  formatUtilization,
  formatResetIn
} from './plan-limits'

const FETCHED = '2026-07-20T12:00:00.000Z'
const NOW = Date.parse(FETCHED)

describe('parseWindow', () => {
  it('accepts a percent (0-100) utilization with an ISO reset', () => {
    expect(parseWindow({ utilization: 42, resets_at: '2026-07-20T17:00:00Z' })).toEqual({
      utilization: 42,
      resetsAt: '2026-07-20T17:00:00Z'
    })
  })

  it('treats a 0-1 fraction as a percentage', () => {
    expect(parseWindow({ utilization: 0.37 })?.utilization).toBeCloseTo(37)
  })

  it('clamps out-of-range percentages', () => {
    expect(parseWindow({ utilization: 150 })?.utilization).toBe(100)
    expect(parseWindow({ utilization: -1 })?.utilization).toBe(0) // -1 → fraction path → -100 → clamp 0
  })

  it('converts an epoch-seconds reset to ISO', () => {
    const secs = Math.floor(Date.parse('2026-07-20T17:00:00Z') / 1000)
    expect(parseWindow({ utilization: 10, resets_at: secs })?.resetsAt).toBe(
      '2026-07-20T17:00:00.000Z'
    )
  })

  it('returns null for missing/invalid utilization or non-objects', () => {
    expect(parseWindow(null)).toBeNull()
    expect(parseWindow({})).toBeNull()
    expect(parseWindow({ utilization: 'lots' })).toBeNull()
    expect(parseWindow({ utilization: NaN })).toBeNull()
  })
})

describe('parsePlanLimits', () => {
  it('maps the three windows and stamps fetchedAt', () => {
    const limits = parsePlanLimits(
      {
        five_hour: { utilization: 20, resets_at: '2026-07-20T15:00:00Z' },
        seven_day: { utilization: 60 },
        seven_day_opus: { utilization: 80 }
      },
      FETCHED
    )
    expect(limits.fiveHour?.utilization).toBe(20)
    expect(limits.sevenDay?.utilization).toBe(60)
    expect(limits.sevenDayOpus?.utilization).toBe(80)
    expect(limits.fetchedAt).toBe(FETCHED)
    expect(limits.stale).toBe(false)
  })

  it('yields all-null windows for garbage input without throwing', () => {
    const limits = parsePlanLimits('nonsense', FETCHED)
    expect(isEmptyPlanLimits(limits)).toBe(true)
  })
})

describe('maxUtilization', () => {
  it('returns the highest present window, 0 when none', () => {
    const limits = parsePlanLimits({ five_hour: { utilization: 30 }, seven_day: { utilization: 71 } }, FETCHED)
    expect(maxUtilization(limits)).toBe(71)
    expect(maxUtilization(parsePlanLimits({}, FETCHED))).toBe(0)
  })
})

describe('formatUtilization', () => {
  it('rounds to a whole percent', () => {
    expect(formatUtilization(42.6)).toBe('43%')
  })
})

describe('formatResetIn', () => {
  it('formats minutes, hours, and days', () => {
    expect(formatResetIn('2026-07-20T12:40:00Z', NOW)).toBe('resets in 40m')
    expect(formatResetIn('2026-07-20T15:30:00Z', NOW)).toBe('resets in 3h 30m')
    expect(formatResetIn('2026-07-20T15:00:00Z', NOW)).toBe('resets in 3h')
    expect(formatResetIn('2026-07-22T18:00:00Z', NOW)).toBe('resets in 2d 6h')
    expect(formatResetIn('2026-07-22T12:00:00Z', NOW)).toBe('resets in 2d')
  })

  it('returns empty for null, past, or unparseable resets', () => {
    expect(formatResetIn(null, NOW)).toBe('')
    expect(formatResetIn('2026-07-20T11:00:00Z', NOW)).toBe('') // past
    expect(formatResetIn('not-a-date', NOW)).toBe('')
  })
})
