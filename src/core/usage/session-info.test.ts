import { describe, it, expect } from 'vitest'
import { latestSessionInfo } from './session-info'
import { emptyUsage } from './pricing'
import type { TranscriptDetail, TranscriptEntry } from './transcript'

const entry = (model: string, effort: string | null, timestamp = 0): TranscriptEntry => ({
  timestamp,
  model,
  effort,
  usage: emptyUsage()
})

const detail = (entries: TranscriptEntry[]): TranscriptDetail => ({ entries, cwd: null })

describe('latestSessionInfo', () => {
  it('returns null for a transcript with no assistant turns', () => {
    expect(latestSessionInfo(detail([]))).toBeNull()
  })

  it('returns the most recent turn (entries are chronological)', () => {
    const info = latestSessionInfo(
      detail([entry('claude-sonnet-5', 'medium', 1), entry('claude-opus-4-8', 'high', 2)])
    )
    expect(info).toEqual({ model: 'claude-opus-4-8', effort: 'high' })
  })

  it('skips synthetic turns to report the last real model', () => {
    const info = latestSessionInfo(
      detail([entry('claude-opus-4-8', 'high', 1), entry('<synthetic>', null, 2)])
    )
    expect(info).toEqual({ model: 'claude-opus-4-8', effort: 'high' })
  })

  it('is null when every turn is synthetic', () => {
    expect(latestSessionInfo(detail([entry('<synthetic>', null)]))).toBeNull()
  })

  it('carries a null effort through', () => {
    expect(latestSessionInfo(detail([entry('claude-fable-5', null)]))).toEqual({
      model: 'claude-fable-5',
      effort: null
    })
  })
})
