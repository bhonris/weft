import type { ExecFn } from './diff-service'

/**
 * Lightweight git facts for the status bar. Injected exec keeps it unit-testable;
 * every failure (not a repo, no git, detached edge cases) degrades to null —
 * the status bar simply shows nothing.
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
}
