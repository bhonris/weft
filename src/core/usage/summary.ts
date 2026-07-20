/**
 * Pure aggregation + formatting for the status-bar usage readout. Turns
 * per-model {@link TokenUsage} into a {@link UsageSummary} (cost + token totals)
 * and renders the compact label / tooltip strings the UI shows.
 */
import type { UsageSummary } from '@shared/ipc/api-contract'
import { costForUsage, type TokenUsage } from './pricing'

export function emptySummary(): UsageSummary {
  return {
    costUsd: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    sessionCount: 0
  }
}

/**
 * Roll up per-model usage into a single summary. Cost is summed per model (rates
 * differ by model), so callers should merge all sessions' usage into one
 * per-model record first, then summarize once.
 */
export function summarize(
  byModel: Record<string, TokenUsage>,
  sessionCount = 0
): UsageSummary {
  const summary = emptySummary()
  summary.sessionCount = sessionCount
  for (const [model, usage] of Object.entries(byModel)) {
    summary.costUsd += costForUsage(usage, model)
    summary.inputTokens += usage.input
    summary.outputTokens += usage.output
    summary.cacheReadTokens += usage.cacheRead
    summary.cacheWriteTokens += usage.cacheWrite5m + usage.cacheWrite1h
  }
  summary.totalTokens =
    summary.inputTokens +
    summary.outputTokens +
    summary.cacheReadTokens +
    summary.cacheWriteTokens
  return summary
}

/** Compact token count, e.g. `840`, `128k`, `1.2M`. */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${Math.round(n)}`
}

/** Compact dollar amount, e.g. `$0.00`, `<$0.01`, `$0.42`, `$12.30`. */
export function formatUsd(n: number): string {
  if (n <= 0) return '$0.00'
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(2)}`
}

/** The status-bar label, e.g. `$0.42 · 128k tokens`. */
export function formatUsageLabel(summary: UsageSummary): string {
  return `${formatUsd(summary.costUsd)} · ${formatTokens(summary.totalTokens)} tokens`
}

/** The hover tooltip breakdown. */
export function formatUsageTooltip(summary: UsageSummary): string {
  const sessions = `${summary.sessionCount} Claude session${summary.sessionCount === 1 ? '' : 's'}`
  return (
    `Claude Code usage across ${sessions} — estimated ${formatUsd(summary.costUsd)}\n` +
    `${formatTokens(summary.inputTokens)} in · ${formatTokens(summary.outputTokens)} out · ` +
    `${formatTokens(summary.cacheReadTokens)} cache read · ${formatTokens(summary.cacheWriteTokens)} cache write`
  )
}
