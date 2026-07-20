/**
 * Pure parsers for the GitHub OAuth **device flow** responses. The auth service
 * does the HTTP + timing; these turn each JSON body into a typed result it can
 * branch on. No I/O, no clock.
 *
 * Device flow: POST /login/device/code → show user_code + open verification_uri,
 * then poll POST /login/oauth/access_token until it stops returning a pending
 * error and yields an access_token. See docs.github.com "Device flow".
 */

/** The device-code step result. */
export type DeviceCodeResult =
  | {
      ok: true
      deviceCode: string
      userCode: string
      verificationUri: string
      /** Seconds until the code expires. */
      expiresIn: number
      /** Minimum seconds between poll attempts. */
      interval: number
    }
  | { ok: false; error: string }

/** Parse the `POST /login/device/code` body. */
export function parseDeviceCode(body: unknown): DeviceCodeResult {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'malformed response' }
  const r = body as Record<string, unknown>
  const deviceCode = r['device_code']
  const userCode = r['user_code']
  const verificationUri = r['verification_uri']
  if (
    typeof deviceCode !== 'string' ||
    typeof userCode !== 'string' ||
    typeof verificationUri !== 'string'
  ) {
    const err = typeof r['error_description'] === 'string' ? r['error_description'] : 'device code request failed'
    return { ok: false, error: err }
  }
  return {
    ok: true,
    deviceCode,
    userCode,
    verificationUri,
    expiresIn: typeof r['expires_in'] === 'number' ? r['expires_in'] : 900,
    interval: typeof r['interval'] === 'number' ? r['interval'] : 5
  }
}

/** One poll of `POST /login/oauth/access_token`. */
export type TokenPollResult =
  | { kind: 'authorized'; accessToken: string }
  /** Keep polling at the current interval. */
  | { kind: 'pending' }
  /** Back off — increase the interval before polling again. */
  | { kind: 'slow_down' }
  /** Terminal failure (expired, denied, or anything unexpected). */
  | { kind: 'error'; error: string }

/** Parse a device-flow token poll body into the next action. */
export function parseTokenPoll(body: unknown): TokenPollResult {
  if (typeof body !== 'object' || body === null) return { kind: 'error', error: 'malformed response' }
  const r = body as Record<string, unknown>
  const token = r['access_token']
  if (typeof token === 'string' && token.length > 0) {
    return { kind: 'authorized', accessToken: token }
  }
  const error = typeof r['error'] === 'string' ? r['error'] : 'unknown'
  switch (error) {
    case 'authorization_pending':
      return { kind: 'pending' }
    case 'slow_down':
      return { kind: 'slow_down' }
    case 'expired_token':
      return { kind: 'error', error: 'The sign-in code expired. Please try again.' }
    case 'access_denied':
      return { kind: 'error', error: 'Sign-in was cancelled.' }
    default: {
      const desc = typeof r['error_description'] === 'string' ? r['error_description'] : error
      return { kind: 'error', error: desc }
    }
  }
}
