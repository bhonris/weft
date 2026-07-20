import { describe, it, expect } from 'vitest'
import {
  encodeProjectDir,
  transcriptFileName,
  parseTranscriptUsage,
  parseTranscriptDetail
} from './transcript'

describe('encodeProjectDir', () => {
  it('replaces every non-alphanumeric char with a dash', () => {
    expect(encodeProjectDir('C:\\repos\\claude-terminal-ide')).toBe(
      'C--repos-claude-terminal-ide'
    )
  })

  it('produces a double dash where a separator meets a dotfile', () => {
    expect(encodeProjectDir('C:\\repos\\x\\.claude\\wt')).toBe('C--repos-x--claude-wt')
  })

  it('handles posix-style paths too', () => {
    expect(encodeProjectDir('/home/u/proj')).toBe('-home-u-proj')
  })
})

describe('transcriptFileName', () => {
  it('appends .jsonl to the session id', () => {
    expect(transcriptFileName('abc-123')).toBe('abc-123.jsonl')
  })
})

describe('parseTranscriptUsage', () => {
  const assistant = (uuid: string, model: string, usage: object): string =>
    JSON.stringify({ type: 'assistant', uuid, message: { model, usage } })

  it('sums assistant token usage grouped by model', () => {
    const text = [
      assistant('a', 'claude-opus-4-8', {
        input_tokens: 2,
        output_tokens: 300,
        cache_read_input_tokens: 100,
        cache_creation_input_tokens: 50
      }),
      assistant('b', 'claude-opus-4-8', { input_tokens: 3, output_tokens: 7 }),
      assistant('c', 'claude-haiku-4-5', { input_tokens: 1, output_tokens: 1 })
    ].join('\n')

    const out = parseTranscriptUsage(text)
    expect(out['claude-opus-4-8']).toEqual({
      input: 5,
      output: 307,
      cacheRead: 100,
      cacheWrite5m: 50, // no ephemeral split → whole creation total is a 5m write
      cacheWrite1h: 0
    })
    expect(out['claude-haiku-4-5']).toEqual({
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite5m: 0,
      cacheWrite1h: 0
    })
  })

  it('uses the ephemeral 5m/1h split when present', () => {
    const text = assistant('a', 'claude-opus-4-8', {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 7532,
      cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 7532 }
    })
    const out = parseTranscriptUsage(text)
    expect(out['claude-opus-4-8']).toMatchObject({ cacheWrite5m: 0, cacheWrite1h: 7532 })
  })

  it('dedupes by uuid so re-appended lines are not double counted', () => {
    const line = assistant('dup', 'claude-opus-4-8', { input_tokens: 10, output_tokens: 0 })
    const out = parseTranscriptUsage([line, line].join('\n'))
    expect(out['claude-opus-4-8']!.input).toBe(10)
  })

  it('skips blank lines, bad JSON, non-assistant, and malformed messages', () => {
    const text = [
      '',
      '   ',
      '{not json',
      JSON.stringify({ type: 'user', message: { content: 'hi' } }),
      JSON.stringify({ type: 'assistant', uuid: 'x', message: { model: 'm' } }), // no usage
      JSON.stringify({ type: 'assistant', uuid: 'y', message: { usage: {} } }), // no model
      assistant('z', 'claude-opus-4-8', { input_tokens: 4, output_tokens: 0 })
    ].join('\n')
    const out = parseTranscriptUsage(text)
    expect(Object.keys(out)).toEqual(['claude-opus-4-8'])
    expect(out['claude-opus-4-8']!.input).toBe(4)
  })

  it('ignores negative / non-numeric token fields', () => {
    const text = assistant('a', 'claude-opus-4-8', {
      input_tokens: -5,
      output_tokens: 'lots',
      cache_read_input_tokens: null
    })
    expect(parseTranscriptUsage(text)['claude-opus-4-8']).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite5m: 0,
      cacheWrite1h: 0
    })
  })
})

describe('parseTranscriptDetail', () => {
  it('returns timestamped entries, the cwd, and dedupes by uuid', () => {
    const line = (uuid: string, ts: string, input: number): string =>
      JSON.stringify({
        type: 'assistant',
        uuid,
        timestamp: ts,
        cwd: 'C:\\repos\\weft',
        message: { model: 'claude-opus-4-8', usage: { input_tokens: input, output_tokens: 0 } }
      })
    const text = [
      JSON.stringify({ type: 'user', cwd: 'C:\\repos\\weft', message: { content: 'hi' } }),
      line('a', '2026-07-20T10:00:00Z', 5),
      line('a', '2026-07-20T10:00:00Z', 5) // duplicate uuid
    ].join('\n')

    const detail = parseTranscriptDetail(text)
    expect(detail.cwd).toBe('C:\\repos\\weft')
    expect(detail.entries).toHaveLength(1)
    expect(detail.entries[0]!.timestamp).toBe(Date.parse('2026-07-20T10:00:00Z'))
    expect(detail.entries[0]!.model).toBe('claude-opus-4-8')
    expect(detail.entries[0]!.usage.input).toBe(5)
  })

  it('records a null timestamp when the line has none or an invalid one', () => {
    const text = JSON.stringify({
      type: 'assistant',
      uuid: 'x',
      timestamp: 'not-a-date',
      message: { model: 'm', usage: { input_tokens: 1 } }
    })
    expect(parseTranscriptDetail(text).entries[0]!.timestamp).toBeNull()
  })

  it('has a null cwd when no line carried one', () => {
    const text = JSON.stringify({
      type: 'assistant',
      uuid: 'x',
      message: { model: 'm', usage: { input_tokens: 1 } }
    })
    expect(parseTranscriptDetail(text).cwd).toBeNull()
  })
})
