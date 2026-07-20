/**
 * Pure helpers for locating and parsing Claude Code transcript files. No I/O —
 * `parseTranscriptUsage` takes the file text; path resolution/reading lives in
 * the main `UsageService` adapter.
 */
import { emptyUsage, addUsage, type TokenUsage } from './pricing'

/**
 * Claude Code encodes a project's cwd into its `~/.claude/projects` directory
 * name by replacing every non-alphanumeric character with `-`. E.g.
 * `C:\repos\claude-terminal-ide` → `C--repos-claude-terminal-ide`, and
 * `C:\repos\x\.claude\wt` → `C--repos-x--claude-wt`.
 */
export function encodeProjectDir(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, '-')
}

/** The transcript filename for a pinned session id. */
export function transcriptFileName(sessionId: string): string {
  return `${sessionId}.jsonl`
}

/** A finite, non-negative number, or 0. */
function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

interface RawUsage {
  input_tokens?: unknown
  output_tokens?: unknown
  cache_read_input_tokens?: unknown
  cache_creation_input_tokens?: unknown
  cache_creation?: {
    ephemeral_5m_input_tokens?: unknown
    ephemeral_1h_input_tokens?: unknown
  }
}

/** Convert a transcript `message.usage` object into a {@link TokenUsage}. */
function extractUsage(raw: RawUsage): TokenUsage {
  const breakdown = raw.cache_creation
  const has5m = breakdown?.ephemeral_5m_input_tokens !== undefined
  const has1h = breakdown?.ephemeral_1h_input_tokens !== undefined
  // Prefer the 5m/1h ephemeral split when present; otherwise treat the whole
  // cache-creation total as a 5-minute write (the common default).
  const cacheWrite5m =
    has5m || has1h ? num(breakdown?.ephemeral_5m_input_tokens) : num(raw.cache_creation_input_tokens)
  const cacheWrite1h = has5m || has1h ? num(breakdown?.ephemeral_1h_input_tokens) : 0
  return {
    input: num(raw.input_tokens),
    output: num(raw.output_tokens),
    cacheRead: num(raw.cache_read_input_tokens),
    cacheWrite5m,
    cacheWrite1h
  }
}

interface AssistantLine {
  type?: unknown
  uuid?: unknown
  timestamp?: unknown
  cwd?: unknown
  message?: { model?: unknown; usage?: unknown }
}

/** One deduped assistant turn: when it happened, its model, and its usage. */
export interface TranscriptEntry {
  /** Epoch ms of the turn, or null when the line had no parseable timestamp. */
  timestamp: number | null
  model: string
  usage: TokenUsage
}

/** The full parse of one transcript: its usage entries plus the session's cwd. */
export interface TranscriptDetail {
  entries: TranscriptEntry[]
  /** The working directory recorded in the transcript, or null. */
  cwd: string | null
}

/**
 * Parse a transcript's assistant turns into timestamped {@link TranscriptEntry}s
 * (plus the recorded cwd). Non-JSON and non-assistant lines are skipped;
 * assistant lines are deduped by `uuid` so a re-appended line is never counted
 * twice. This is the single parse path — {@link parseTranscriptUsage} rolls it up.
 */
export function parseTranscriptDetail(text: string): TranscriptDetail {
  const entries: TranscriptEntry[] = []
  const seen = new Set<string>()
  let cwd: string | null = null
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    let entry: AssistantLine
    try {
      entry = JSON.parse(trimmed) as AssistantLine
    } catch {
      continue
    }
    if (cwd === null && typeof entry.cwd === 'string') cwd = entry.cwd
    if (entry.type !== 'assistant') continue
    const message = entry.message
    if (!message || typeof message.model !== 'string' || typeof message.usage !== 'object' || message.usage === null) {
      continue
    }
    if (typeof entry.uuid === 'string') {
      if (seen.has(entry.uuid)) continue
      seen.add(entry.uuid)
    }
    const ms = typeof entry.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN
    entries.push({
      timestamp: Number.isFinite(ms) ? ms : null,
      model: message.model,
      usage: extractUsage(message.usage as RawUsage)
    })
  }
  return { entries, cwd }
}

/**
 * Sum a transcript's assistant-message token usage, grouped by model id.
 * Convenience roll-up over {@link parseTranscriptDetail}.
 */
export function parseTranscriptUsage(text: string): Record<string, TokenUsage> {
  const byModel: Record<string, TokenUsage> = {}
  for (const { model, usage } of parseTranscriptDetail(text).entries) {
    byModel[model] = addUsage(byModel[model] ?? emptyUsage(), usage)
  }
  return byModel
}
