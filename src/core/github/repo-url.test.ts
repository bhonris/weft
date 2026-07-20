import { describe, it, expect } from 'vitest'
import { parseRepoSlug } from './repo-url'

describe('parseRepoSlug', () => {
  it('parses an https URL with .git suffix', () => {
    expect(parseRepoSlug('https://github.com/octo/hello.git')).toEqual({
      owner: 'octo',
      repo: 'hello'
    })
  })

  it('parses an https URL without .git', () => {
    expect(parseRepoSlug('https://github.com/octo/hello')).toEqual({ owner: 'octo', repo: 'hello' })
  })

  it('parses an https URL with a trailing slash', () => {
    expect(parseRepoSlug('https://github.com/octo/hello/')).toEqual({ owner: 'octo', repo: 'hello' })
  })

  it('parses a scp-like SSH remote', () => {
    expect(parseRepoSlug('git@github.com:octo/hello.git')).toEqual({ owner: 'octo', repo: 'hello' })
  })

  it('parses an ssh:// remote', () => {
    expect(parseRepoSlug('ssh://git@github.com/octo/hello.git')).toEqual({
      owner: 'octo',
      repo: 'hello'
    })
  })

  it('trims surrounding whitespace/newlines from `git remote get-url`', () => {
    expect(parseRepoSlug('  https://github.com/octo/hello.git\n')).toEqual({
      owner: 'octo',
      repo: 'hello'
    })
  })

  it('handles repo names containing dots (only the final .git is stripped)', () => {
    expect(parseRepoSlug('https://github.com/octo/my.cool.repo.git')).toEqual({
      owner: 'octo',
      repo: 'my.cool.repo'
    })
  })

  it('rejects a non-github host', () => {
    expect(parseRepoSlug('https://gitlab.com/octo/hello.git')).toBeNull()
    expect(parseRepoSlug('git@bitbucket.org:octo/hello.git')).toBeNull()
  })

  it('rejects empty / malformed input', () => {
    expect(parseRepoSlug('')).toBeNull()
    expect(parseRepoSlug('   ')).toBeNull()
    expect(parseRepoSlug('not a url')).toBeNull()
    expect(parseRepoSlug('https://github.com/onlyowner')).toBeNull()
  })

  it('rejects a URL with an extra path segment (repo cannot contain a slash)', () => {
    expect(parseRepoSlug('https://github.com/octo/hello/tree/main')).toBeNull()
  })
})
