import { describe, it, expect, vi } from 'vitest'
import { join } from 'node:path'
import { UsageService, type UsageFsLike } from './usage-service'
import { encodeProjectDir, transcriptFileName } from '@core/usage/transcript'

const PROJECTS = '/projects'

interface FileEntry {
  content: string
  mtimeMs: number
  size: number
}

/** In-memory fs keyed by the exact join()-produced path, with call spies. */
function fakeFs(files: Map<string, FileEntry>, dirs: string[] = []) {
  const readFile = vi.fn(async (path: string) => {
    const f = files.get(path)
    if (!f) throw new Error('ENOENT')
    return f.content
  })
  const stat = vi.fn(async (path: string) => {
    const f = files.get(path)
    if (!f) throw new Error('ENOENT')
    return { mtimeMs: f.mtimeMs, size: f.size }
  })
  const readdir = vi.fn(async (path: string) => {
    if (path !== PROJECTS) throw new Error('ENOENT')
    return dirs
  })
  const fs: UsageFsLike = { readFile, stat, readdir }
  return { fs, readFile, stat, readdir }
}

const line = (model: string, usage: object): string =>
  JSON.stringify({ type: 'assistant', uuid: `${Math.random()}`, message: { model, usage } })

const directPath = (cwd: string, sessionId: string): string =>
  join(PROJECTS, encodeProjectDir(cwd), transcriptFileName(sessionId))

describe('UsageService', () => {
  it('reads a session transcript and aggregates cost + tokens', async () => {
    const path = directPath('C:/p', 's1')
    const content = line('claude-opus-4-8', { input_tokens: 1_000_000, output_tokens: 0 })
    const { fs } = fakeFs(new Map([[path, { content, mtimeMs: 1, size: content.length }]]))
    const svc = new UsageService(fs, PROJECTS)

    const summary = await svc.summarize([{ sessionId: 's1', cwd: 'C:/p' }])
    expect(summary.sessionCount).toBe(1)
    expect(summary.inputTokens).toBe(1_000_000)
    expect(summary.costUsd).toBeCloseTo(5, 6)
  })

  it('aggregates across multiple sessions (all-sessions total)', async () => {
    const p1 = directPath('C:/a', 's1')
    const p2 = directPath('C:/b', 's2')
    const c1 = line('claude-opus-4-8', { input_tokens: 100, output_tokens: 0 })
    const c2 = line('claude-haiku-4-5', { input_tokens: 200, output_tokens: 0 })
    const { fs } = fakeFs(
      new Map([
        [p1, { content: c1, mtimeMs: 1, size: c1.length }],
        [p2, { content: c2, mtimeMs: 1, size: c2.length }]
      ])
    )
    const svc = new UsageService(fs, PROJECTS)
    const summary = await svc.summarize([
      { sessionId: 's1', cwd: 'C:/a' },
      { sessionId: 's2', cwd: 'C:/b' }
    ])
    expect(summary.sessionCount).toBe(2)
    expect(summary.inputTokens).toBe(300)
  })

  it('caches by mtime+size and only re-reads when the file changes', async () => {
    const path = directPath('C:/p', 's1')
    const content = line('claude-opus-4-8', { input_tokens: 10, output_tokens: 0 })
    const files = new Map([[path, { content, mtimeMs: 1, size: content.length }]])
    const { fs, readFile } = fakeFs(files)
    const svc = new UsageService(fs, PROJECTS)

    await svc.summarize([{ sessionId: 's1', cwd: 'C:/p' }])
    await svc.summarize([{ sessionId: 's1', cwd: 'C:/p' }])
    expect(readFile).toHaveBeenCalledTimes(1) // second call served from cache

    // Simulate an append: bump mtime + size → re-read.
    const updated = content + '\n' + line('claude-opus-4-8', { input_tokens: 5, output_tokens: 0 })
    files.set(path, { content: updated, mtimeMs: 2, size: updated.length })
    const summary = await svc.summarize([{ sessionId: 's1', cwd: 'C:/p' }])
    expect(readFile).toHaveBeenCalledTimes(2)
    expect(summary.inputTokens).toBe(15)
  })

  it('falls back to scanning project dirs when the encoded path misses', async () => {
    // File lives under an unexpected dir name; the direct path won't resolve.
    const scanned = join(PROJECTS, 'weird-dir', transcriptFileName('s1'))
    const content = line('claude-opus-4-8', { input_tokens: 42, output_tokens: 0 })
    const { fs, readdir } = fakeFs(
      new Map([[scanned, { content, mtimeMs: 1, size: content.length }]]),
      ['weird-dir']
    )
    const svc = new UsageService(fs, PROJECTS)
    const summary = await svc.summarize([{ sessionId: 's1', cwd: 'C:/nomatch' }])
    expect(readdir).toHaveBeenCalled()
    expect(summary.sessionCount).toBe(1)
    expect(summary.inputTokens).toBe(42)
  })

  it('contributes nothing when a transcript is missing entirely', async () => {
    const { fs } = fakeFs(new Map(), []) // readdir returns [] → nothing found
    const svc = new UsageService(fs, PROJECTS)
    const summary = await svc.summarize([{ sessionId: 's1', cwd: 'C:/p' }])
    expect(summary.sessionCount).toBe(0)
    expect(summary.totalTokens).toBe(0)
  })

  it('degrades gracefully when the projects dir cannot be read', async () => {
    const readFile = vi.fn(async () => {
      throw new Error('ENOENT')
    })
    const stat = vi.fn(async () => {
      throw new Error('ENOENT')
    })
    const readdir = vi.fn(async () => {
      throw new Error('EACCES')
    })
    const svc = new UsageService({ readFile, stat, readdir }, PROJECTS)
    const summary = await svc.summarize([{ sessionId: 's1', cwd: 'C:/p' }])
    expect(summary.sessionCount).toBe(0)
  })
})

