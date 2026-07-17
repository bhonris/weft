import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { FsService, type DirentLike, type FsLike } from './fs-service'

function dirent(name: string, kind: 'dir' | 'file' | 'symlink'): DirentLike {
  return {
    name,
    isDirectory: () => kind === 'dir',
    isSymbolicLink: () => kind === 'symlink'
  }
}

function fakeFs(entries: DirentLike[]): FsLike {
  return {
    readdir: async () => entries
  }
}

describe('FsService.listDir', () => {
  it('maps dirents to sorted DirEntry with joined paths and kinds', async () => {
    const fs = fakeFs([
      dirent('README.md', 'file'),
      dirent('src', 'dir'),
      dirent('link', 'symlink')
    ])
    const svc = new FsService(fs)
    const out = await svc.listDir('/project')

    expect(out).toEqual([
      { name: 'src', path: join('/project', 'src'), kind: 'dir' },
      { name: 'link', path: join('/project', 'link'), kind: 'symlink' },
      { name: 'README.md', path: join('/project', 'README.md'), kind: 'file' }
    ])
  })

  it('filters ignored directories by default', async () => {
    const fs = fakeFs([dirent('node_modules', 'dir'), dirent('src', 'dir')])
    const out = await new FsService(fs).listDir('/p')
    expect(out.map((e) => e.name)).toEqual(['src'])
  })

  it('includes ignored entries when showIgnored is set', async () => {
    const fs = fakeFs([dirent('node_modules', 'dir'), dirent('src', 'dir')])
    const out = await new FsService(fs, { showIgnored: true }).listDir('/p')
    expect(out.map((e) => e.name)).toEqual(['node_modules', 'src'])
  })

  it('honors a custom ignore set', async () => {
    const fs = fakeFs([dirent('dist', 'dir'), dirent('src', 'dir')])
    const out = await new FsService(fs, { ignores: new Set(['dist']) }).listDir('/p')
    expect(out.map((e) => e.name)).toEqual(['src'])
  })
})
