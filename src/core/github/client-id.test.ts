import { describe, it, expect } from 'vitest'
import { DEFAULT_GITHUB_CLIENT_ID, resolveGithubClientId } from './client-id'

const noEnv = (): undefined => undefined
const env = (value: string | undefined) => (name: string): string | undefined =>
  name === 'WEFT_GITHUB_CLIENT_ID' ? value : undefined

describe('resolveGithubClientId', () => {
  it('prefers the WEFT_GITHUB_CLIENT_ID env var over the shipped fallback', () => {
    expect(resolveGithubClientId(env('Iv1.env'), 'Iv1.constant')).toBe('Iv1.env')
  })

  it('trims surrounding whitespace on the env value', () => {
    expect(resolveGithubClientId(env('  Iv1.env  '))).toBe('Iv1.env')
  })

  it('falls back to the shipped constant when the env var is unset', () => {
    expect(resolveGithubClientId(noEnv, 'Iv1.constant')).toBe('Iv1.constant')
  })

  it('falls back to the shipped constant when the env var is blank', () => {
    expect(resolveGithubClientId(env('   '), 'Iv1.constant')).toBe('Iv1.constant')
  })

  it('trims the fallback constant', () => {
    expect(resolveGithubClientId(noEnv, '  Iv1.constant  ')).toBe('Iv1.constant')
  })

  it('returns null when neither env nor fallback provide a value', () => {
    expect(resolveGithubClientId(noEnv, '')).toBeNull()
    expect(resolveGithubClientId(env(''), '   ')).toBeNull()
  })

  it('uses the module default constant when no fallback is passed', () => {
    // Ships empty by default → sign-in disabled until an id is dropped in.
    const expected = DEFAULT_GITHUB_CLIENT_ID.trim().length > 0 ? DEFAULT_GITHUB_CLIENT_ID.trim() : null
    expect(resolveGithubClientId(noEnv)).toBe(expected)
  })
})
