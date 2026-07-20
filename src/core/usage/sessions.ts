/**
 * Pure per-session roll-ups for the Usage panel's "recent sessions" list. Turns
 * parsed transcript detail into {@link SessionUsage} rows (cost, tokens, model,
 * project, last-active), sorted newest-first. No I/O — the main adapter reads
 * files and hands entries here.
 */
import { costForUsage, addUsage, emptyUsage, type TokenUsage } from './pricing'
import type { TranscriptEntry } from './transcript'
import type { SessionUsage } from '@shared/ipc/api-contract'

/** A session's raw material: its id, recorded cwd, and its usage entries. */
export interface RawSession {
  sessionId: string
  cwd: string | null
  entries: readonly TranscriptEntry[]
}

/** Display name for a project cwd — its final path segment, or 'unknown'. */
export function projectName(cwd: string | null): string {
  if (!cwd) return 'unknown'
  const parts = cwd.split(/[\\/]/).filter((p) => p.length > 0)
  return parts.length > 0 ? (parts[parts.length - 1] as string) : cwd
}

function totalTokens(u: TokenUsage): number {
  return u.input + u.output + u.cacheRead + u.cacheWrite5m + u.cacheWrite1h
}

/** The model that accounts for the most tokens across a per-model record. */
function dominantModel(byModel: Record<string, TokenUsage>): string {
  let best = ''
  let bestTokens = -1
  for (const [model, u] of Object.entries(byModel)) {
    const t = totalTokens(u)
    if (t > bestTokens) {
      bestTokens = t
      best = model
    }
  }
  return best
}

/** Roll a session's entries into one row, or null when it has no usage. */
export function sessionUsage(s: RawSession): SessionUsage | null {
  if (s.entries.length === 0) return null
  const byModel: Record<string, TokenUsage> = {}
  let lastActive = 0
  for (const e of s.entries) {
    byModel[e.model] = addUsage(byModel[e.model] ?? emptyUsage(), e.usage)
    if (e.timestamp !== null && e.timestamp > lastActive) lastActive = e.timestamp
  }
  let costUsd = 0
  let tokens = 0
  for (const [model, u] of Object.entries(byModel)) {
    costUsd += costForUsage(u, model)
    tokens += totalTokens(u)
  }
  return {
    sessionId: s.sessionId,
    project: projectName(s.cwd),
    model: dominantModel(byModel),
    costUsd,
    totalTokens: tokens,
    lastActive: lastActive > 0 ? new Date(lastActive).toISOString() : ''
  }
}

/**
 * Build the recent-sessions list: every session with usage, newest last-active
 * first, capped at `limit`.
 */
export function recentSessions(sessions: readonly RawSession[], limit = 40): SessionUsage[] {
  return sessions
    .map(sessionUsage)
    .filter((r): r is SessionUsage => r !== null)
    .sort((a, b) => b.lastActive.localeCompare(a.lastActive))
    .slice(0, limit)
}
