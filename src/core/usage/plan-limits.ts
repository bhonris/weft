/**
 * Pure parser + formatters for Claude subscription plan limits — the data behind
 * Claude Code's `/usage` meters, fetched from `/api/oauth/usage` (see the main
 * `plan-limits-service`). Tolerant of the endpoint's undocumented, shifting
 * shape: missing windows become null, and both 0–1 and 0–100 utilizations and
 * both ISO-string and epoch reset times are accepted. No I/O.
 */
import type { PlanLimits, PlanWindow } from '@shared/ipc/api-contract'

interface RawWindow {
  utilization?: unknown
  resets_at?: unknown
}

/** Clamp to the 0–100 percent range. */
function clampPct(n: number): number {
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

/** Normalize a reset field to an ISO string, or null. */
function normalizeReset(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 0) return v
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Heuristic: values below ~year-2286-in-seconds are epoch seconds.
    const ms = v < 1e12 ? v * 1000 : v
    return new Date(ms).toISOString()
  }
  return null
}

/** Parse one usage window, or null when utilization is absent/invalid. */
export function parseWindow(raw: unknown): PlanWindow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as RawWindow
  const u = r.utilization
  if (typeof u !== 'number' || !Number.isFinite(u)) return null
  // The endpoint has shipped utilization as a fraction (0–1) and as a percent
  // (0–100); treat anything ≤ 1 as a fraction.
  const pct = u <= 1 ? u * 100 : u
  return { utilization: clampPct(pct), resetsAt: normalizeReset(r.resets_at) }
}

/**
 * Parse a `/api/oauth/usage` response body into {@link PlanLimits}. Unknown or
 * malformed input yields all-null windows (never throws).
 */
export function parsePlanLimits(raw: unknown, fetchedAt: string): PlanLimits {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    fiveHour: parseWindow(obj['five_hour']),
    sevenDay: parseWindow(obj['seven_day']),
    sevenDayOpus: parseWindow(obj['seven_day_opus']),
    fetchedAt,
    stale: false
  }
}

/** True when the response contained no usable window at all. */
export function isEmptyPlanLimits(limits: PlanLimits): boolean {
  return limits.fiveHour === null && limits.sevenDay === null && limits.sevenDayOpus === null
}

/** The highest utilization across all present windows (0 when none). */
export function maxUtilization(limits: PlanLimits): number {
  return [limits.fiveHour, limits.sevenDay, limits.sevenDayOpus].reduce(
    (max, w) => (w && w.utilization > max ? w.utilization : max),
    0
  )
}

/** `42%` — a whole-percent label for a utilization. */
export function formatUtilization(pct: number): string {
  return `${Math.round(pct)}%`
}

/**
 * Human "resets in …" from a reset ISO/null and an injected `now` (epoch ms).
 * Empty string when unknown or already elapsed.
 */
export function formatResetIn(resetsAt: string | null, now: number): string {
  if (!resetsAt) return ''
  const at = Date.parse(resetsAt)
  if (!Number.isFinite(at) || at <= now) return ''
  const mins = Math.round((at - now) / 60000)
  if (mins < 60) return `resets in ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) {
    const rem = mins % 60
    return rem > 0 ? `resets in ${hours}h ${rem}m` : `resets in ${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remH = hours % 24
  return remH > 0 ? `resets in ${days}d ${remH}h` : `resets in ${days}d`
}
