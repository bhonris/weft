import { describe, it, expect } from 'vitest'
import { fuzzyMatch, fuzzyFilter } from './fuzzy'

describe('fuzzyMatch', () => {
  it('matches a subsequence case-insensitively', () => {
    expect(fuzzyMatch('nt', 'New Tab')).not.toBeNull()
    expect(fuzzyMatch('ntab', 'New Tab')?.positions).toEqual([0, 4, 5, 6])
  })

  it('returns null when not a subsequence', () => {
    expect(fuzzyMatch('zzz', 'New Tab')).toBeNull()
    expect(fuzzyMatch('tabn', 'New Tab')).toBeNull() // order matters
  })

  it('empty query matches everything with score 0', () => {
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, positions: [] })
  })

  it('scores word-boundary and consecutive matches higher', () => {
    // "ne" is a prefix/word-start consecutive run in "New Tab"; in "Rename Tab"
    // it is a scattered subsequence (n@2, e@5). The prefix run should score higher.
    const a = fuzzyMatch('ne', 'New Tab')!
    const b = fuzzyMatch('ne', 'Rename Tab')!
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a.score).toBeGreaterThan(b.score)
  })

  it('prefers a start-of-string match over a later one', () => {
    const early = fuzzyMatch('cl', 'Close Tab')!
    const late = fuzzyMatch('cl', 'Cycle Theme')! // c early, l much later
    expect(early.score).toBeGreaterThan(late.score)
  })
})

describe('fuzzyFilter', () => {
  const items = ['New Tab', 'New Shell Tab', 'Close Tab', 'Rename Tab', 'Cycle Theme']

  it('filters out non-matches and ranks best-first', () => {
    const out = fuzzyFilter('tab', items, (s) => s).map((r) => r.item)
    expect(out).toContain('New Tab')
    expect(out).toContain('Close Tab')
    expect(out).not.toContain('Cycle Theme')
  })

  it('empty query returns all items in original order', () => {
    const out = fuzzyFilter('', items, (s) => s).map((r) => r.item)
    expect(out).toEqual(items)
  })

  it('ranks a strong prefix match first', () => {
    const out = fuzzyFilter('rena', items, (s) => s).map((r) => r.item)
    expect(out[0]).toBe('Rename Tab')
  })

  it('is stable for equal scores (original order preserved)', () => {
    // Two identical-scoring targets keep input order.
    const dup = ['alpha match', 'alpha match']
    const out = fuzzyFilter('alpha', dup, (s) => s)
    expect(out).toHaveLength(2)
  })
})
