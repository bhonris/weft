import { join } from 'node:path'
import {
  encodeProjectDir,
  transcriptFileName,
  parseTranscriptUsage
} from '@core/usage/transcript'
import { summarize } from '@core/usage/summary'
import { mergeUsageInto, type TokenUsage } from '@core/usage/pricing'
import type { UsageSummary } from '@shared/ipc/api-contract'

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

  private async usageForSession(
    session: UsageSessionRef
  ): Promise<Record<string, TokenUsage> | null> {
    const file = transcriptFileName(session.sessionId)
    // Fast path: the deterministic encoded project directory.
    const direct = join(this.projectsDir, encodeProjectDir(session.cwd), file)
    const byDirect = await this.readUsageFile(direct)
    if (byDirect) return byDirect
    // Fallback: the session id is a unique filename, so scan project dirs for it
    // (covers any path-encoding edge case the fast path misses).
    try {
      const dirs = await this.fs.readdir(this.projectsDir)
      for (const dir of dirs) {
        const byModel = await this.readUsageFile(join(this.projectsDir, dir, file))
        if (byModel) return byModel
      }
    } catch {
      /* projects dir missing — no usage. */
    }
    return null
  }

  private async readUsageFile(
    path: string
  ): Promise<Record<string, TokenUsage> | null> {
    try {
      const { mtimeMs, size } = await this.fs.stat(path)
      const cached = this.cache.get(path)
      if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
        return cached.byModel
      }
      const text = await this.fs.readFile(path, 'utf8')
      const byModel = parseTranscriptUsage(text)
      this.cache.set(path, { mtimeMs, size, byModel })
      return byModel
    } catch {
      return null
    }
  }
}
