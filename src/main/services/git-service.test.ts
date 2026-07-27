import { describe, it, expect, vi } from 'vitest'
import { join } from 'node:path'
import { GitService } from './git-service'
import type { ExecFn } from './diff-service'

/**
 * A fake `exec` that answers `git` calls by matching a prefix of the args, so a
 * single test can script `rev-parse` + `status` + a mutation. Unmatched calls
 * throw (an unexpected git invocation should fail loudly).
 */
function scriptedExec(routes: Array<{ match: string[]; stdout?: string; reject?: unknown }>): ExecFn {
  return vi.fn(async (_file, args) => {
    for (const r of routes) {
      if (r.match.every((m, i) => args[i] === m)) {
        if (r.reject !== undefined) throw r.reject
        return { stdout: r.stdout ?? '' }
      }
    }
    throw new Error(`unexpected git ${args.join(' ')}`)
  })
}

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

describe('GitService.remoteUrl', () => {
  it('returns the origin remote URL', async () => {
    const exec: ExecFn = vi.fn(async (_f, args, opts) => {
      expect(args).toEqual(['remote', 'get-url', 'origin'])
      expect(opts.cwd).toBe('C:/repo')
      return { stdout: 'https://github.com/o/r.git\n' }
    })
    expect(await new GitService(exec).remoteUrl('C:/repo')).toBe('https://github.com/o/r.git')
  })

  it('returns null when there is no origin (git errors)', async () => {
    const exec: ExecFn = vi.fn(async () => {
      throw new Error('No such remote')
    })
    expect(await new GitService(exec).remoteUrl('C:/repo')).toBeNull()
  })

  it('returns null for empty output', async () => {
    const exec: ExecFn = vi.fn(async () => ({ stdout: '\n' }))
    expect(await new GitService(exec).remoteUrl('C:/repo')).toBeNull()
  })
})

describe('GitService.status', () => {
  it('returns a non-repo empty result for a null cwd (no git call)', async () => {
    const exec = vi.fn()
    const out = await new GitService(exec as unknown as ExecFn).status(null)
    expect(out.isRepo).toBe(false)
    expect(out.changes).toEqual([])
    expect(exec).not.toHaveBeenCalled()
  })

  it('resolves absolute paths from the repo toplevel and parses branch + changes', async () => {
    const exec = scriptedExec([
      { match: ['rev-parse', '--show-toplevel'], stdout: '/repo\n' },
      {
        match: ['-c', 'core.quotepath=false', 'status'],
        stdout:
          '# branch.head main\0# branch.ab +1 -0\0' +
          '1 M. N... 100644 100644 100644 a b src/a.ts\0' +
          '? new.txt\0'
      }
    ])
    const out = await new GitService(exec).status('/repo')
    expect(out.isRepo).toBe(true)
    expect(out.branch).toBe('main')
    expect(out.ahead).toBe(1)
    expect(out.changes).toEqual([
      { path: join('/repo', 'src/a.ts'), rel: 'src/a.ts', group: 'staged', status: 'M' },
      { path: join('/repo', 'new.txt'), rel: 'new.txt', group: 'untracked', status: '?' }
    ])
  })

  it('carries a rename origRel through to an absolute-path change', async () => {
    const exec = scriptedExec([
      { match: ['rev-parse', '--show-toplevel'], stdout: '/repo\n' },
      {
        match: ['-c', 'core.quotepath=false', 'status'],
        stdout: '2 R. N... 100644 100644 100644 a b R100 new.ts\0old.ts\0'
      }
    ])
    const out = await new GitService(exec).status('/repo')
    expect(out.changes[0]).toEqual({
      path: join('/repo', 'new.ts'),
      rel: 'new.ts',
      origRel: 'old.ts',
      group: 'staged',
      status: 'R'
    })
  })

  it('degrades to a non-repo result when git errors', async () => {
    const exec: ExecFn = vi.fn(async () => {
      throw new Error('not a git repository')
    })
    const out = await new GitService(exec).status('/plain')
    expect(out).toEqual({
      isRepo: false,
      branch: null,
      upstream: null,
      ahead: 0,
      behind: 0,
      changes: [],
      error: null
    })
  })

  it('degrades when the toplevel is empty', async () => {
    const exec = scriptedExec([{ match: ['rev-parse', '--show-toplevel'], stdout: '\n' }])
    expect((await new GitService(exec).status('/x')).isRepo).toBe(false)
  })
})

describe('GitService mutations', () => {
  it('stages paths with `git add --`', async () => {
    const exec = vi.fn(async () => ({ stdout: '' }))
    await new GitService(exec as unknown as ExecFn).stage('/repo', ['a.ts', 'b.ts'])
    expect(exec).toHaveBeenCalledWith('git', ['add', '--', 'a.ts', 'b.ts'], { cwd: '/repo' })
  })

  it('unstages with `git reset -q HEAD --`', async () => {
    const exec = vi.fn(async () => ({ stdout: '' }))
    await new GitService(exec as unknown as ExecFn).unstage('/repo', ['a.ts'])
    expect(exec).toHaveBeenCalledWith('git', ['reset', '-q', 'HEAD', '--', 'a.ts'], { cwd: '/repo' })
  })

  it('discards tracked paths with `git checkout --`', async () => {
    const exec = vi.fn(async () => ({ stdout: '' }))
    await new GitService(exec as unknown as ExecFn).discard('/repo', ['a.ts'], false)
    expect(exec).toHaveBeenCalledWith('git', ['checkout', '--', 'a.ts'], { cwd: '/repo' })
  })

  it('deletes untracked paths with `git clean -f --`', async () => {
    const exec = vi.fn(async () => ({ stdout: '' }))
    await new GitService(exec as unknown as ExecFn).discard('/repo', ['junk.log'], true)
    expect(exec).toHaveBeenCalledWith('git', ['clean', '-f', '--', 'junk.log'], { cwd: '/repo' })
  })

  it('commits with the message', async () => {
    const exec = vi.fn(async () => ({ stdout: '' }))
    await new GitService(exec as unknown as ExecFn).commit('/repo', 'feat: x')
    expect(exec).toHaveBeenCalledWith('git', ['commit', '-m', 'feat: x'], { cwd: '/repo' })
  })

  it('pushes and pulls', async () => {
    const exec = vi.fn(async () => ({ stdout: '' }))
    const svc = new GitService(exec as unknown as ExecFn)
    await svc.push('/repo')
    await svc.pull('/repo')
    expect(exec).toHaveBeenCalledWith('git', ['push'], { cwd: '/repo' })
    expect(exec).toHaveBeenCalledWith('git', ['pull'], { cwd: '/repo' })
  })

  it('rejects with git stderr when a mutation fails', async () => {
    const exec: ExecFn = vi.fn(async () => {
      throw { stderr: 'error: pathspec did not match\n', message: 'Command failed' }
    })
    await expect(new GitService(exec).commit('/repo', 'x')).rejects.toThrow(
      'error: pathspec did not match'
    )
  })

  it('falls back to the error message when there is no stderr', async () => {
    const exec: ExecFn = vi.fn(async () => {
      throw new Error('spawn git ENOENT')
    })
    await expect(new GitService(exec).push('/repo')).rejects.toThrow('spawn git ENOENT')
  })

  it('uses a generic message when neither stderr nor message is present', async () => {
    const exec: ExecFn = vi.fn(async () => {
      throw {}
    })
    await expect(new GitService(exec).pull('/repo')).rejects.toThrow('git command failed')
  })
})
