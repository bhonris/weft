import { describe, it, expect, vi } from 'vitest'
import { join } from 'node:path'
import { UsageHistoryService, type HistoryFsLike } from './usage-history-service'

const PROJECTS = join('C:', 'Users', 'me', '.claude', 'projects')
const NOW = Date.parse('2026-07-20T12:00:00Z')

/** Build a one-line assistant transcript with a timestamp + usage. */
const line = (ts: string, model: string, input: number, uuid = ts): string =>
  JSON.stringify({
    type: 'assistant',
    uuid,
    timestamp: ts,
    cwd: 'C:\\repos\\proj',
    message: { model, usage: { input_tokens: input, output_tokens: 0 } }
  })

/** A fake fs over an in-memory tree of dir → { file → text }. */
function fakeFs(
  tree: Record<string, Record<string, string>>,
  opts: { mtime?: (path: string) => number } = {}
): HistoryFsLike & { reads: string[] } {
  const reads: string[] = []
  const mtimeOf = opts.mtime ?? (() => NOW - 1000)
  return {
    reads,
    async readdir(path: string): Promise<string[]> {
      if (path === PROJECTS) return Object.keys(tree)
      const dir = Object.keys(tree).find((d) => join(PROJECTS, d) === path)
      if (dir) return Object.keys(tree[dir]!)
      throw new Error('ENOTDIR')
    },
    async stat(path: string): Promise<{ mtimeMs: number; size: number }> {
      for (const [dir, files] of Object.entries(tree)) {
        for (const [name, text] of Object.entries(files)) {
          if (join(PROJECTS, dir, name) === path) return { mtimeMs: mtimeOf(path), size: text.length }
        }
      }
      throw new Error('ENOENT')
    },
    async readFile(path: string): Promise<string> {
      reads.push(path)
      for (const [dir, files] of Object.entries(tree)) {
        for (const [name, text] of Object.entries(files)) {
          if (join(PROJECTS, dir, name) === path) return text
        }
      }
      throw new Error('ENOENT')
    }
  }
}

describe('UsageHistoryService', () => {
  it('aggregates weekly totals and recent sessions across all projects', async () => {
    const fs = fakeFs({
      'proj-a': {
        's1.jsonl': [line('2026-07-19T10:00:00Z', 'claude-opus-4-8', 1000)].join('\n')
      },
      'proj-b': {
        's2.jsonl': [line('2026-07-18T10:00:00Z', 'claude-haiku-4-5', 500)].join('\n')
      }
    })
    const svc = new UsageHistoryService(fs, PROJECTS, () => NOW)
    const { weekly, sessions } = await svc.panel()

    expect(weekly.inputTokens).toBe(1500)
    expect(weekly.costUsd).toBeGreaterThan(0)
    expect(sessions.map((s) => s.sessionId).sort()).toEqual(['s1', 's2'])
    // Newest last-active first.
    expect(sessions[0]!.sessionId).toBe('s1')
  })

  it('excludes entries older than 7 days from the weekly total', async () => {
    const fs = fakeFs(
      {
        'proj-a': {
          'old.jsonl': [line('2026-07-01T00:00:00Z', 'claude-opus-4-8', 9999)].join('\n'),
          'new.jsonl': [line('2026-07-19T00:00:00Z', 'claude-opus-4-8', 10)].join('\n')
        }
      },
      // old.jsonl mtime is >7d ago so it is not even read for the weekly window,
      // but it is within the recent-scan set (so the session still lists).
      { mtime: (p) => (p.endsWith('old.jsonl') ? Date.parse('2026-07-01T00:00:00Z') : NOW - 1000) }
    )
    const svc = new UsageHistoryService(fs, PROJECTS, () => NOW)
    const { weekly, sessions } = await svc.panel()

    expect(weekly.inputTokens).toBe(10) // only the in-window entry
    expect(sessions.map((s) => s.sessionId)).toContain('old') // still listed as a session
  })

  it('caches parses by (mtime, size) so unchanged files are not re-read', async () => {
    const fs = fakeFs({
      'proj-a': { 's1.jsonl': [line('2026-07-19T10:00:00Z', 'claude-opus-4-8', 1000)].join('\n') }
    })
    const svc = new UsageHistoryService(fs, PROJECTS, () => NOW)
    await svc.panel()
    const firstReads = fs.reads.length
    await svc.panel()
    expect(fs.reads.length).toBe(firstReads) // second poll re-parsed nothing
  })

  it('returns an empty panel when the projects dir is missing', async () => {
    const fs: HistoryFsLike = {
      readdir: vi.fn(async () => {
        throw new Error('ENOENT')
      }),
      stat: vi.fn(),
      readFile: vi.fn()
    }
    const svc = new UsageHistoryService(fs, PROJECTS, () => NOW)
    const { weekly, sessions } = await svc.panel()
    expect(weekly.totalTokens).toBe(0)
    expect(sessions).toEqual([])
  })

  it('skips non-.jsonl entries and unreadable subdirectories', async () => {
    const fs = fakeFs({
      'proj-a': {
        's1.jsonl': [line('2026-07-19T10:00:00Z', 'claude-opus-4-8', 100)].join('\n'),
        'memory': '', // a subdir name (no .jsonl) — must be ignored
        'notes.txt': 'hello' // wrong extension — ignored
      }
    })
    const svc = new UsageHistoryService(fs, PROJECTS, () => NOW)
    const { sessions } = await svc.panel()
    expect(sessions.map((s) => s.sessionId)).toEqual(['s1'])
  })
})
