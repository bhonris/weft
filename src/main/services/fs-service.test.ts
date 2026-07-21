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

/** A fake fs whose readdir result depends on the directory path — a small tree. */
function treeFs(tree: Record<string, DirentLike[]>): FsLike {
  return {
    readdir: async (path: string) => tree[path] ?? []
  }
}

describe('FsService.listFilesDeep', () => {
  it('recursively lists files with /-joined relative paths, sorted', async () => {
    const fs = treeFs({
      '/p': [dirent('src', 'dir'), dirent('README.md', 'file')],
      [join('/p', 'src')]: [dirent('index.ts', 'file'), dirent('util', 'dir')],
      [join('/p', 'src', 'util')]: [dirent('math.ts', 'file')]
    })
    const out = await new FsService(fs).listFilesDeep('/p')
    expect(out).toEqual([
      { name: 'README.md', path: join('/p', 'README.md'), rel: 'README.md' },
      { name: 'index.ts', path: join('/p', 'src', 'index.ts'), rel: 'src/index.ts' },
      { name: 'math.ts', path: join('/p', 'src', 'util', 'math.ts'), rel: 'src/util/math.ts' }
    ])
  })

  it('prunes ignored directories before descending', async () => {
    const fs = treeFs({
      '/p': [dirent('node_modules', 'dir'), dirent('src', 'dir')],
      // If node_modules were walked, this file would leak into the result.
      [join('/p', 'node_modules')]: [dirent('leaked.js', 'file')],
      [join('/p', 'src')]: [dirent('app.ts', 'file')]
    })
    const out = await new FsService(fs).listFilesDeep('/p')
    expect(out.map((f) => f.rel)).toEqual(['src/app.ts'])
  })

  it('includes ignored trees when showIgnored is set', async () => {
    const fs = treeFs({
      '/p': [dirent('node_modules', 'dir')],
      [join('/p', 'node_modules')]: [dirent('dep.js', 'file')]
    })
    const out = await new FsService(fs, { showIgnored: true }).listFilesDeep('/p')
    expect(out.map((f) => f.rel)).toEqual(['node_modules/dep.js'])
  })

  it('never follows symlinks — emits them as leaves (cycle safety)', async () => {
    const fs = treeFs({
      // `loop` is a symlinked directory pointing back at the root; walking it
      // would recurse forever. It must be listed but not descended into.
      '/p': [dirent('loop', 'dir'), dirent('a.ts', 'file')],
      [join('/p', 'loop')]: [dirent('a.ts', 'file')]
    })
    // Mark `loop` as a symlink even though isDirectory() is also true.
    const src = fs.readdir
    fs.readdir = async (path, opts) => {
      const entries = await src(path, opts)
      return entries.map((e) =>
        e.name === 'loop' ? { ...e, isSymbolicLink: () => true, isDirectory: () => true } : e
      )
    }
    const out = await new FsService(fs).listFilesDeep('/p')
    expect(out.map((f) => f.rel)).toEqual(['a.ts', 'loop'])
  })

  it('stops descending at maxDepth', async () => {
    const fs = treeFs({
      '/p': [dirent('a', 'dir')],
      [join('/p', 'a')]: [dirent('b', 'dir'), dirent('top.ts', 'file')],
      [join('/p', 'a', 'b')]: [dirent('deep.ts', 'file')]
    })
    // maxDepth 1: root (0) and /p/a (1) are read; /p/a/b (would be depth 2) is not.
    const out = await new FsService(fs, { maxDepth: 1 }).listFilesDeep('/p')
    expect(out.map((f) => f.rel)).toEqual(['a/top.ts'])
  })

  it('caps the number of files returned', async () => {
    const fs = treeFs({
      '/p': [dirent('a.ts', 'file'), dirent('b.ts', 'file'), dirent('c.ts', 'file')]
    })
    const out = await new FsService(fs, { maxFiles: 2 }).listFilesDeep('/p')
    expect(out).toHaveLength(2)
  })
})