/** An assistant line carrying a top-level effort tier + a timestamp for ordering. */
const turn = (model: string, effort: string, ts: string): string =>
  JSON.stringify({
    type: 'assistant',
    uuid: `${model}-${ts}`,
    timestamp: ts,
    effort,
    message: { model, usage: { input_tokens: 1, output_tokens: 0 } }
  })

describe('UsageService.sessionInfo', () => {
  it('returns the latest turn\'s model + effort from the direct path', async () => {
    const path = directPath('C:/p', 's1')
    const content = [
      turn('claude-sonnet-5', 'medium', '2026-07-20T10:00:00Z'),
      turn('claude-opus-4-8', 'high', '2026-07-20T11:00:00Z')
    ].join('\n')
    const { fs } = fakeFs(new Map([[path, { content, mtimeMs: 1, size: content.length }]]))
    const svc = new UsageService(fs, PROJECTS)

    expect(await svc.sessionInfo({ sessionId: 's1', cwd: 'C:/p' })).toEqual({
      model: 'claude-opus-4-8',
      effort: 'high'
    })
  })

  it('finds the transcript via the fallback dir scan', async () => {
    const scanned = join(PROJECTS, 'weird-dir', transcriptFileName('s1'))
    const content = turn('claude-fable-5', 'low', '2026-07-20T10:00:00Z')
    const { fs } = fakeFs(
      new Map([[scanned, { content, mtimeMs: 1, size: content.length }]]),
      ['weird-dir']
    )
    const svc = new UsageService(fs, PROJECTS)
    expect(await svc.sessionInfo({ sessionId: 's1', cwd: 'C:/nomatch' })).toEqual({
      model: 'claude-fable-5',
      effort: 'low'
    })
  })

  it('returns null when the transcript is missing', async () => {
    const { fs } = fakeFs(new Map(), [])
    const svc = new UsageService(fs, PROJECTS)
    expect(await svc.sessionInfo({ sessionId: 's1', cwd: 'C:/p' })).toBeNull()
  })

  it('shares the mtime+size cache with summarize (one read for both)', async () => {
    const path = directPath('C:/p', 's1')
    const content = turn('claude-opus-4-8', 'high', '2026-07-20T10:00:00Z')
    const { fs, readFile } = fakeFs(
      new Map([[path, { content, mtimeMs: 1, size: content.length }]])
    )
    const svc = new UsageService(fs, PROJECTS)

    await svc.summarize([{ sessionId: 's1', cwd: 'C:/p' }])
    await svc.sessionInfo({ sessionId: 's1', cwd: 'C:/p' })
    expect(readFile).toHaveBeenCalledTimes(1) // info served from the usage parse
  })
})
