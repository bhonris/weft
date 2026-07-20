import { describe, it, expect, vi } from 'vitest'
import { GithubAuthService, type GithubAuthDeps, type TokenStore } from './github-auth-service'
import type { GithubFetchLike, GithubFetchResponse } from './github-service'
import type { ExecFn } from './diff-service'
import type { GithubAuthEvent } from '@shared/ipc/api-contract'

const NOW = Date.parse('2026-07-20T12:00:00Z')

/** A TokenStore backed by a mutable box. */
const memStore = (initial: string | null = null): TokenStore => {
  let v = initial
  return { get: () => v, set: (t) => (v = t), delete: () => (v = null) }
}

/** A fetch that returns the given JSON bodies in sequence. */
const seqFetch = (bodies: unknown[]): GithubFetchLike => {
  let i = 0
  return vi.fn(async (): Promise<GithubFetchResponse> => {
    const body = bodies[Math.min(i, bodies.length - 1)]
    i++
    return { ok: true, status: 200, json: async () => body }
  })
}

const baseDeps = (over: Partial<GithubAuthDeps> = {}): GithubAuthDeps => ({
  fetch: seqFetch([{}]),
  exec: vi.fn(async () => {
    throw new Error('gh not installed')
  }),
  getEnv: () => undefined,
  store: memStore(),
  openExternal: vi.fn(),
  emit: vi.fn(),
  now: () => NOW,
  sleep: async () => {},
  clientId: 'cid-123',
  ...over
})

describe('GithubAuthService.resolveAuth', () => {
  it('prefers the gh CLI token', async () => {
    const exec: ExecFn = vi.fn(async () => ({ stdout: 'gho_gh\n' }))
    const svc = new GithubAuthService(baseDeps({ exec, getEnv: () => 'gho_env', store: memStore('gho_stored') }))
    expect(await svc.resolveAuth()).toEqual({ token: 'gho_gh', source: 'gh' })
  })

  it('falls back to GITHUB_TOKEN when gh is unavailable', async () => {
    const svc = new GithubAuthService(baseDeps({ getEnv: (n) => (n === 'GITHUB_TOKEN' ? 'gho_env' : undefined) }))
    expect(await svc.resolveAuth()).toEqual({ token: 'gho_env', source: 'env' })
  })

  it('falls back to the stored token when gh and env are absent', async () => {
    const svc = new GithubAuthService(baseDeps({ store: memStore('gho_stored') }))
    expect(await svc.resolveAuth()).toEqual({ token: 'gho_stored', source: 'oauth' })
  })

  it('reports none when nothing resolves', async () => {
    const svc = new GithubAuthService(baseDeps())
    expect(await svc.resolveAuth()).toEqual({ token: null, source: 'none' })
  })

  it('treats blank gh output as no token', async () => {
    const exec: ExecFn = vi.fn(async () => ({ stdout: '  \n' }))
    const svc = new GithubAuthService(baseDeps({ exec }))
    expect((await svc.resolveAuth()).source).toBe('none')
  })

  it('caches the resolution within the TTL', async () => {
    const exec: ExecFn = vi.fn(async () => ({ stdout: 'gho_gh\n' }))
    const svc = new GithubAuthService(baseDeps({ exec, authCacheMs: 1000 }))
    await svc.resolveAuth()
    await svc.resolveAuth()
    expect(exec).toHaveBeenCalledTimes(1)
  })
})

describe('GithubAuthService.signOut', () => {
  it('clears the stored token and the auth cache', async () => {
    const store = memStore('gho_stored')
    const svc = new GithubAuthService(baseDeps({ store }))
    expect((await svc.resolveAuth()).source).toBe('oauth')
    svc.signOut()
    expect(store.get()).toBeNull()
    expect((await svc.resolveAuth()).source).toBe('none')
  })
})

