import { describe, it, expect } from 'vitest'
import { isSafeExternalUrl } from './external-url'

describe('isSafeExternalUrl', () => {
  it('allows http and https', () => {
    expect(isSafeExternalUrl('https://github.com/o/r/issues/1')).toBe(true)
    expect(isSafeExternalUrl('http://example.com')).toBe(true)
  })

  it('rejects dangerous schemes', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('data:text/html,<script>')).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(isSafeExternalUrl('not a url')).toBe(false)
    expect(isSafeExternalUrl('')).toBe(false)
  })
})
