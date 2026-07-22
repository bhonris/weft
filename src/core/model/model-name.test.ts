import { describe, it, expect } from 'vitest'
import { modelDisplayName, effortLabel } from './model-name'

describe('modelDisplayName', () => {
  it('maps known model ids to curated names', () => {
    expect(modelDisplayName('claude-opus-4-8')).toBe('Opus 4.8')
    expect(modelDisplayName('claude-sonnet-5')).toBe('Sonnet 5')
    expect(modelDisplayName('claude-fable-5')).toBe('Fable 5')
    expect(modelDisplayName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  })

  it('falls back to a cleaned-up name for unknown claude ids', () => {
    // Title-case family, version parts joined with dots.
    expect(modelDisplayName('claude-opus-9-1')).toBe('Opus 9.1')
    // A trailing 8-digit date segment is dropped.
    expect(modelDisplayName('claude-sonnet-6-2-20260101')).toBe('Sonnet 6.2')
    // Family with no version.
    expect(modelDisplayName('claude-mystery')).toBe('Mystery')
  })

  it('returns non-claude ids verbatim', () => {
    expect(modelDisplayName('<synthetic>')).toBe('<synthetic>')
    expect(modelDisplayName('gpt-4o')).toBe('gpt-4o')
  })

  it('is defensive against a bare "claude-" id', () => {
    expect(modelDisplayName('claude-')).toBe('claude-')
  })
})

describe('effortLabel', () => {
  it('title-cases a present effort', () => {
    expect(effortLabel('high')).toBe('High')
    expect(effortLabel('low')).toBe('Low')
    expect(effortLabel('xhigh')).toBe('Xhigh')
  })

  it('returns null for null/undefined/empty', () => {
    expect(effortLabel(null)).toBeNull()
    expect(effortLabel(undefined)).toBeNull()
    expect(effortLabel('')).toBeNull()
  })
})
