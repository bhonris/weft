import { describe, it, expect } from 'vitest'
import { ok, err, isOk } from './result'

describe('Result', () => {
  it('ok wraps a value', () => {
    const r = ok(42)
    expect(r).toEqual({ ok: true, value: 42 })
    expect(isOk(r)).toBe(true)
  })

  it('err wraps an error', () => {
    const r = err('boom')
    expect(r).toEqual({ ok: false, error: 'boom' })
    expect(isOk(r)).toBe(false)
  })
})
