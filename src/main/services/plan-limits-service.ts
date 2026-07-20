import { parsePlanLimits } from '@core/usage/plan-limits'
import type { PlanLimits } from '@shared/ipc/api-contract'

/** The `fetch` surface the service needs (a subset of the global). */
export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

export interface PlanLimitsDeps {
  /**
   * Resolve the Claude OAuth access token (read-only, from
   * `~/.claude/.credentials.json`), or null when unavailable. The token is used
   * only to authorize the request here and never leaves the main process.
   */
  getToken: () => Promise<string | null>
  fetch: FetchLike
  /** Injected clock (epoch ms) for cache freshness + fetchedAt stamps. */
  now: () => number
  /** Cache TTL; the endpoint is rate-limited so default to 60 minutes. */
  cacheMs?: number
  /** Overridable for tests; defaults to the real endpoint. */
  url?: string
  anthropicVersion?: string
}

const DEFAULT_URL = 'https://api.anthropic.com/api/oauth/usage'
const DEFAULT_CACHE_MS = 60 * 60 * 1000
const OAUTH_BETA = 'oauth-2025-04-20'
const DEFAULT_ANTHROPIC_VERSION = '2023-06-01'

/**
 * Fetches Claude subscription plan limits from Anthropic's undocumented
 * `/api/oauth/usage` endpoint — the same source as Claude Code's `/usage`.
 * Because that endpoint is undocumented and rate-limited, this service is
 * defensive by design:
 *
 * - results are cached for {@link PlanLimitsDeps.cacheMs} (default 60 min);
 * - any failure (no token, non-2xx, network error, bad JSON) returns the last
 *   known value flagged `stale`, or `null` if nothing was ever fetched;
 * - it NEVER throws and NEVER writes credentials.
 */
export class PlanLimitsService {
  private cached: PlanLimits | null = null

  constructor(private readonly deps: PlanLimitsDeps) {}

  /** Current plan limits, from cache when fresh, else a fresh fetch. */
  async get(): Promise<PlanLimits | null> {
    const now = this.deps.now()
    const cacheMs = this.deps.cacheMs ?? DEFAULT_CACHE_MS
    if (this.cached && now - Date.parse(this.cached.fetchedAt) < cacheMs) {
      return this.cached
    }

    const token = await this.deps.getToken().catch(() => null)
    if (!token) return this.stale()

    try {
      const res = await this.deps.fetch(this.deps.url ?? DEFAULT_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          'anthropic-beta': OAUTH_BETA,
          'anthropic-version': this.deps.anthropicVersion ?? DEFAULT_ANTHROPIC_VERSION
        }
      })
      if (!res.ok) return this.stale()
      const body = await res.json()
      const limits = parsePlanLimits(body, new Date(now).toISOString())
      this.cached = limits
      return limits
    } catch {
      return this.stale()
    }
  }

  /** The last-known value flagged stale, or null when nothing was ever fetched. */
  private stale(): PlanLimits | null {
    return this.cached ? { ...this.cached, stale: true } : null
  }
}
