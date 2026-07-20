import { join } from 'node:path'
import { parseTranscriptDetail, type TranscriptEntry } from '@core/usage/transcript'
import { weeklySummary } from '@core/usage/weekly'
import { recentSessions, type RawSession } from '@core/usage/sessions'
import type { UsageSummary, SessionUsage } from '@shared/ipc/api-contract'

/** The filesystem surface the service needs (injected for tests). */
export interface HistoryFsLike {
  readFile(path: string, encoding: 'utf8'): Promise<string>
  stat(path: string): Promise<{ mtimeMs: number; size: number }>
  readdir(path: string): Promise<string[]>
}

/** A parsed transcript, cached by (mtime, size) so unchanged files aren't re-read. */
interface CacheEntry {
  mtimeMs: number
  size: number
  entries: TranscriptEntry[]
  cwd: string | null
}

/** One discovered transcript file on disk. */
interface FileRef {
  path: string
  sessionId: string
  mtimeMs: number
  size: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
/** How many recent sessions to parse (a superset of what the list shows). */
const SESSION_SCAN_LIMIT = 80
/** How many rows the recent-sessions list ultimately shows. */
const SESSION_LIST_LIMIT = 40

/**
 * Reads ALL Claude Code transcripts under `~/.claude/projects` and aggregates
 * them into the Usage panel's history: a rolling-7-day cost/token summary and a
 * recent-sessions list, both across every project. A per-file (mtime, size)
 * cache means repeated polls only re-parse transcripts that actually changed.
 * Read-only — never writes under `~/.claude`; every failure degrades to "less
 * data", never a throw. Owns no PTY state.
 */
export class UsageHistoryService {
  private readonly cache = new Map<string, CacheEntry>()

  constructor(
    private readonly fs: HistoryFsLike,
    /** Absolute path to `~/.claude/projects`. */
    private readonly projectsDir: string,
    /** Injected clock (epoch ms) so windowing is deterministic in tests. */
    private readonly now: () => number
  ) {}

  /** The weekly summary + recent-sessions list across all projects. */
  async panel(): Promise<{ weekly: UsageSummary; sessions: SessionUsage[] }> {
    const now = this.now()
    const files = await this.discover()
    // Newest first — the recent list and the (small) weekly set both want these.
    files.sort((a, b) => b.mtimeMs - a.mtimeMs)

    // A file untouched for over a week cannot hold entries in the 7-day window,
    // so only those (plus the recent set) need parsing.
    const weekCutoff = now - WEEK_MS
    const toParse = new Map<string, FileRef>()
    for (const f of files.slice(0, SESSION_SCAN_LIMIT)) toParse.set(f.path, f)
    for (const f of files) if (f.mtimeMs >= weekCutoff) toParse.set(f.path, f)

    const parsed = new Map<string, CacheEntry>()
    for (const f of toParse.values()) {
      const entry = await this.parseFile(f)
      if (entry) parsed.set(f.path, entry)
    }

    // Weekly: every entry from every parsed file, windowed to the last 7 days.
    const allEntries: TranscriptEntry[] = []
    for (const entry of parsed.values()) allEntries.push(...entry.entries)
    const weekly = weeklySummary(allEntries, now)

    // Sessions: the recent-scan set, rolled up per session.
    const rawSessions: RawSession[] = []
    for (const f of files.slice(0, SESSION_SCAN_LIMIT)) {
      const entry = parsed.get(f.path)
      if (entry) {
        rawSessions.push({ sessionId: f.sessionId, cwd: entry.cwd, entries: entry.entries })
      }
    }
    const sessions = recentSessions(rawSessions, SESSION_LIST_LIMIT)

    return { weekly, sessions }
  }

  /** Enumerate every `*.jsonl` transcript under each project directory. */
  private async discover(): Promise<FileRef[]> {
    let dirs: string[]
    try {
      dirs = await this.fs.readdir(this.projectsDir)
    } catch {
      return [] // projects dir missing — no history.
    }
    const out: FileRef[] = []
    for (const dir of dirs) {
      const dirPath = join(this.projectsDir, dir)
      let names: string[]
      try {
        names = await this.fs.readdir(dirPath)
      } catch {
        continue // not a directory / unreadable — skip.
      }
      for (const name of names) {
        if (!name.endsWith('.jsonl')) continue
        const path = join(dirPath, name)
        try {
          const { mtimeMs, size } = await this.fs.stat(path)
          out.push({ path, sessionId: name.slice(0, -'.jsonl'.length), mtimeMs, size })
        } catch {
          /* vanished between readdir and stat — skip. */
        }
      }
    }
    return out
  }

  /** Parse one transcript, using the (mtime, size) cache when unchanged. */
  private async parseFile(f: FileRef): Promise<CacheEntry | null> {
    const cached = this.cache.get(f.path)
    if (cached && cached.mtimeMs === f.mtimeMs && cached.size === f.size) return cached
    try {
      const text = await this.fs.readFile(f.path, 'utf8')
      const { entries, cwd } = parseTranscriptDetail(text)
      const entry: CacheEntry = { mtimeMs: f.mtimeMs, size: f.size, entries, cwd }
      this.cache.set(f.path, entry)
      return entry
    } catch {
      return null
    }
  }
}
