import { join } from 'node:path'
import type { DirEntry, IndexedFile } from '@shared/ipc/api-contract'
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
  /** Deepest directory level the recursive walk descends into (root = 0). */
  maxDepth?: number
  /** Hard cap on files returned by the recursive walk. */
  maxFiles?: number
}

/** Default bounds for {@link FsService.listFilesDeep} — keep a pathological tree
 *  (deep nesting, symlink games) from ever hanging the main process. */
export const DEFAULT_MAX_DEPTH = 24
export const DEFAULT_MAX_FILES = 20000

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

  /**
   * Recursively list every file under `root` for the quick-open finder. Prunes
   * ignored directory names before descending, and — for cycle safety — never
   * follows symlinks: a symlink is emitted as a leaf entry but never walked
   * through. Bounded by `maxDepth` and `maxFiles` so an adversarial or huge
   * tree can't hang the process. Results are sorted by their `/`-joined
   * relative path, case-insensitively, for a stable initial ordering.
   */
  async listFilesDeep(root: string): Promise<IndexedFile[]> {
    const maxDepth = this.options.maxDepth ?? DEFAULT_MAX_DEPTH
    const maxFiles = this.options.maxFiles ?? DEFAULT_MAX_FILES
    const out: IndexedFile[] = []

    const walk = async (dir: string, rel: string, depth: number): Promise<void> => {
      if (out.length >= maxFiles) return
      const dirents = await this.fs.readdir(dir, { withFileTypes: true })
      for (const d of dirents) {
        if (out.length >= maxFiles) return
        if (!this.options.showIgnored && isIgnored(d.name, this.options.ignores)) continue
        const abs = join(dir, d.name)
        const childRel = rel ? `${rel}/${d.name}` : d.name
        // Symlinks are leaves here — following them risks cycles and escaping
        // the root. Real directories recurse until the depth cap.
        if (!d.isSymbolicLink() && d.isDirectory()) {
          if (depth < maxDepth) await walk(abs, childRel, depth + 1)
        } else {
          out.push({ name: d.name, path: abs, rel: childRel })
        }
      }
    }

    await walk(root, '', 0)
    return out.sort((a, b) =>
      a.rel.localeCompare(b.rel, undefined, { sensitivity: 'base' })
    )
  }
}
