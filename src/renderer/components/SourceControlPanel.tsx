import { useState } from 'react'
import { useScmStore } from '../store/scm-store'
import { useViewerStore } from '../store/viewer-store'
import { changeCount } from '@core/scm/porcelain'
import type { GitFileChange, GitDiffSide, ScmGroup } from '@shared/ipc/api-contract'
import { ConfirmDialog } from './ConfirmDialog'

/** Human title for each change group (VS Code's section headings). */
const GROUP_TITLE: Record<ScmGroup, string> = {
  conflict: 'Merge Changes',
  staged: 'Staged Changes',
  unstaged: 'Changes',
  untracked: 'Untracked'
}

/** Descriptive label for each status letter (drives the row's aria-label — a11y). */
const STATUS_LABEL: Record<GitFileChange['status'], string> = {
  M: 'Modified',
  A: 'Added',
  D: 'Deleted',
  R: 'Renamed',
  C: 'Copied',
  T: 'Type changed',
  U: 'Conflict',
  '?': 'Untracked'
}

/** Which diff side a change opens with (conflicts diff their working copy). */
function diffSide(group: ScmGroup): GitDiffSide {
  if (group === 'staged') return 'staged'
  if (group === 'untracked') return 'untracked'
  return 'unstaged'
}

/** Split a repo-relative path into its file name and parent directory. */
function splitPath(rel: string): { name: string; dir: string } {
  const i = rel.lastIndexOf('/')
  return i < 0 ? { name: rel, dir: '' } : { name: rel.slice(i + 1), dir: rel.slice(0, i) }
}

interface PendingDiscard {
  paths: string[]
  untracked: boolean
  label: string
}

/**
 * VS Code-style Source Control sidebar panel: branch header + sync actions, a
 * commit box, and the working-tree changes grouped into Merge / Staged / Changes
 * / Untracked with per-file and per-group stage/unstage/discard. Clicking a row
 * opens the correct diff in the Monaco viewer. A pure view over the scm store +
 * the given `cwd`; App.tsx polls the status into the store.
 */
