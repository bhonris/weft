import { describe, it, expect, vi } from 'vitest'
import { DiffService, MAX_VIEWER_FILE_BYTES, type ExecFn } from './diff-service'

const fakeFs = (content: string, size = content.length) => ({
  readFile: vi.fn(async () => content),
  writeFile: vi.fn(async () => {}),
  stat: vi.fn(async () => ({ size }))
})

describe('DiffService', () => {
  it('readFileText returns the file content', async () => {
    const svc = new DiffService(fakeFs('hello'), vi.fn() as unknown as ExecFn)
    expect(await svc.readFileText('/p/a.txt')).toBe('hello')
  })

  it('saveFileText writes content and enforces the 5MB cap', async () => {
    const fsx = fakeFs('old')
    const svc = new DiffService(fsx, vi.fn() as unknown as ExecFn)
    await svc.saveFileText('/p/a.txt', 'new content')
    expect(fsx.writeFile).toHaveBeenCalledWith('/p/a.txt', 'new content', 'utf8')

    await expect(
      svc.saveFileText('/p/a.txt', 'x'.repeat(MAX_VIEWER_FILE_BYTES + 1))
    ).rejects.toThrow(/5 MB/)
  })

  it('rejects files over the 5MB viewer cap with a friendly error', async () => {
    const svc = new DiffService(
      fakeFs('irrelevant', MAX_VIEWER_FILE_BYTES + 1),
      vi.fn() as unknown as ExecFn
    )
    await expect(svc.readFileText('/p/huge.log')).rejects.toThrow(/too large for the viewer/)
    await expect(svc.getDiff('/p/huge.log')).rejects.toThrow(/too large/)
  })

  it('diffs a tracked file against its HEAD blob (quotepath disabled)', async () => {
    const exec: ExecFn = vi.fn(async (_file, args) => {
      if (args.includes('ls-files')) {
        expect(args.slice(0, 2)).toEqual(['-c', 'core.quotepath=false'])
        return { stdout: 'src/a.txt\n' }
      }
      expect(args).toEqual(['-c', 'core.quotepath=false', 'show', 'HEAD:src/a.txt'])
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
      if (args.includes('ls-files')) return { stdout: '' } // untracked
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
