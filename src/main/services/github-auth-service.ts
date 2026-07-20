import { parseDeviceCode, parseTokenPoll } from '@core/github/device-flow'
import type { GithubAuthEvent, GithubSignInResult } from '@shared/ipc/api-contract'
import type { ExecFn } from './diff-service'
import type { GithubAuth, GithubFetchLike } from './github-service'

/**
 * A tiny token store (a slice of electron-store). Values are the raw token
 * string; `delete` removes it (sign-out). Never surfaced to the renderer.
 */
export interface TokenStore {
  get(): string | null
  set(token: string): void
  delete(): void
}

export interface GithubAuthDeps {
  fetch: GithubFetchLike
  /** For `gh auth token`. Same ExecFn as the git/diff services. */
  exec: ExecFn
  /** Read an env var (GITHUB_TOKEN). Injected for tests. */
  getEnv: (name: string) => string | undefined
  /** Persisted device-flow token. */
  store: TokenStore
  /** Open the verification URI in the browser (shell.openExternal). */
  openExternal: (url: string) => Promise<void> | void
  /** Push a device-flow progress/terminal event to the renderer. */
  emit: (event: GithubAuthEvent) => void
  now: () => number
  /** Injected delay between poll attempts (real setTimeout in prod). */
  sleep: (ms: number) => Promise<void>
  /** GitHub OAuth App client id for the device flow; null disables sign-in. */
  clientId: string | null
  /** OAuth scope requested; 'repo' is needed to read private-repo issues. */
  scope?: string
  /** cwd for the `gh` exec (any dir). */
  cwd?: string
  /** How long a resolved token is reused before re-checking gh/env (default 10s). */
  authCacheMs?: number
  /** Overridable endpoints for tests. */
  deviceCodeUrl?: string
  tokenUrl?: string
}

const DEFAULT_DEVICE_CODE_URL = 'https://github.com/login/device/code'
const DEFAULT_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const DEFAULT_SCOPE = 'repo'
const DEFAULT_AUTH_CACHE_MS = 10 * 1000

/**
 * Resolves the GitHub token for the Issues panel and runs the OAuth device flow.
 *
 * Resolution order honours an existing `gh` login first, then a `GITHUB_TOKEN`
 * env var, then a token the user stored via in-app sign-in, else unauthenticated.
 * The resolved value is cached briefly so polling the panel doesn't spawn a `gh`
 * process every tick. The token never leaves the main process.
 */
export class GithubAuthService {
  private cachedAuth: { value: GithubAuth; at: number } | null = null

  constructor(private readonly deps: GithubAuthDeps) {}

  /** Resolve the active token + source: gh → env → stored → none (cached). */
  async resolveAuth(): Promise<GithubAuth> {
    const now = this.deps.now()
    const ttl = this.deps.authCacheMs ?? DEFAULT_AUTH_CACHE_MS
    if (this.cachedAuth && now - this.cachedAuth.at < ttl) return this.cachedAuth.value

    const value = await this.resolveUncached()
    this.cachedAuth = { value, at: now }
    return value
  }

  private async resolveUncached(): Promise<GithubAuth> {
    const gh = await this.ghToken()
    if (gh) return { token: gh, source: 'gh' }

    const env = this.deps.getEnv('GITHUB_TOKEN')?.trim()
    if (env) return { token: env, source: 'env' }

    const stored = this.deps.store.get()?.trim()
    if (stored) return { token: stored, source: 'oauth' }

    return { token: null, source: 'none' }
  }

  /** `gh auth token`, or null when gh is missing / not logged in. */
  private async ghToken(): Promise<string | null> {
    try {
      const { stdout } = await this.deps.exec('gh', ['auth', 'token'], {
        cwd: this.deps.cwd ?? '.'
      })
      const token = stdout.trim()
      return token.length > 0 ? token : null
    } catch {
      return null
    }
  }

  /** Forget the stored device-flow token. gh/env sources are unaffected. */
  signOut(): void {
    this.deps.store.delete()
    this.cachedAuth = null
  }

  /**
   * Begin the OAuth device flow: request a device code, open the browser to the
   * verification URI, and start polling in the background. Returns the code to
   * display; the terminal outcome arrives via {@link GithubAuthDeps.emit}.
   */
  async beginDeviceFlow(): Promise<GithubSignInResult> {
    if (!this.deps.clientId) {
      return { error: 'GitHub sign-in is not configured in this build.' }
    }
    let parsed
    try {
      const res = await this.deps.fetch(this.deps.deviceCodeUrl ?? DEFAULT_DEVICE_CODE_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'weft' },
        body: JSON.stringify({
          client_id: this.deps.clientId,
          scope: this.deps.scope ?? DEFAULT_SCOPE
        })
      })
      parsed = parseDeviceCode(await res.json())
    } catch {
      return { error: 'Could not reach GitHub to start sign-in.' }
    }
    if (!parsed.ok) return { error: parsed.error }

    // Best-effort browser open — failure is non-fatal (the code + URI are shown).
    try {
      await this.deps.openExternal(parsed.verificationUri)
    } catch {
      /* user can open it manually */
    }

    // Poll in the background; do not await (the invoke returns the code now).
    void this.pollForToken(parsed.deviceCode, parsed.interval, parsed.expiresIn)

    return {
      userCode: parsed.userCode,
      verificationUri: parsed.verificationUri,
      expiresInSec: parsed.expiresIn
    }
  }

  private async pollForToken(
    deviceCode: string,
    interval: number,
    expiresIn: number
  ): Promise<void> {
    const deadline = this.deps.now() + expiresIn * 1000
    let waitMs = Math.max(1, interval) * 1000

    while (this.deps.now() < deadline) {
      await this.deps.sleep(waitMs)
      let result
      try {
        const res = await this.deps.fetch(this.deps.tokenUrl ?? DEFAULT_TOKEN_URL, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'weft' },
          body: JSON.stringify({
            client_id: this.deps.clientId,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          })
        })
        result = parseTokenPoll(await res.json())
      } catch {
        // Transient network hiccup — keep polling until the deadline.
        continue
      }

      if (result.kind === 'authorized') {
        this.deps.store.set(result.accessToken)
        this.cachedAuth = null // force a fresh resolve on the next panel poll
        this.deps.emit({ state: 'authorized' })
        return
      }
      if (result.kind === 'slow_down') {
        waitMs += 5000
        continue
      }
      if (result.kind === 'error') {
        this.deps.emit({ state: 'error', message: result.error })
        return
      }
      // pending — keep waiting
    }
    this.deps.emit({ state: 'error', message: 'Sign-in timed out. Please try again.' })
  }
}
