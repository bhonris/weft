import { describe, it, expect } from 'vitest'
import { OutputRingBuffer } from './output-ring-buffer'

describe('OutputRingBuffer', () => {
  it('accumulates pushed output and replays it verbatim', () => {
    const buf = new OutputRingBuffer()
    buf.push('hello ')
    buf.push('\x1b[32mworld\x1b[0m')
    expect(buf.snapshot()).toBe('hello \x1b[32mworld\x1b[0m')
    expect(buf.length).toBe('hello \x1b[32mworld\x1b[0m'.length)
  })

  it('ignores empty pushes', () => {
    const buf = new OutputRingBuffer()
    buf.push('')
    expect(buf.length).toBe(0)
    expect(buf.snapshot()).toBe('')
  })

  it('drops the oldest chunks once the char cap is exceeded', () => {
    const buf = new OutputRingBuffer(10)
    buf.push('aaaaa') // 5
    buf.push('bbbbb') // 10
    buf.push('ccccc') // 15 → drop "aaaaa"
    expect(buf.snapshot()).toBe('bbbbbccccc')
    expect(buf.length).toBe(10)
  })

  it('truncates a single oversized chunk to its tail', () => {
    const buf = new OutputRingBuffer(4)
    buf.push('abcdefgh')
    expect(buf.snapshot()).toBe('efgh')
    expect(buf.length).toBe(4)
  })

  it('clear empties the buffer', () => {
    const buf = new OutputRingBuffer()
    buf.push('data')
    buf.clear()
    expect(buf.snapshot()).toBe('')
    expect(buf.length).toBe(0)
  })

  it('rejects a non-positive cap', () => {
    expect(() => new OutputRingBuffer(0)).toThrow(/positive/)
  })
})
