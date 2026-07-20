import { describe, it, expect } from 'vitest'
import { parseDeviceCode, parseTokenPoll } from './device-flow'

describe('parseDeviceCode', () => {
  it('parses a valid device-code response', () => {
    expect(
      parseDeviceCode({
        device_code: 'dev123',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 899,
        interval: 6
      })
    ).toEqual({
      ok: true,
      deviceCode: 'dev123',
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device',
      expiresIn: 899,
      interval: 6
    })
  })

  it('defaults expires_in and interval when absent', () => {
    const r = parseDeviceCode({
      device_code: 'd',
      user_code: 'U',
      verification_uri: 'https://github.com/login/device'
    })
    expect(r).toMatchObject({ ok: true, expiresIn: 900, interval: 5 })
  })

  it('reports an error body', () => {
    expect(parseDeviceCode({ error: 'x', error_description: 'bad client' })).toEqual({
      ok: false,
      error: 'bad client'
    })
  })

  it('rejects malformed input', () => {
    expect(parseDeviceCode(null)).toEqual({ ok: false, error: 'malformed response' })
    expect(parseDeviceCode({}).ok).toBe(false)
  })
})

describe('parseTokenPoll', () => {
  it('returns the access token when authorized', () => {
    expect(parseTokenPoll({ access_token: 'gho_abc' })).toEqual({
      kind: 'authorized',
      accessToken: 'gho_abc'
    })
  })

  it('maps authorization_pending to pending', () => {
    expect(parseTokenPoll({ error: 'authorization_pending' })).toEqual({ kind: 'pending' })
  })

  it('maps slow_down to slow_down', () => {
    expect(parseTokenPoll({ error: 'slow_down' })).toEqual({ kind: 'slow_down' })
  })

  it('maps expired_token and access_denied to terminal errors', () => {
    expect(parseTokenPoll({ error: 'expired_token' }).kind).toBe('error')
    expect(parseTokenPoll({ error: 'access_denied' }).kind).toBe('error')
  })

  it('surfaces an unknown error_description', () => {
    expect(parseTokenPoll({ error: 'boom', error_description: 'the roof' })).toEqual({
      kind: 'error',
      error: 'the roof'
    })
  })

  it('rejects malformed input', () => {
    expect(parseTokenPoll(null)).toEqual({ kind: 'error', error: 'malformed response' })
    expect(parseTokenPoll({}).kind).toBe('error')
  })
})
