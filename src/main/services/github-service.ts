import { parseRepoSlug } from '@core/github/repo-url'
import { parseIssues } from '@core/github/issues'
import type { GithubAuthSource, GithubIssue, IssuesPanelData } from '@shared/ipc/api-contract'

/** Minimal fetch surface the service needs — satisfied by global fetch and a fake. */
export interface GithubFetchResponse {
  ok: boolean
  status: number
  json(): Promise<unknown>
  headers?: { get(name: string): string | null }
}
export type GithubFetchLike = (
  url: string,
  init: { method?: string; headers: Record<string, string>; body?: string }
) => Promise<GithubFetchResponse>

/** The resolved credential and which source it came from. */
export interface GithubAuth {
  token: string | null
  source: GithubAuthSource
}

export interface GithubServiceDeps {
  fetch: GithubFetchLike
  /** `origin` remote URL for a cwd (GitService.remoteUrl), or null. */
  getRemoteUrl: (cwd: string) => Promise<string | null>
  /** Resolve the active GitHub token + its source (gh → env → stored → none). */
  getAuth: () => Promise<GithubAuth>
  /** Injected clock (epoch ms). */
  now: () => number
  /** Per-repo cache TTL; default 60s (renderer may poll faster). */
  cacheMs?: number
  /** Overridable API base for tests; defaults to api.github.com. */
  apiBase?: string
}

const DEFAULT_CACHE_MS = 60 * 1000
const DEFAULT_API_BASE = 'https://api.github.com'
const PER_PAGE = 50

interface CacheEntry {
  issues: GithubIssue[]
  fetchedAt: string
}

/**
 * Fetches a repo's GitHub issues for the Issues panel. Defensive by design,
 * mirroring {@link PlanLimitsService}:
 *
 * - repo is detected from the cwd's `origin` remote; a non-GitHub / missing
 *   remote yields `repo: null` and an empty payload (not an error);
 * - results are cached per repo for {@link GithubServiceDeps.cacheMs};
 * - any failure (network, non-2xx, bad JSON) returns the last-known list flagged
 *   `stale` with a human `error`, or an empty list with `error`;
 * - it NEVER throws and NEVER exposes the token.
 */
export class GithubService {
  private readonly cache = new Map<string, CacheEntry>()

  constructor(private readonly deps: GithubServiceDeps) {}

  /** The Issues-panel payload for the repo at `cwd` (null cwd → empty). */
  async panel(cwd: string | null): Promise<IssuesPanelData> {
    const now = this.deps.now()
    const iso = new Date(now).toISOString()
    const auth = await this.deps.getAuth().catch(() => ({ token: null, source: 'none' as const }))

    const slug = cwd ? parseRepoSlug((await this.deps.getRemoteUrl(cwd)) ?? '') : null
    if (!slug) {
      return { repo: null, issues: [], authSource: auth.source, fetchedAt: iso, stale: false, error: null }
    }

    const key = `${slug.owner}/${slug.repo}`
    const cacheMs = this.deps.cacheMs ?? DEFAULT_CACHE_MS
    const cached = this.cache.get(key)
    if (cached && now - Date.parse(cached.fetchedAt) < cacheMs) {
      return { repo: slug, issues: cached.issues, authSource: auth.source, fetchedAt: cached.fetchedAt, stale: false, error: null }
    }

    const base = this.deps.apiBase ?? DEFAULT_API_BASE
    const url = `${base}/repos/${slug.owner}/${slug.repo}/issues?state=all&per_page=${PER_PAGE}&sort=updated&direction=desc`
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'weft'
    }
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`

    try {
      const res = await this.deps.fetch(url, { headers })
      if (!res.ok) {
        return this.fail(slug, auth.source, iso, this.httpError(res, auth.source))
      }
      const issues = parseIssues(await res.json())
      this.cache.set(key, { issues, fetchedAt: iso })
      return { repo: slug, issues, authSource: auth.source, fetchedAt: iso, stale: false, error: null }
    } catch {
      return this.fail(slug, auth.source, iso, 'Could not reach GitHub. Check your connection.')
    }
  }

  /** Build a failure payload, preferring the last-known list flagged stale. */
  private fail(
    slug: { owner: string; repo: string },
    source: GithubAuthSource,
    iso: string,
    error: string
  ): IssuesPanelData {
    const cached = this.cache.get(`${slug.owner}/${slug.repo}`)
    return {
      repo: slug,
      issues: cached?.issues ?? [],
      authSource: source,
      fetchedAt: cached?.fetchedAt ?? iso,
      stale: cached != null,
      error
    }
  }

  /** A friendly message for a non-2xx GitHub response. */
  private httpError(res: GithubFetchResponse, source: GithubAuthSource): string {
    const remaining = res.headers?.get('x-ratelimit-remaining')
    if (res.status === 403 && remaining === '0') {
      return source === 'none'
        ? 'GitHub rate limit reached. Sign in to raise your limit.'
        : 'GitHub rate limit reached. Try again shortly.'
    }
    if (res.status === 404) {
      return source === 'none'
        ? 'Repository not found. Sign in to view private issues.'
        : 'Repository not found, or your account lacks access.'
    }
    if (res.status === 401) return 'GitHub authentication failed. Try signing in again.'
    return `GitHub request failed (HTTP ${res.status}).`
  }
}
