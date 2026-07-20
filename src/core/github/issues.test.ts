import { describe, it, expect } from 'vitest'
import { parseIssues, filterIssues, collectLabels, type IssueFilter } from './issues'
import type { GithubIssue } from '@shared/ipc/api-contract'

const rawIssue = {
  number: 42,
  title: 'Fix crash on startup',
  state: 'open',
  user: { login: 'alice' },
  labels: [{ name: 'bug', color: 'd73a4a' }],
  comments: 3,
  html_url: 'https://github.com/o/r/issues/42',
  updated_at: '2026-07-20T10:00:00Z'
}

describe('parseIssues', () => {
  it('parses a well-formed issue', () => {
    const [issue] = parseIssues([rawIssue])
    expect(issue).toEqual<GithubIssue>({
      number: 42,
      title: 'Fix crash on startup',
      state: 'open',
      author: 'alice',
      labels: [{ name: 'bug', color: 'd73a4a' }],
      comments: 3,
      htmlUrl: 'https://github.com/o/r/issues/42',
      updatedAt: '2026-07-20T10:00:00Z'
    })
  })

  it('drops pull requests (entries with a pull_request field)', () => {
    const pr = { ...rawIssue, number: 7, pull_request: { url: '…' } }
    expect(parseIssues([rawIssue, pr]).map((i) => i.number)).toEqual([42])
  })

  it('defaults missing/blank fields safely', () => {
    const [issue] = parseIssues([{ number: 1, title: 't' }])
    expect(issue).toEqual<GithubIssue>({
      number: 1,
      title: 't',
      state: 'open',
      author: '',
      labels: [],
      comments: 0,
      htmlUrl: '',
      updatedAt: ''
    })
  })

  it('treats state "closed" as closed, anything else as open', () => {
    expect(parseIssues([{ ...rawIssue, state: 'closed' }])[0]!.state).toBe('closed')
    expect(parseIssues([{ ...rawIssue, state: 'weird' }])[0]!.state).toBe('open')
  })

  it('skips malformed entries and non-array bodies', () => {
    expect(parseIssues([null, 5, {}, { number: 1 }, { title: 'x' }])).toEqual([])
    expect(parseIssues('nope')).toEqual([])
    expect(parseIssues(null)).toEqual([])
  })

  it('defaults a label with no color', () => {
    const [issue] = parseIssues([{ ...rawIssue, labels: [{ name: 'x' }, 'bad', null] }])
    expect(issue!.labels).toEqual([{ name: 'x', color: '888888' }])
  })
})

const mk = (over: Partial<GithubIssue>): GithubIssue => ({
  number: 1,
  title: 'T',
  state: 'open',
  author: 'a',
  labels: [],
  comments: 0,
  htmlUrl: '',
  updatedAt: '',
  ...over
})

describe('filterIssues', () => {
  const issues = [
    mk({ number: 1, title: 'Alpha', state: 'open', author: 'alice', labels: [{ name: 'bug', color: '' }] }),
    mk({ number: 2, title: 'Beta', state: 'closed', author: 'bob', labels: [{ name: 'docs', color: '' }] }),
    mk({ number: 3, title: 'Gamma', state: 'open', author: 'carol', labels: [] })
  ]
  const base: IssueFilter = { state: 'all', label: '', query: '' }

  it('filters by state', () => {
    expect(filterIssues(issues, { ...base, state: 'open' }).map((i) => i.number)).toEqual([1, 3])
    expect(filterIssues(issues, { ...base, state: 'closed' }).map((i) => i.number)).toEqual([2])
  })

  it('filters by label', () => {
    expect(filterIssues(issues, { ...base, label: 'bug' }).map((i) => i.number)).toEqual([1])
  })

  it('filters by text across title/number/author (case-insensitive)', () => {
    expect(filterIssues(issues, { ...base, query: 'beta' }).map((i) => i.number)).toEqual([2])
    expect(filterIssues(issues, { ...base, query: 'carol' }).map((i) => i.number)).toEqual([3])
    expect(filterIssues(issues, { ...base, query: '#1' }).map((i) => i.number)).toEqual([1])
  })

  it('ANDs the predicates together', () => {
    expect(
      filterIssues(issues, { state: 'open', label: 'bug', query: 'alpha' }).map((i) => i.number)
    ).toEqual([1])
    expect(filterIssues(issues, { state: 'closed', label: 'bug', query: '' })).toEqual([])
  })

  it('returns all with an empty filter', () => {
    expect(filterIssues(issues, base)).toHaveLength(3)
  })
})

describe('collectLabels', () => {
  it('returns the sorted unique label names', () => {
    const issues = [
      mk({ labels: [{ name: 'bug', color: '' }, { name: 'ui', color: '' }] }),
      mk({ labels: [{ name: 'bug', color: '' }, { name: 'docs', color: '' }] })
    ]
    expect(collectLabels(issues)).toEqual(['bug', 'docs', 'ui'])
  })

  it('handles no labels', () => {
    expect(collectLabels([mk({})])).toEqual([])
  })
})