describe('GithubAuthService.beginDeviceFlow', () => {
  const deviceBody = {
    device_code: 'dev123',
    user_code: 'ABCD-1234',
    verification_uri: 'https://github.com/login/device',
    expires_in: 900,
    interval: 1
  }

  it('errors when no client id is configured', async () => {
    const svc = new GithubAuthService(baseDeps({ clientId: null }))
    expect(await svc.beginDeviceFlow()).toEqual({
      error: 'GitHub sign-in is not configured in this build.'
    })
  })

  it('errors when the device-code request fails', async () => {
    const svc = new GithubAuthService(
      baseDeps({ fetch: seqFetch([{ error: 'x', error_description: 'bad client' }]) })
    )
    expect(await svc.beginDeviceFlow()).toEqual({ error: 'bad client' })
  })

  it('errors when GitHub is unreachable', async () => {
    const fetch: GithubFetchLike = vi.fn(async () => {
      throw new Error('down')
    })
    const svc = new GithubAuthService(baseDeps({ fetch }))
    expect(await svc.beginDeviceFlow()).toEqual({ error: 'Could not reach GitHub to start sign-in.' })
  })

  it('returns the user code, opens the browser, and stores the token on approval', async () => {
    const store = memStore()
    const openExternal = vi.fn()
    let resolveAuthorized: (e: GithubAuthEvent) => void = () => {}
    const authorized = new Promise<GithubAuthEvent>((r) => (resolveAuthorized = r))
    const svc = new GithubAuthService(
      baseDeps({
        fetch: seqFetch([deviceBody, { error: 'authorization_pending' }, { access_token: 'gho_new' }]),
        store,
        openExternal,
        emit: (e) => resolveAuthorized(e)
      })
    )

    const result = await svc.beginDeviceFlow()
    expect(result).toEqual({
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device',
      expiresInSec: 900
    })
    expect(openExternal).toHaveBeenCalledWith('https://github.com/login/device')

    expect(await authorized).toEqual({ state: 'authorized' })
    expect(store.get()).toBe('gho_new')
    // The stored token now resolves as the active auth.
    expect((await svc.resolveAuth()).source).toBe('oauth')
  })

  it('emits an error when polling returns a terminal error', async () => {
    let resolveEmit: (e: GithubAuthEvent) => void = () => {}
    const emitted = new Promise<GithubAuthEvent>((r) => (resolveEmit = r))
    const svc = new GithubAuthService(
      baseDeps({
        fetch: seqFetch([deviceBody, { error: 'access_denied' }]),
        emit: (e) => resolveEmit(e)
      })
    )
    await svc.beginDeviceFlow()
    const ev = await emitted
    expect(ev.state).toBe('error')
    expect(ev.message).toMatch(/cancelled/i)
  })

  it('emits a timeout error when the code expires before approval', async () => {
    let calls = 0
    // First now() computes the deadline; the next call is already past it, so the
    // poll loop exits immediately without hitting the token endpoint.
    const now = (): number => {
      calls++
      return calls <= 1 ? 0 : 10_000_000
    }
    let resolveEmit: (e: GithubAuthEvent) => void = () => {}
    const emitted = new Promise<GithubAuthEvent>((r) => (resolveEmit = r))
    const svc = new GithubAuthService(
      baseDeps({
        fetch: seqFetch([{ ...deviceBody, expires_in: 10 }]),
        now,
        emit: (e) => resolveEmit(e)
      })
    )
    await svc.beginDeviceFlow()
    const ev = await emitted
    expect(ev.state).toBe('error')
    expect(ev.message).toMatch(/timed out/i)
  })

  it('backs off on slow_down and eventually authorizes', async () => {
    const store = memStore()
    let resolveEmit: (e: GithubAuthEvent) => void = () => {}
    const emitted = new Promise<GithubAuthEvent>((r) => (resolveEmit = r))
    const svc = new GithubAuthService(
      baseDeps({
        fetch: seqFetch([deviceBody, { error: 'slow_down' }, { access_token: 'gho_slow' }]),
        store,
        emit: (e) => resolveEmit(e)
      })
    )
    await svc.beginDeviceFlow()
    expect(await emitted).toEqual({ state: 'authorized' })
    expect(store.get()).toBe('gho_slow')
  })

  it('keeps polling through a transient token-endpoint failure', async () => {
    const store = memStore()
    let calls = 0
    // device-code ok, then the first poll throws (network blip), then authorized.
    const fetch: GithubFetchLike = vi.fn(async () => {
      calls++
      if (calls === 1) return { ok: true, status: 200, json: async () => deviceBody }
      if (calls === 2) throw new Error('blip')
      return { ok: true, status: 200, json: async () => ({ access_token: 'gho_retry' }) }
    })
    let resolveEmit: (e: GithubAuthEvent) => void = () => {}
    const emitted = new Promise<GithubAuthEvent>((r) => (resolveEmit = r))
    const svc = new GithubAuthService(baseDeps({ fetch, store, emit: (e) => resolveEmit(e) }))
    await svc.beginDeviceFlow()
    expect(await emitted).toEqual({ state: 'authorized' })
    expect(store.get()).toBe('gho_retry')
  })

  it('survives openExternal throwing (still polls to completion)', async () => {
    const store = memStore()
    let resolveEmit: (e: GithubAuthEvent) => void = () => {}
    const emitted = new Promise<GithubAuthEvent>((r) => (resolveEmit = r))
    const svc = new GithubAuthService(
      baseDeps({
        fetch: seqFetch([deviceBody, { access_token: 'gho_ok' }]),
        store,
        openExternal: vi.fn(() => {
          throw new Error('no browser')
        }),
        emit: (e) => resolveEmit(e)
      })
    )
    const result = await svc.beginDeviceFlow()
    expect('userCode' in result).toBe(true)
    expect(await emitted).toEqual({ state: 'authorized' })
    expect(store.get()).toBe('gho_ok')
  })
})
