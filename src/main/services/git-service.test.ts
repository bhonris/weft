import { describe, it, expect, vi } from 'vitest'
import { GitService } from './git-service'
import type { ExecFn } from './diff-service'

describe('GitService.currentBranch', () => {
  it('returns the branch name', async () => {
    const exec: ExecFn = vi.fn(async (_f, args, opts) => {
      expect(args).toEqual(['rev-parse', '--abbrev-ref', 'HEAD'])
      expect(opts.cwd).toBe('C:/repo')
      return { stdout: 'main\n' }
    })
    expect(await new GitService(exec).currentBranch('C:/repo')).toBe('main')
  })

  it('marks a detached HEAD', async () => {
    const exec: ExecFn = vi.fn(async () => ({ stdout: 'HEAD\n' }))
    expect(await new GitService(exec).currentBranch('C:/repo')).toBe('(detached)')
  })

  it('returns null outside a repo (git errors)', async () => {
    const exec: ExecFn = vi.fn(async () => {
      throw new Error('not a git repository')
    })
    expect(await new GitService(exec).currentBranch('C:/plain')).toBeNull()
  })

  it('returns null for empty output', async () => {
    const exec: ExecFn = vi.fn(async () => ({ stdout: '\n' }))
    expect(await new GitService(exec).currentBranch('C:/x')).toBeNull()
  })
})
