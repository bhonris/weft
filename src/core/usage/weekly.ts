/**
 * Pure time-windowed aggregation of transcript usage. Given timestamped
 * {@link TranscriptEntry}s and a "now" (injected — no ambient clock), sum the
 * usage that falls inside a rolling window into a {@link UsageSummary}.
 */
import { emptyUsage, addUsage, type TokenUsage } from './pricing'
import { summarize } from './summary'
import type { TranscriptEntry } from './transcript'
import type { UsageSummary } from '@shared/ipc/api-contract'

export const DAY_MS = 24 * 60 * 60 * 1000
export const WEEK_MS = 7 * DAY_MS

/** Per-model usage from entries whose timestamp is within `[now-windowMs, now]`. */
export function usageInWindow(
  entries: readonly TranscriptEntry[],
  now: number,
  windowMs: number
): Record<string, TokenUsage> {
  const byModel: Record<string, TokenUsage> = {}
  const cutoff = now - windowMs
  for (const e of entries) {
    if (e.timestamp === null || e.timestamp < cutoff || e.timestamp > now) continue
    byModel[e.model] = addUsage(byModel[e.model] ?? emptyUsage(), e.usage)
  }
  return byModel
}

/** Summarize usage over the last `windowMs` before `now`. */
export function windowSummary(
  entries: readonly TranscriptEntry[],
  now: number,
  windowMs: number
): UsageSummary {
  return summarize(usageInWindow(entries, now, windowMs))
}

/** Rolling 7-day usage summary. */
export function weeklySummary(entries: readonly TranscriptEntry[], now: number): UsageSummary {
  return windowSummary(entries, now, WEEK_MS)
}

/** Rolling 24-hour usage summary (today-ish). */
export function dailySummary(entries: readonly TranscriptEntry[], now: number): UsageSummary {
  return windowSummary(entries, now, DAY_MS)
}
