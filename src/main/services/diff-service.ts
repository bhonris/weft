import { dirname, basename } from 'node:path'
import type { DiffPayload } from '@shared/ipc/api-contract'

/** Minimal exec surface — satisfied by child_process.execFile and a fake. */
export type ExecFn = (
  file: string,
  args: string[],
  opts: { cwd: string; maxBuffer?: number }
) => Promise<{ stdout: string }>

export interface DiffFsLike {
  readFile(path: string, encoding: 'utf8'): Promise<string>
}

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

  readFileText(path: string): Promise<string> {
    return this.fs.readFile(path, 'utf8')
  }

  async getDiff(path: string): Promise<DiffPayload> {
    const modified = await this.fs.readFile(path, 'utf8')
    const cwd = dirname(path)
    let original = ''
    try {
      // Repo-relative path of the file, then its HEAD blob.
      const { stdout: rel } = await this.exec(
        'git',
        ['ls-files', '--full-name', '--', basename(path)],
        { cwd }
      )
      const relPath = rel.trim()
      if (relPath.length > 0) {
        const { stdout } = await this.exec('git', ['show', `HEAD:${relPath}`], {
          cwd,
          maxBuffer: 10 * 1024 * 1024
        })
        original = stdout
      }
    } catch {
      // Not a git repo, no HEAD yet, or untracked file → empty baseline.
    }
    return { original, modified }
  }
}
