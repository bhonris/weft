import { join } from 'node:path'
import {
  encodeProjectDir,
  transcriptFileName,
  parseTranscriptDetail,
  rollupUsageByModel
} from '@core/usage/transcript'
import { summarize } from '@core/usage/summary'
import { latestSessionInfo } from '@core/usage/session-info'
import { mergeUsageInto, type TokenUsage } from '@core/usage/pricing'
import type { SessionInfo, UsageSummary } from '@shared/ipc/api-contract'

/** The minimal filesystem surface the service needs (injected for tests). */
export interface UsageFsLike {
  readFile(path: string, encoding: 'utf8'): Promise<string>
  stat(path: string): Promise<{ mtimeMs: number; size: number }>
  readdir(path: string): Promise<string[]>
}

/** A live claude session to aggregate usage for. */
export interface UsageSessionRef {
  sessionId: string
  cwd: string
}

interface CacheEntry {
  mtimeMs: number
  size: number
  byModel: Record<string, TokenUsage>
  /** The session's current model + effort (latest real turn), or null. */
  info: SessionInfo | null
}

/**
 * Reads Claude Code transcript files and aggregates their token usage into a
 * {@link UsageSummary}. A per-file cache keyed by (mtime, size) means repeated
 * polls only re-parse transcripts that actually changed. Every failure (missing
 * file, unreadable, bad JSON) degrades to "no usage for that session" — the
 * readout never throws. Read-only: it never writes under `~/.claude`.
 */
export class UsageService {
  private readonly cache = new Map<string, CacheEntry>()

  constructor(
    private readonly fs: UsageFsLike,
    /** Absolute path to `~/.claude/projects`. */
    private readonly projectsDir: string
  ) {}

  /** Aggregate usage across the given claude sessions. */
  async summarize(sessions: readonly UsageSessionRef[]): Promise<UsageSummary> {
    const merged: Record<string, TokenUsage> = {}
    let count = 0
    for (const session of sessions) {
      const byModel = await this.usageForSession(session)
      if (byModel) {
        mergeUsageInto(merged, byModel)
        count++
      }
    }
    return summarize(merged, count)
  }

  /**
   * The model + reasoning-effort a session is currently running, from its
   * transcript's latest real assistant turn. Null when there's no readable
   * transcript or no turn yet. Never throws.
   */
  async sessionInfo(session: UsageSessionRef): Promise<SessionInfo | null> {
    return (await this.resolveEntry(session))?.info ?? null
  }

  private async usageForSession(
    session: UsageSessionRef
  ): Promise<Record<string, TokenUsage> | null> {
    return (await this.resolveEntry(session))?.byModel ?? null
  }

  /**
   * Locate + parse a session's transcript into a cached {@link CacheEntry}
   * (usage-by-model + current info), or null when it can't be found/read. Tries
   * the deterministic encoded project dir first, then scans all project dirs
   * (the session id is a unique filename) to cover path-encoding edge cases.
   */
  private async resolveEntry(session: UsageSessionRef): Promise<CacheEntry | null> {
    const file = transcriptFileName(session.sessionId)
    const direct = join(this.projectsDir, encodeProjectDir(session.cwd), file)
    const byDirect = await this.readFile(direct)
    if (byDirect) return byDirect
    try {
      const dirs = await this.fs.readdir(this.projectsDir)
      for (const dir of dirs) {
        const entry = await this.readFile(join(this.projectsDir, dir, file))
        if (entry) return entry
      }
    } catch {
      /* projects dir missing — no data. */
    }
    return null
  }

  private async readFile(path: string): Promise<CacheEntry | null> {
    try {
      const { mtimeMs, size } = await this.fs.stat(path)
      const cached = this.cache.get(path)
      if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
        return cached
      }
      const text = await this.fs.readFile(path, 'utf8')
      // Parse once; derive both the usage roll-up and the current model/effort.
      const detail = parseTranscriptDetail(text)
      const entry: CacheEntry = {
        mtimeMs,
        size,
        byModel: rollupUsageByModel(detail.entries),
        info: latestSessionInfo(detail)
      }
      this.cache.set(path, entry)
      return entry
    } catch {
      return null
    }
  }
}
