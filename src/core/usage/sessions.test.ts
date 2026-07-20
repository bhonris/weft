import { describe, it, expect } from 'vitest'
import { projectName, sessionUsage, recentSessions, type RawSession } from './sessions'
import { emptyUsage } from './pricing'
import type { TranscriptEntry } from './transcript'

const at = (iso: string): number => Date.parse(iso)

const entry = (iso: string | null, model: string, input: number, output = 0): TranscriptEntry => ({
  timestamp: iso === null ? null : at(iso),
  model,
  usage: { ...emptyUsage(), input, output }
})

describe('projectName', () => {
  it('takes the final segment of a windows path', () => {
    expect(projectName('C:\\repos\\claude-terminal-ide\\weft')).toBe('weft')
  })
  it('takes the final segment of a posix path', () => {
    expect(projectName('/home/u/proj')).toBe('proj')
  })
  it('falls back to unknown for null', () => {
    expect(projectName(null)).toBe('unknown')
  })
})

describe('sessionUsage', () => {
  it('rolls up cost, tokens, dominant model, and last-active', () => {
    const s: RawSession = {
      sessionId: 's1',
      cwd: '/home/u/proj',
      entries: [
        entry('2026-07-20T10:00:00Z', 'claude-opus-4-8', 1000, 500),
        entry('2026-07-20T11:30:00Z', 'claude-haiku-4-5', 10, 10), // fewer tokens
        entry('2026-07-20T09:00:00Z', 'claude-opus-4-8', 200, 0)
      ]
    }
    const row = sessionUsage(s)
    expect(row).not.toBeNull()
    expect(row!.sessionId).toBe('s1')
    expect(row!.project).toBe('proj')
    expect(row!.model).toBe('claude-opus-4-8') // most tokens
    expect(row!.totalTokens).toBe(1000 + 500 + 20 + 200)
    expect(row!.costUsd).toBeGreaterThan(0)
    expect(row!.lastActive).toBe('2026-07-20T11:30:00.000Z') // latest timestamp
  })

  it('returns null when the session has no entries', () => {
    expect(sessionUsage({ sessionId: 's', cwd: null, entries: [] })).toBeNull()
  })

  it('handles entries with only null timestamps (lastActive empty)', () => {
    const row = sessionUsage({
      sessionId: 's',
      cwd: null,
      entries: [entry(null, 'm', 5)]
    })
    expect(row!.lastActive).toBe('')
  })
})

describe('recentSessions', () => {
  const mk = (id: string, iso: string): RawSession => ({
    sessionId: id,
    cwd: `/p/${id}`,
    entries: [entry(iso, 'claude-opus-4-8', 100)]
  })

  it('sorts newest-first and drops empty sessions', () => {
    const list = recentSessions([
      mk('old', '2026-07-01T00:00:00Z'),
      mk('new', '2026-07-19T00:00:00Z'),
      { sessionId: 'empty', cwd: '/p/e', entries: [] }
    ])
    expect(list.map((r) => r.sessionId)).toEqual(['new', 'old'])
  })

  it('caps at the limit', () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      mk(`s${i}`, `2026-07-${String((i % 27) + 1).padStart(2, '0')}T00:00:00Z`)
    )
    expect(recentSessions(many, 10)).toHaveLength(10)
  })
})
