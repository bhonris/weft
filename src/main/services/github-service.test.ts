import { describe, it, expect, vi } from 'vitest'
import {
  GithubService,
  type GithubFetchLike,
  type GithubFetchResponse,
  type GithubServiceDeps
} from './github-service'

const NOW = Date.parse('2026-07-20T12:00:00Z')
const REMOTE = 'https://github.com/octo/hello.git'

const issueBody = [
  {
    number: 42,
    title: 'Fix crash',
    state: 'open',
    user: { login: 'alice' },
    labels: [{ name: 'bug', color: 'd73a4a' }],
    comments: 2,
    html_url: 'https://github.com/octo/hello/issues/42',
    updated_at: '2026-07-20T10:00:00Z'
  },
  { number: 7, title: 'a PR', pull_request: { url: 'x' } }
]

const okFetch = (json: unknown): GithubFetchLike =>
  vi.fn(async () => ({ ok: true, status: 200, json: async () => json }))

const deps = (over: Partial<GithubServiceDeps> = {}): GithubServiceDeps => ({
  fetch: okFetch(issueBody),
  getRemoteUrl: async () => REMOTE,
  getAuth: async () => ({ token: null, source: 'none' }),
  now: () => NOW,
  ...over
})

describe('GithubService.panel', () => {
  it('returns repo:null and no error when cwd is null', async () => {
    const svc = new GithubService(deps())
    const p = await svc.panel(null)
    expect(p.repo).toBeNull()
    expect(p.issues).toEqual([])
    expect(p.error).toBeNull()
    expect(p.authSource).toBe('none')
  })

  it('returns repo:null when the remote is not GitHub', async () => {
    const svc = new GithubService(deps({ getRemoteUrl: async () => 'https://gitlab.com/o/r.git' }))
    expect((await svc.panel('C:/repo')).repo).toBeNull()
  })

  it('fetches, parses (dropping PRs), and reports the repo slug', async () => {
    const svc = new GithubService(deps())
    const p = await svc.panel('C:/repo')
    expect(p.repo).toEqual({ owner: 'octo', repo: 'hello' })
    expect(p.issues.map((i) => i.number)).toEqual([42])
    expect(p.stale).toBe(false)
    expect(p.fetchedAt).toBe('2026-07-20T12:00:00.000Z')
  })

  it('sends the Authorization header only when a token is present', async () => {
    const fetch = okFetch(issueBody)
    const svc = new GithubService(deps({ fetch, getAuth: async () => ({ token: 'gho_x', source: 'gh' }) }))
    const p = await svc.panel('C:/repo')
    expect(p.authSource).toBe('gh')
    const [url, init] = (fetch as unknown as { mock: { calls: [string, { headers: Record<string, string> }][] } }).mock.calls[0]!
    expect(url).toContain('/repos/octo/hello/issues')
    expect(init.headers['Authorization']).toBe('Bearer gho_x')
  })

  it('omits Authorization when unauthenticated', async () => {
    const fetch = okFetch(issueBody)
    await new GithubService(deps({ fetch })).panel('C:/repo')
    const [, init] = (fetch as unknown as { mock: { calls: [string, { headers: Record<string, string> }][] } }).mock.calls[0]!
    expect(init.headers['Authorization']).toBeUndefined()
  })

  it('serves the per-repo cache within the TTL', async () => {
    const fetch = okFetch(issueBody)
    let clock = NOW
    const svc = new GithubService(deps({ fetch, now: () => clock, cacheMs: 1000 }))
    await svc.panel('C:/repo')
    clock = NOW + 500
    const p = await svc.panel('C:/repo')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(p.stale).toBe(false)
    expect(p.issues.map((i) => i.number)).toEqual([42])
  })

  it('re-fetches after the TTL expires', async () => {
    const fetch = okFetch(issueBody)
    let clock = NOW
    const svc = new GithubService(deps({ fetch, now: () => clock, cacheMs: 1000 }))
    await svc.panel('C:/repo')
    clock = NOW + 2000
    await svc.panel('C:/repo')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('serves last-known (flagged stale) on a later network error', async () => {
    let boom = false
    const fetch: GithubFetchLike = vi.fn(async () => {
      if (boom) throw new Error('ECONNREFUSED')
      return { ok: true, status: 200, json: async () => issueBody }
    })
    let clock = NOW
    const svc = new GithubService(deps({ fetch, now: () => clock, cacheMs: 1000 }))
    await svc.panel('C:/repo')
    boom = true
    clock = NOW + 2000
    const p = await svc.panel('C:/repo')
    expect(p.stale).toBe(true)
    expect(p.issues.map((i) => i.number)).toEqual([42])
    expect(p.error).toMatch(/connection/i)
  })

  it('reports an empty stale-free error when the first fetch fails', async () => {
    const fetch: GithubFetchLike = vi.fn(async () => {
      throw new Error('down')
    })
    const p = await new GithubService(deps({ fetch })).panel('C:/repo')
    expect(p.issues).toEqual([])
    expect(p.stale).toBe(false)
    expect(p.error).toBeTruthy()
  })

  it('explains a rate limit differently by auth source', async () => {
    const limited: GithubFetchResponse = {
      ok: false,
      status: 403,
      json: async () => ({}),
      headers: { get: (n) => (n === 'x-ratelimit-remaining' ? '0' : null) }
    }
    const unauth = await new GithubService(deps({ fetch: vi.fn(async () => limited) })).panel('C:/repo')
    expect(unauth.error).toMatch(/sign in/i)
    const auth = await new GithubService(
      deps({ fetch: vi.fn(async () => limited), getAuth: async () => ({ token: 't', source: 'gh' }) })
    ).panel('C:/repo')
    expect(auth.error).toMatch(/try again/i)
  })

  it('explains a 404 (suggesting sign-in when unauthenticated)', async () => {
    const notFound: GithubFetchResponse = { ok: false, status: 404, json: async () => ({}) }
    const p = await new GithubService(deps({ fetch: vi.fn(async () => notFound) })).panel('C:/repo')
    expect(p.error).toMatch(/private/i)
  })

  it('explains a 401', async () => {
    const unauthorized: GithubFetchResponse = { ok: false, status: 401, json: async () => ({}) }
    const p = await new GithubService(
      deps({ fetch: vi.fn(async () => unauthorized), getAuth: async () => ({ token: 'bad', source: 'oauth' }) })
    ).panel('C:/repo')
    expect(p.error).toMatch(/authentication failed/i)
  })

  it('reports a generic HTTP error for other statuses', async () => {
    const err: GithubFetchResponse = { ok: false, status: 500, json: async () => ({}) }
    const p = await new GithubService(deps({ fetch: vi.fn(async () => err) })).panel('C:/repo')
    expect(p.error).toMatch(/HTTP 500/)
  })

  it('degrades to source "none" when getAuth throws', async () => {
    const svc = new GithubService(
      deps({
        getAuth: async () => {
          throw new Error('locked')
        }
      })
    )
    const p = await svc.panel('C:/repo')
    expect(p.authSource).toBe('none')
    expect(p.issues.map((i) => i.number)).toEqual([42])
  })
})

const createdBody = {
  number: 101,
  title: 'New bug',
  state: 'open',
  user: { login: 'alice' },
  labels: [{ name: 'bug', color: 'd73a4a' }],
  comments: 0,
  html_url: 'https://github.com/octo/hello/issues/101',
  updated_at: '2026-07-20T12:00:00Z'
}

const authed = (over: Partial<GithubServiceDeps> = {}): GithubServiceDeps =>
  deps({
    fetch: okFetch(createdBody),
    getAuth: async () => ({ token: 'gho_x', source: 'gh' }),
    ...over
  })

describe('GithubService.createIssue', () => {
  it('POSTs the issue and returns the created issue', async () => {
    const fetch = okFetch(createdBody)
    const svc = new GithubService(authed({ fetch }))
    const res = await svc.createIssue('C:/repo', { title: 'New bug', body: 'boom', labels: ['bug'] })
    expect('issue' in res && res.issue.number).toBe(101)
    const [url, init] = (
      fetch as unknown as {
        mock: { calls: [string, { method?: string; headers: Record<string, string>; body?: string }][] }
      }
    ).mock.calls[0]!
    expect(url).toBe('https://api.github.com/repos/octo/hello/issues')
    expect(init.method).toBe('POST')
    expect(init.headers['Authorization']).toBe('Bearer gho_x')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body!)).toEqual({ title: 'New bug', body: 'boom', labels: ['bug'] })
  })

  it('trims the title before sending', async () => {
    const fetch = okFetch(createdBody)
    await new GithubService(authed({ fetch })).createIssue('C:/repo', {
      title: '  New bug  ',
      body: '',
      labels: []
    })
    const [, init] = (
      fetch as unknown as { mock: { calls: [string, { body?: string }][] } }
    ).mock.calls[0]!
    expect(JSON.parse(init.body!).title).toBe('New bug')
  })

  it('invalidates the cache so the next panel poll re-fetches', async () => {
    const fetch: GithubFetchLike = vi.fn(async (_url, init) => ({
      ok: true,
      status: 200,
      json: async () => (init.method === 'POST' ? createdBody : issueBody)
    }))
    const svc = new GithubService(
      authed({ fetch, now: () => NOW, cacheMs: 60_000 })
    )
    await svc.panel('C:/repo') // primes the cache (fetch #1)
    await svc.createIssue('C:/repo', { title: 'x', body: '', labels: [] }) // fetch #2
    await svc.panel('C:/repo') // cache dropped → fetch #3, not served stale
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('errors when the cwd is not a GitHub repo', async () => {
    const res = await new GithubService(
      authed({ getRemoteUrl: async () => 'https://gitlab.com/o/r.git' })
    ).createIssue('C:/repo', { title: 'x', body: '', labels: [] })
    expect(res).toEqual({ error: expect.stringMatching(/not a github repository/i) })
  })

  it('errors when the cwd is null', async () => {
    const res = await new GithubService(authed()).createIssue(null, {
      title: 'x',
      body: '',
      labels: []
    })
    expect(res).toEqual({ error: expect.stringMatching(/not a github repository/i) })
  })

  it('errors when the title is blank', async () => {
    const res = await new GithubService(authed()).createIssue('C:/repo', {
      title: '   ',
      body: '',
      labels: []
    })
    expect(res).toEqual({ error: expect.stringMatching(/title is required/i) })
  })

  it('errors (without fetching) when unauthenticated', async () => {
    const fetch = okFetch(createdBody)
    const res = await new GithubService(
      authed({ fetch, getAuth: async () => ({ token: null, source: 'none' }) })
    ).createIssue('C:/repo', { title: 'x', body: '', labels: [] })
    expect(res).toEqual({ error: expect.stringMatching(/sign in/i) })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('surfaces a friendly message on a non-2xx response', async () => {
    const err: GithubFetchResponse = { ok: false, status: 422, json: async () => ({}) }
    const res = await new GithubService(authed({ fetch: vi.fn(async () => err) })).createIssue(
      'C:/repo',
      { title: 'x', body: '', labels: [] }
    )
    expect(res).toEqual({ error: expect.stringMatching(/HTTP 422/) })
  })

  it('explains a 404 as a missing repo / lack of access (authenticated)', async () => {
    const notFound: GithubFetchResponse = { ok: false, status: 404, json: async () => ({}) }
    const res = await new GithubService(authed({ fetch: vi.fn(async () => notFound) })).createIssue(
      'C:/repo',
      { title: 'x', body: '', labels: [] }
    )
    expect(res).toEqual({ error: expect.stringMatching(/lacks access/i) })
  })

  it('errors when GitHub returns an unexpected body', async () => {
    const res = await new GithubService(authed({ fetch: okFetch({ not: 'an issue' }) })).createIssue(
      'C:/repo',
      { title: 'x', body: '', labels: [] }
    )
    expect(res).toEqual({ error: expect.stringMatching(/unexpected response/i) })
  })

  it('errors on a network failure', async () => {
    const fetch: GithubFetchLike = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })
    const res = await new GithubService(authed({ fetch })).createIssue('C:/repo', {
      title: 'x',
      body: '',
      labels: []
    })
    expect(res).toEqual({ error: expect.stringMatching(/connection/i) })
  })

  it('degrades to source "none" (blocking the create) when getAuth throws', async () => {
    const fetch = okFetch(createdBody)
    const res = await new GithubService(
      authed({
        fetch,
        getAuth: async () => {
          throw new Error('locked')
        }
      })
    ).createIssue('C:/repo', { title: 'x', body: '', labels: [] })
    expect(res).toEqual({ error: expect.stringMatching(/sign in/i) })
    expect(fetch).not.toHaveBeenCalled()
  })
})
