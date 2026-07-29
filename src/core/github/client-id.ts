/**
 * The public GitHub OAuth App client id shipped with weft, enabling the in-app
 * device-flow "Sign in with GitHub".
 *
 * PUBLIC BY DESIGN: the OAuth device grant uses no client secret, so embedding
 * this id in a distributed desktop build is expected and safe.
 *
 * ┌─ TO ENABLE IN-APP SIGN-IN ───────────────────────────────────────────────┐
 * │ 1. Register a GitHub OAuth App:                                           │
 * │      https://github.com/settings/applications/new                        │
 * │    and tick **Enable Device Flow**.                                      │
 * │ 2. Copy its **Client ID** and paste it below, replacing the empty string.│
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Leaving it empty keeps sign-in disabled ("not configured"); the gh CLI,
 * GITHUB_TOKEN, and unauthenticated paths all work regardless. The
 * `WEFT_GITHUB_CLIENT_ID` env var overrides this constant at runtime.
 */
export const DEFAULT_GITHUB_CLIENT_ID = 'Ov23liYTCa1qaD9x5R8X'

/**
 * Resolve the effective client id: the `WEFT_GITHUB_CLIENT_ID` env var wins,
 * else the shipped {@link DEFAULT_GITHUB_CLIENT_ID}, else `null` (which disables
 * device-flow sign-in). `fallback` is injectable so both branches are testable
 * without mutating the module constant.
 */
export function resolveGithubClientId(
  getEnv: (name: string) => string | undefined,
  fallback: string = DEFAULT_GITHUB_CLIENT_ID
): string | null {
  const fromEnv = getEnv('WEFT_GITHUB_CLIENT_ID')?.trim()
  if (fromEnv) return fromEnv
  const trimmed = fallback.trim()
  return trimmed.length > 0 ? trimmed : null
}
