import { describe, it, expect, vi } from 'vitest'
import { FrameParser } from './frame-parser'

describe('FrameParser', () => {
  it('parses complete NDJSON lines', () => {
    const frames: unknown[] = []
    const p = new FrameParser((f) => frames.push(f))
    p.push('{"a":1}\n{"b":2}\n')
    expect(frames).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('reassembles a frame split across chunks', () => {
    const frames: unknown[] = []
    const p = new FrameParser((f) => frames.push(f))
    p.push('{"event":"St')
    p.push('op","session_id":"s1"}\n')
    expect(frames).toEqual([{ event: 'Stop', session_id: 's1' }])
  })

  it('handles CRLF and blank lines', () => {
    const frames: unknown[] = []
    const p = new FrameParser((f) => frames.push(f))
    p.push('{"a":1}\r\n\r\n{"b":2}\r\n')
    expect(frames).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('flushes a trailing unterminated line on end()', () => {
    const frames: unknown[] = []
    const p = new FrameParser((f) => frames.push(f))
    p.push('{"a":1}')
    expect(frames).toEqual([])
    p.end()
    expect(frames).toEqual([{ a: 1 }])
  })

  it('reports malformed JSON and non-object lines to onError', () => {
    const frames: unknown[] = []
    const errors: string[] = []
    const p = new FrameParser(
      (f) => frames.push(f),
      (l) => errors.push(l)
    )
    p.push('not-json\n[1,2]\n"str"\n{"ok":true}\n')
    expect(frames).toEqual([{ ok: true }])
    expect(errors).toEqual(['not-json', '[1,2]', '"str"'])
  })

  it('end() with an empty buffer is a no-op', () => {
    const onFrame = vi.fn()
    const p = new FrameParser(onFrame)
    p.end()
    expect(onFrame).not.toHaveBeenCalled()
  })
})
