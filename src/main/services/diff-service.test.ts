import { describe, it, expect, vi } from 'vitest'
import { DiffService, type ExecFn } from './diff-service'

const fakeFs = (content: string) => ({
  readFile: vi.fn(async () => content)
})

describe('DiffService', () => {
  it('readFileText returns the file content', async () => {
    const svc = new DiffService(fakeFs('hello'), vi.fn() as unknown as ExecFn)
    expect(await svc.readFileText('/p/a.txt')).toBe('hello')
  })

  it('diffs a tracked file against its HEAD blob', async () => {
    const exec: ExecFn = vi.fn(async (_file, args) => {
      if (args[0] === 'ls-files') return { stdout: 'src/a.txt\n' }
      expect(args).toEqual(['show', 'HEAD:src/a.txt'])
      return { stdout: 'old content' }
    })
    const svc = new DiffService(fakeFs('new content'), exec)
    expect(await svc.getDiff('/repo/src/a.txt')).toEqual({
      original: 'old content',
      modified: 'new content'
    })
  })

  it('uses an empty baseline for untracked files', async () => {
    const exec: ExecFn = vi.fn(async (_f, args) => {
      if (args[0] === 'ls-files') return { stdout: '' } // untracked
      throw new Error('should not call git show')
    })
    const svc = new DiffService(fakeFs('brand new'), exec)
    expect(await svc.getDiff('/repo/new.txt')).toEqual({
      original: '',
      modified: 'brand new'
    })
  })

  it('uses an empty baseline outside a git repo (git fails)', async () => {
    const exec: ExecFn = vi.fn(async () => {
      throw new Error('not a git repository')
    })
    const svc = new DiffService(fakeFs('content'), exec)
    expect(await svc.getDiff('/no-repo/x.txt')).toEqual({
      original: '',
      modified: 'content'
    })
  })
})