export function SourceControlPanel({ cwd }: { cwd: string | null }): React.ReactElement {
  const status = useScmStore((s) => s.status)
  const commitMsg = useScmStore((s) => s.commitMsg)
  const busy = useScmStore((s) => s.busy)
  const error = useScmStore((s) => s.error)
  const [pending, setPending] = useState<PendingDiscard | null>(null)

  const refresh = (): void => {
    void window.api
      .getGitStatus(cwd)
      .then((s) => useScmStore.getState().setStatus(s))
      .catch(() => {
        /* keep last value */
      })
  }

  /** Run a mutation, then refresh; surface git's stderr on failure. */
  const run = (op: () => Promise<void>): void => {
    if (!cwd) return
    const store = useScmStore.getState()
    store.setBusy(true)
    store.setError(null)
    void op()
      .then(() => refresh())
      .catch((e: unknown) => store.setError(e instanceof Error ? e.message : String(e)))
      .finally(() => useScmStore.getState().setBusy(false))
  }

  const openDiff = (change: GitFileChange): void => {
    const { name } = splitPath(change.rel)
    useViewerStore.getState().openGitDiff(change.path, name, diffSide(change.group))
  }

  if (!status) {
    return <div className="scm-panel__empty">Loading changes…</div>
  }

  if (!status.isRepo) {
    return (
      <div className="scm-panel" data-testid="scm-panel">
        <div className="scm-empty" data-testid="scm-not-repo">
          <p>Not a git repository.</p>
          <p className="usage-note usage-note--sub">
            Open a project that is a git repo to see its source control.
          </p>
        </div>
      </div>
    )
  }

  const groups: ScmGroup[] = ['conflict', 'staged', 'unstaged', 'untracked']
  const byGroup = (g: ScmGroup): GitFileChange[] => status.changes.filter((c) => c.group === g)
  const stagedCount = byGroup('staged').length
  const canCommit = !busy && stagedCount > 0 && commitMsg.trim().length > 0
  const total = changeCount(status.changes)

  const confirmDiscard = (paths: string[], untracked: boolean, label: string): void => {
    setPending({ paths, untracked, label })
  }

  const groupActions = (g: ScmGroup, changes: GitFileChange[]): React.ReactNode => {
    const paths = changes.map((c) => c.path)
    if (g === 'staged') {
      return (
        <button
          type="button"
          className="scm-icon-btn"
          title="Unstage all"
          aria-label={`Unstage all ${GROUP_TITLE[g]}`}
          onClick={() => run(() => window.api.unstageFiles(cwd!, paths))}
        >
          −
        </button>
      )
    }
    return (
      <>
        <button
          type="button"
          className="scm-icon-btn"
          title="Discard all"
          aria-label={`Discard all ${GROUP_TITLE[g]}`}
          onClick={() => confirmDiscard(paths, g === 'untracked', `all ${GROUP_TITLE[g]}`)}
        >
          ↺
        </button>
        <button
          type="button"
          className="scm-icon-btn"
          title="Stage all"
          aria-label={`Stage all ${GROUP_TITLE[g]}`}
          onClick={() => run(() => window.api.stageFiles(cwd!, paths))}
        >
          +
        </button>
      </>
    )
  }

  const rowActions = (change: GitFileChange): React.ReactNode => {
    if (change.group === 'staged') {
      return (
        <button
          type="button"
          className="scm-icon-btn"
          title="Unstage"
          aria-label={`Unstage ${change.rel}`}
          onClick={() => run(() => window.api.unstageFiles(cwd!, [change.path]))}
        >
          −
        </button>
      )
    }
    return (
      <>
        <button
          type="button"
          className="scm-icon-btn"
          title="Discard changes"
          aria-label={`Discard changes to ${change.rel}`}
          onClick={() => confirmDiscard([change.path], change.group === 'untracked', change.rel)}
        >
          ↺
        </button>
        <button
          type="button"
          className="scm-icon-btn"
          title="Stage"
          aria-label={`Stage ${change.rel}`}
          onClick={() => run(() => window.api.stageFiles(cwd!, [change.path]))}
        >
          +
        </button>
      </>
    )
  }

  return (
    <div className="scm-panel" data-testid="scm-panel">
      <div className="scm-header" data-testid="scm-header">
        <div className="scm-branch" title={status.upstream ?? undefined}>
          <span className="scm-branch__glyph" aria-hidden="true">
            ⑂
          </span>
          <span className="scm-branch__name">{status.branch ?? '(no branch)'}</span>
          {(status.ahead > 0 || status.behind > 0) && (
            <span className="scm-branch__ab" data-testid="scm-ahead-behind">
              {status.behind > 0 && <span title={`${status.behind} behind`}>↓{status.behind}</span>}
              {status.ahead > 0 && <span title={`${status.ahead} ahead`}>↑{status.ahead}</span>}
            </span>
          )}
        </div>
        <div className="scm-header__actions">
          <button
            type="button"
            className="scm-icon-btn"
            title="Pull"
            aria-label="Pull"
            disabled={busy}
            onClick={() => run(() => window.api.gitPull(cwd!))}
          >
            ↓
          </button>
          <button
            type="button"
            className="scm-icon-btn"
            title="Push"
            aria-label="Push"
            disabled={busy}
            onClick={() => run(() => window.api.gitPush(cwd!))}
          >
            ↑
          </button>
          <button
            type="button"
            className="scm-icon-btn"
            title="Refresh"
            aria-label="Refresh"
            data-testid="scm-refresh"
            onClick={refresh}
          >
            ⟳
          </button>
        </div>
      </div>

      <div className="scm-commit">
        <textarea
          className="scm-commit__msg"
          placeholder={`Message (commit on ${status.branch ?? 'HEAD'})`}
          aria-label="Commit message"
          data-testid="scm-commit-msg"
          rows={2}
          value={commitMsg}
          onChange={(e) => useScmStore.getState().setCommitMsg(e.target.value)}
        />
        <div className="scm-commit__actions">
          <button
            type="button"
            className="scm-commit__btn"
            data-testid="scm-commit"
            disabled={!canCommit}
            title={stagedCount === 0 ? 'Stage changes to commit' : 'Commit staged changes'}
            onClick={() =>
              run(async () => {
                await window.api.gitCommit(cwd!, commitMsg)
                useScmStore.getState().setCommitMsg('')
              })
            }
          >
            Commit
          </button>
          <button
            type="button"
            className="scm-commit__btn scm-commit__btn--secondary"
            data-testid="scm-commit-push"
            disabled={!canCommit}
            title="Commit staged changes and push"
            onClick={() =>
              run(async () => {
                await window.api.gitCommit(cwd!, commitMsg)
                useScmStore.getState().setCommitMsg('')
                await window.api.gitPush(cwd!)
              })
            }
          >
            Commit & Push
          </button>
        </div>
      </div>

      {error && (
        <div className="scm-note scm-note--error" data-testid="scm-error" role="alert">
          {error}
        </div>
      )}

      {total === 0 ? (
        <div className="scm-note" data-testid="scm-clean">
          No changes — the working tree is clean.
        </div>
      ) : (
        <div className="scm-groups" data-testid="scm-groups">
          {groups.map((g) => {
            const changes = byGroup(g)
            if (changes.length === 0) return null
            return (
              <section className="scm-group" key={g} data-testid={`scm-group-${g}`}>
                <header className="scm-group__head">
                  <span className="scm-group__title">{GROUP_TITLE[g]}</span>
                  <span className="scm-group__count">{changes.length}</span>
                  <span className="scm-group__actions">{groupActions(g, changes)}</span>
                </header>
                <ul className="scm-list">
                  {changes.map((change) => {
                    const { name, dir } = splitPath(change.rel)
                    return (
                      <li
                        key={`${g}:${change.rel}`}
                        className="scm-row"
                        data-testid={`scm-row-${g}-${change.rel}`}
                      >
                        <button
                          type="button"
                          className="scm-row__open"
                          title={`${STATUS_LABEL[change.status]} — ${change.rel}`}
                          aria-label={`Open diff for ${change.rel}`}
                          onClick={() => openDiff(change)}
                        >
                          <span
                            className={`scm-status scm-status--${change.status === '?' ? 'untracked' : change.status}`}
                            aria-label={STATUS_LABEL[change.status]}
                          >
                            {change.status}
                          </span>
                          <span className="scm-row__name">{name}</span>
                          {dir && <span className="scm-row__dir">{dir}</span>}
                        </button>
                        <span className="scm-row__actions">{rowActions(change)}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        title="Discard changes?"
        message={
          pending
            ? `Discard changes to ${pending.label}? This cannot be undone.`
            : ''
        }
        confirmLabel="Discard"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const p = pending
          setPending(null)
          if (p) run(() => window.api.discardChanges(cwd!, p.paths, p.untracked))
        }}
      />
    </div>
  )
}
