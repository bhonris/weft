/**
 * Derive a session's *current* model + reasoning-effort from its parsed
 * transcript. Pure — the file locating/reading lives in the main adapter.
 */
import type { SessionInfo } from '@shared/ipc/api-contract'
import type { TranscriptDetail } from './transcript'

/** Model id used for injected/synthetic turns — never the user's real selection. */
const SYNTHETIC = '<synthetic>'

/**
 * The model + effort from the most recent *real* assistant turn, or null when
 * the transcript has no such turn yet. Transcript entries are in chronological
 * (file) order, so the last non-synthetic entry is the current one.
 */
export function latestSessionInfo(detail: TranscriptDetail): SessionInfo | null {
  for (let i = detail.entries.length - 1; i >= 0; i--) {
    const entry = detail.entries[i]!
    if (entry.model === SYNTHETIC) continue
    return { model: entry.model, effort: entry.effort }
  }
  return null
}
