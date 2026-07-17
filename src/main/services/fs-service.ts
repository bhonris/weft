import { join } from 'node:path'
import type { DirEntry } from '@shared/ipc/api-contract'
import { sortEntries, isIgnored } from '@core/fs/dir-sort'

/** A directory entry as returned by `fs.readdir(..., { withFileTypes: true })`. */
export interface DirentLike {
  name: string
  isDirectory(): boolean
  isSymbolicLink(): boolean
}

/** The filesystem surface FsService needs — satisfied by `node:fs/promises` and a fake. */
export interface FsLike {
  readdir(path: string, opts: { withFileTypes: true }): Promise<DirentLike[]>
}

export interface FsServiceOptions {
  ignores?: ReadonlySet<string>
  /** Include ignored entries (node_modules/.git…) when true. */
  showIgnored?: boolean
}

/** Lists directories for the explorer tree. Pure logic (sort/ignore) lives in core. */
export class FsService {
  constructor(
    private readonly fs: FsLike,
    private readonly options: FsServiceOptions = {}
  ) {}

  async listDir(dirPath: string): Promise<DirEntry[]> {
    const dirents = await this.fs.readdir(dirPath, { withFileTypes: true })
    const entries: DirEntry[] = []
    for (const d of dirents) {
      if (!this.options.showIgnored && isIgnored(d.name, this.options.ignores)) continue
      entries.push({
        name: d.name,
        path: join(dirPath, d.name),
        kind: d.isSymbolicLink() ? 'symlink' : d.isDirectory() ? 'dir' : 'file'
      })
    }
    return sortEntries(entries)
  }
}
