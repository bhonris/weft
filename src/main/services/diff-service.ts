import { dirname, basename } from 'node:path'
import type { DiffPayload, GitDiffSide } from '@shared/ipc/api-contract'

/** Minimal exec surface — satisfied by child_process.execFile and a fake. */
export type ExecFn = (
  file: string,
  args: string[],
  opts: { cwd: string; maxBuffer?: number }
) => Promise<{ stdout: string }>

export interface DiffFsLike {
  readFile(path: string, encoding: 'utf8'): Promise<string>
  writeFile(path: string, content: string, encoding: 'utf8'): Promise<void>
  stat(path: string): Promise<{ size: number }>
}

/** Files above this land in the viewer as an error, not a multi-second hang. */
export const MAX_VIEWER_FILE_BYTES = 5 * 1024 * 1024

/**
 * Read-only file access + "what changed" diffs for the Monaco pane. The diff
 * baseline is the file's content at git HEAD (`git show HEAD:<relpath>`); for
 * untracked files or non-repos the baseline is empty, which renders as an
 * all-additions diff — exactly what "Claude created this file" looks like.
 */
export class DiffService {
  constructor(
    private readonly fs: DiffFsLike,
    private readonly exec: ExecFn
  ) {}

  private async readGuarded(path: string): Promise<string> {
    const { size } = await this.fs.stat(path)
    if (size > MAX_VIEWER_FILE_BYTES) {
      const mb = (size / (1024 * 1024)).toFixed(1)
      throw new Error(
        `file is ${mb} MB — too large for the viewer (limit 5 MB); use "open with default app" instead`
      )
    }
    return this.fs.readFile(path, 'utf8')
  }

  readFileText(path: string): Promise<string> {
    return this.readGuarded(path)
  }

  /** Write edited viewer content back to disk (content size capped like reads). */
  async saveFileText(path: string, content: string): Promise<void> {
    if (content.length > MAX_VIEWER_FILE_BYTES) {
      throw new Error('content exceeds the 5 MB viewer limit')
    }
    await this.fs.writeFile(path, content, 'utf8')
  }

  async getDiff(path: string): Promise<DiffPayload> {
    const modified = await this.readGuarded(path)
    const cwd = dirname(path)
    let original = ''
    try {
      // Repo-relative path of the file, then its HEAD blob. quotepath=false
      // keeps non-ASCII filenames literal instead of octal-escaped+quoted.
      const { stdout: rel } = await this.exec(
        'git',
        ['-c', 'core.quotepath=false', 'ls-files', '--full-name', '--', basename(path)],
        { cwd }
      )
      const relPath = rel.trim()
      if (relPath.length > 0) {
        const { stdout } = await this.exec(
          'git',
          ['-c', 'core.quotepath=false', 'show', `HEAD:${relPath}`],
          {
            cwd,
            maxBuffer: 10 * 1024 * 1024
          }
        )
        original = stdout
      }
    } catch {
      // Not a git repo, no HEAD yet, or untracked file → empty baseline.
    }
    return { original, modified }
  }

  /** On-disk content, or '' when the file no longer exists (a deletion diff). */
  private async readDiskOrEmpty(path: string): Promise<string> {
    try {
      return await this.readGuarded(path)
    } catch (e) {
      // A missing file is a deletion (empty side); a too-large file is a real
      // error the viewer should still see.
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return ''
      throw e
    }
  }

  /**
   * The correct diff pair for one changed file in the Source Control panel:
   * - `untracked`: empty baseline vs on-disk (an all-additions diff).
   * - `staged`: HEAD blob vs the staged (index) blob.
   * - `unstaged`: the staged/HEAD blob vs the on-disk working copy.
   *
   * Repo-relative path resolution + `git show` mirror {@link getDiff}.
   */
  async gitFileDiff(path: string, side: GitDiffSide): Promise<DiffPayload> {
    if (side === 'untracked') {
      return { original: '', modified: await this.readGuarded(path) }
    }

    const cwd = dirname(path)
    let rel = ''
    try {
      const { stdout } = await this.exec(
        'git',
        ['-c', 'core.quotepath=false', 'ls-files', '--full-name', '--', basename(path)],
        { cwd }
      )
      rel = stdout.trim()
    } catch {
      rel = ''
    }

    const show = async (ref: string): Promise<string> => {
      try {
        const { stdout } = await this.exec(
          'git',
          ['-c', 'core.quotepath=false', 'show', ref],
          { cwd, maxBuffer: 10 * 1024 * 1024 }
        )
        return stdout
      } catch {
        // No such blob (e.g. a newly-added file has no HEAD/index entry yet).
        return ''
      }
    }

    if (side === 'staged') {
      const original = rel.length > 0 ? await show(`HEAD:${rel}`) : ''
      const modified = rel.length > 0 ? await show(`:${rel}`) : ''
      return { original, modified }
    }
    // unstaged: baseline is the staged (index) blob, target is the working copy.
    const original = rel.length > 0 ? await show(`:${rel}`) : ''
    const modified = await this.readDiskOrEmpty(path)
    return { original, modified }
  }
}
