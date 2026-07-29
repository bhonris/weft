import { join } from 'node:path'
import type { ExecFn } from './diff-service'
import { parseStatus } from '@core/scm/porcelain'
import type { GitRepoStatus } from '@shared/ipc/api-contract'

/** The `git status` porcelain=v2 arguments — quotepath off keeps non-ASCII literal. */
const STATUS_ARGS = ['-c', 'core.quotepath=false', 'status', '--porcelain=v2', '--branch', '-z']

/** Pull a human message out of a rejected exec (git's stderr, then its message). */
function gitError(e: unknown): string {
  const err = e as { stderr?: unknown; message?: unknown }
  const stderr = typeof err.stderr === 'string' ? err.stderr.trim() : ''
  if (stderr.length > 0) return stderr
  return typeof err.message === 'string' && err.message.length > 0 ? err.message : 'git command failed'
}

/**
 * Git facts + working-tree mutations. Injected `exec` keeps it unit-testable.
 *
 * Two error contracts, by design:
 * - **Read-only** methods (`currentBranch`, `remoteUrl`, `status`) degrade to a
 *   null/empty result on any failure — the UI simply shows nothing / an empty
 *   repo state.
 * - **Mutations** (`stage`/`unstage`/`discard`/`commit`/`push`/`pull`) REJECT
 *   with git's stderr, so the Source Control panel can surface the failure.
 */
export class GitService {
  constructor(private readonly exec: ExecFn) {}

  /** Current branch name for `cwd`, `(detached)` at a detached HEAD, or null. */
  async currentBranch(cwd: string): Promise<string | null> {
    try {
      const { stdout } = await this.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd })
      const branch = stdout.trim()
      if (branch.length === 0) return null
      return branch === 'HEAD' ? '(detached)' : branch
    } catch {
      return null
    }
  }

  /**
   * The `origin` remote URL for `cwd`, or null when there is no origin / not a
   * repo. Used to detect the GitHub `owner/repo` for the Issues panel.
   */
  async remoteUrl(cwd: string): Promise<string | null> {
    try {
      const { stdout } = await this.exec('git', ['remote', 'get-url', 'origin'], { cwd })
      const url = stdout.trim()
      return url.length === 0 ? null : url
    } catch {
      return null
    }
  }

  /**
   * Full working-tree status for the Source Control panel. Degrades to
   * `{ isRepo: false }` when `cwd` is null / not a repo (never rejects). Each
   * parsed change's repo-relative path is resolved to an absolute path from the
   * repo toplevel so the renderer can open its diff.
   */
  async status(cwd: string | null): Promise<GitRepoStatus> {
    const empty: GitRepoStatus = {
      isRepo: false,
      branch: null,
      upstream: null,
      ahead: 0,
      behind: 0,
      changes: [],
      error: null
    }
    if (!cwd) return empty
    try {
      const { stdout: top } = await this.exec('git', ['rev-parse', '--show-toplevel'], { cwd })
      const root = top.trim()
      if (root.length === 0) return empty
      const { stdout } = await this.exec('git', STATUS_ARGS, { cwd, maxBuffer: 10 * 1024 * 1024 })
      const parsed = parseStatus(stdout)
      return {
        isRepo: true,
        branch: parsed.branch,
        upstream: parsed.upstream,
        ahead: parsed.ahead,
        behind: parsed.behind,
        changes: parsed.changes.map((c) => ({
          path: join(root, c.rel),
          rel: c.rel,
          ...(c.origRel ? { origRel: c.origRel } : {}),
          group: c.group,
          status: c.status
        })),
        error: null
      }
    } catch {
      return empty
    }
  }

  /** Run a mutating git command, rejecting with its stderr on failure. */
  private async run(cwd: string, args: string[]): Promise<void> {
    try {
      await this.exec('git', args, { cwd })
    } catch (e) {
      throw new Error(gitError(e))
    }
  }

  /** Stage paths (`git add`); staging also records deletions in modern git. */
  stage(cwd: string, paths: string[]): Promise<void> {
    return this.run(cwd, ['add', '--', ...paths])
  }

  /** Unstage paths back to HEAD (`git reset`). */
  unstage(cwd: string, paths: string[]): Promise<void> {
    return this.run(cwd, ['reset', '-q', 'HEAD', '--', ...paths])
  }

  /**
   * Discard changes — irreversible. Untracked paths are deleted (`git clean`);
   * tracked paths are reverted to the index/HEAD version (`git checkout --`).
   */
  discard(cwd: string, paths: string[], untracked: boolean): Promise<void> {
    return untracked
      ? this.run(cwd, ['clean', '-f', '--', ...paths])
      : this.run(cwd, ['checkout', '--', ...paths])
  }

  /** Commit the staged changes with `message`. */
  commit(cwd: string, message: string): Promise<void> {
    return this.run(cwd, ['commit', '-m', message])
  }

  /** Push the current branch. */
  push(cwd: string): Promise<void> {
    return this.run(cwd, ['push'])
  }

  /** Pull the current branch. */
  pull(cwd: string): Promise<void> {
    return this.run(cwd, ['pull'])
  }
}
