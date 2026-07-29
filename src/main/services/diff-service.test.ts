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

describe('DiffService.gitFileDiff', () => {
  it('untracked: empty baseline vs on-disk (no git needed)', async () => {
    const exec = vi.fn()
    const svc = new DiffService(fakeFs('fresh'), exec as unknown as ExecFn)
    expect(await svc.gitFileDiff('/repo/new.txt', 'untracked')).toEqual({
      original: '',
      modified: 'fresh'
    })
    expect(exec).not.toHaveBeenCalled()
  })

  it('staged: HEAD blob vs index blob', async () => {
    const exec: ExecFn = vi.fn(async (_f, args) => {
      if (args.includes('ls-files')) return { stdout: 'src/a.ts\n' }
      if (args.includes('show') && args.includes('HEAD:src/a.ts')) return { stdout: 'head' }
      if (args.includes('show') && args.includes(':src/a.ts')) return { stdout: 'index' }
      throw new Error(`unexpected ${args.join(' ')}`)
    })
    const svc = new DiffService(fakeFs('working'), exec)
    expect(await svc.gitFileDiff('/repo/src/a.ts', 'staged')).toEqual({
      original: 'head',
      modified: 'index'
    })
  })

  it('unstaged: index blob vs on-disk working copy', async () => {
    const exec: ExecFn = vi.fn(async (_f, args) => {
      if (args.includes('ls-files')) return { stdout: 'src/a.ts\n' }
      if (args.includes('show') && args.includes(':src/a.ts')) return { stdout: 'index' }
      throw new Error(`unexpected ${args.join(' ')}`)
    })
    const svc = new DiffService(fakeFs('working'), exec)
    expect(await svc.gitFileDiff('/repo/src/a.ts', 'unstaged')).toEqual({
      original: 'index',
      modified: 'working'
    })
  })

  it('unstaged deletion: on-disk read ENOENT yields an empty modified side', async () => {
    const exec: ExecFn = vi.fn(async (_f, args) => {
      if (args.includes('ls-files')) return { stdout: 'gone.ts\n' }
      if (args.includes('show')) return { stdout: 'was here' }
      throw new Error('unexpected')
    })
    const enoent = Object.assign(new Error('missing'), { code: 'ENOENT' })
    const fsx = {
      readFile: vi.fn(async () => {
        throw enoent
      }),
      writeFile: vi.fn(async () => {}),
      stat: vi.fn(async () => {
        throw enoent
      })
    }
    const svc = new DiffService(fsx, exec)
    expect(await svc.gitFileDiff('/repo/gone.ts', 'unstaged')).toEqual({
      original: 'was here',
      modified: ''
    })
  })

  it('staged new file (no HEAD/index blob): both sides empty', async () => {
    const exec: ExecFn = vi.fn(async (_f, args) => {
      if (args.includes('ls-files')) return { stdout: '' } // not tracked yet
      throw new Error('should not reach git show')
    })
    const svc = new DiffService(fakeFs('x'), exec)
    expect(await svc.gitFileDiff('/repo/added.ts', 'staged')).toEqual({
      original: '',
      modified: ''
    })
  })

  it('propagates a too-large error on the on-disk side', async () => {
    const exec: ExecFn = vi.fn(async (_f, args) => {
      if (args.includes('ls-files')) return { stdout: 'big.ts\n' }
      return { stdout: 'index' }
    })
    const svc = new DiffService(fakeFs('irrelevant', MAX_VIEWER_FILE_BYTES + 1), exec)
    await expect(svc.gitFileDiff('/repo/big.ts', 'unstaged')).rejects.toThrow(/too large/)
  })
})
