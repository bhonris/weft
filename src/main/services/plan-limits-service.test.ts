import { describe, it, expect, vi } from 'vitest'
import { PlanLimitsService, type FetchLike } from './plan-limits-service'

const NOW = Date.parse('2026-07-20T12:00:00Z')
const body = {
  five_hour: { utilization: 20, resets_at: '2026-07-20T15:00:00Z' },
  seven_day: { utilization: 55 },
  seven_day_opus: { utilization: 70 }
}

const okFetch = (json: unknown): FetchLike =>
  vi.fn(async () => ({ ok: true, status: 200, json: async () => json }))

describe('PlanLimitsService', () => {
  it('fetches, parses, and authorizes with the OAuth token + beta header', async () => {
    const fetch = okFetch(body)
    const svc = new PlanLimitsService({
      getToken: async () => 'tok-123',
      fetch,
      now: () => NOW
    })
    const limits = await svc.get()

    expect(limits?.fiveHour?.utilization).toBe(20)
    expect(limits?.sevenDay?.utilization).toBe(55)
    expect(limits?.stale).toBe(false)
    expect(limits?.fetchedAt).toBe('2026-07-20T12:00:00.000Z')
    const [, init] = (fetch as unknown as { mock: { calls: [string, { headers: Record<string, string> }][] } }).mock.calls[0]!
    expect(init.headers['Authorization']).toBe('Bearer tok-123')
    expect(init.headers['anthropic-beta']).toBe('oauth-2025-04-20')
  })

  it('serves the cache within the TTL without re-fetching', async () => {
    const fetch = okFetch(body)
    let clock = NOW
    const svc = new PlanLimitsService({ getToken: async () => 't', fetch, now: () => clock, cacheMs: 1000 })
    await svc.get()
    clock = NOW + 500 // still fresh
    await svc.get()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('re-fetches after the TTL expires', async () => {
    const fetch = okFetch(body)
    let clock = NOW
    const svc = new PlanLimitsService({ getToken: async () => 't', fetch, now: () => clock, cacheMs: 1000 })
    await svc.get()
    clock = NOW + 2000 // expired
    await svc.get()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('returns null when there is no token (endpoint never called)', async () => {
    const fetch = okFetch(body)
    const svc = new PlanLimitsService({ getToken: async () => null, fetch, now: () => NOW })
    expect(await svc.get()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('falls back to last-known (flagged stale) on a non-2xx response', async () => {
    let ok = true
    const fetch: FetchLike = vi.fn(async () => ({ ok, status: ok ? 200 : 429, json: async () => body }))
    let clock = NOW
    const svc = new PlanLimitsService({ getToken: async () => 't', fetch, now: () => clock, cacheMs: 1000 })
    const fresh = await svc.get()
    expect(fresh?.stale).toBe(false)

    ok = false
    clock = NOW + 2000 // force a re-fetch, which now fails
    const stale = await svc.get()
    expect(stale?.stale).toBe(true)
    expect(stale?.fiveHour?.utilization).toBe(20) // last-known preserved
  })

  it('returns null on a network error with nothing cached', async () => {
    const fetch: FetchLike = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })
    const svc = new PlanLimitsService({ getToken: async () => 't', fetch, now: () => NOW })
    expect(await svc.get()).toBeNull()
  })

  it('degrades to null when getToken itself throws', async () => {
    const svc = new PlanLimitsService({
      getToken: async () => {
        throw new Error('locked')
      },
      fetch: okFetch(body),
      now: () => NOW
    })
    expect(await svc.get()).toBeNull()
  })
})
