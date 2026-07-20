import { useState } from 'react'
import { useIssuesStore } from '../store/issues-store'
import { filterIssues, collectLabels } from '@core/github/issues'
import type { GithubAuthSource, GithubIssue, GithubLabel } from '@shared/ipc/api-contract'

/** Human label for the active auth source, shown in the banner. */
const SOURCE_LABEL: Record<GithubAuthSource, string> = {
  gh: 'Authenticated via gh CLI',
  env: 'Authenticated via GITHUB_TOKEN',
  oauth: 'Signed in to GitHub',
  none: 'Public access only (unauthenticated)'
}

/** Pick a readable foreground for a GitHub label's background colour. */
function labelText(hex: string): string {
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#fff'
  const n = parseInt(hex, 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  // Rec. 601 luma — dark text on light labels, light text on dark ones.
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111' : '#fff'
}

function LabelChip({ label }: { label: GithubLabel }): React.ReactElement {
  return (
    <span
      className="issue-label"
      style={{ backgroundColor: `#${label.color || '888888'}`, color: labelText(label.color) }}
    >
      {label.name}
    </span>
  )
}

/** Compact "3h ago" / "2d ago" from an ISO time (empty when unknown). */
function relativeTime(iso: string, now: number): string {
  if (!iso) return ''
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return ''
  const mins = Math.max(0, Math.round((now - at) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function IssueRow({ issue, now }: { issue: GithubIssue; now: number }): React.ReactElement {
  const open = (): void => {
    if (issue.htmlUrl) void window.api.openExternal(issue.htmlUrl)
  }
  return (
    <li>
      <button
        type="button"
        className="issue-row"
        data-testid={`issue-${issue.number}`}
        onClick={open}
        title={`Open #${issue.number} in browser`}
      >
        <div className="issue-row__top">
          <span className="issue-row__title">{issue.title}</span>
          <span className="issue-row__num">#{issue.number}</span>
        </div>
        {issue.labels.length > 0 && (
          <div className="issue-row__labels">
            {issue.labels.map((l) => (
              <LabelChip key={l.name} label={l} />
            ))}
          </div>
        )}
        <div className="issue-row__meta">
          <span className={`issue-row__state issue-row__state--${issue.state}`}>{issue.state}</span>
          {issue.author && <span className="issue-row__author">{issue.author}</span>}
          <span className="issue-row__comments">💬 {issue.comments}</span>
          {issue.updatedAt && (
            <span className="issue-row__ago">{relativeTime(issue.updatedAt, now)}</span>
          )}
        </div>
      </button>
    </li>
  )
}

/**
 * The GitHub Issues sidebar panel. Lists the current repo's issues with
 * state/label/text filtering and click-to-open-in-browser, plus an auth banner
 * and device-flow sign-in. Data is polled into the issues store by App.tsx; this
 * view also triggers its own refresh after sign-in/out. Pure view over the store
 * + the given `cwd`.
 */
export function IssuesPanel({ cwd }: { cwd: string | null }): React.ReactElement {
  const panel = useIssuesStore((s) => s.panel)
  const signIn = useIssuesStore((s) => s.signIn)
  const authError = useIssuesStore((s) => s.authError)
  const [state, setState] = useState<'open' | 'closed' | 'all'>('open')
  const [label, setLabel] = useState('')
  const [query, setQuery] = useState('')
  const now = Date.now()

  const refresh = (): void => {
    void window.api
      .getIssues(cwd)
      .then((p) => useIssuesStore.getState().setPanel(p))
      .catch(() => {
        /* keep last value */
      })
  }

  const startSignIn = (): void => {
    useIssuesStore.getState().setAuthError(null)
    void window.api.githubSignIn().then((res) => {
      if ('error' in res) {
        useIssuesStore.getState().setAuthError(res.error)
        return
      }
      useIssuesStore
        .getState()
        .setSignIn({ userCode: res.userCode, verificationUri: res.verificationUri })
    })
  }

  const signOut = (): void => {
    void window.api.githubSignOut().then(() => {
      useIssuesStore.getState().setSignIn(null)
      useIssuesStore.getState().setAuthError(null)
      refresh()
    })
  }

  if (!panel) {
    return <div className="issues-panel__empty">Loading issues…</div>
  }

  if (!panel.repo) {
    return (
      <div className="issues-panel" data-testid="issues-panel">
        <div className="issues-empty" data-testid="issues-not-repo">
          <p>Not a GitHub repository.</p>
          <p className="usage-note usage-note--sub">
            Open a project whose <code>origin</code> remote points at GitHub to see its issues.
          </p>
        </div>
      </div>
    )
  }

  const labels = collectLabels(panel.issues)
  const visible = filterIssues(panel.issues, { state, label, query })

  return (
    <div className="issues-panel" data-testid="issues-panel">
      <div className="issues-repo" data-testid="issues-repo">
        <span className="issues-repo__slug">
          {panel.repo.owner}/{panel.repo.repo}
        </span>
      </div>

      <div className="issues-auth" data-testid="issues-auth">
        <span className="issues-auth__source">{SOURCE_LABEL[panel.authSource]}</span>
        {panel.authSource === 'oauth' ? (
          <button type="button" className="issues-auth__btn" onClick={signOut}>
            Sign out
          </button>
        ) : panel.authSource === 'none' ? (
          <button
            type="button"
            className="issues-auth__btn"
            data-testid="issues-sign-in"
            onClick={startSignIn}
          >
            Sign in with GitHub
          </button>
        ) : null}
      </div>

      {signIn && (
        <div className="issues-signin" data-testid="issues-signin">
          <p>
            Enter code <strong className="issues-signin__code">{signIn.userCode}</strong> at{' '}
            <button
              type="button"
              className="issues-link"
              onClick={() => void window.api.openExternal(signIn.verificationUri)}
            >
              github.com/login/device
            </button>
          </p>
          <p className="usage-note usage-note--sub">Waiting for approval…</p>
        </div>
      )}

      {authError && (
        <div className="issues-note issues-note--error" data-testid="issues-auth-error">
          {authError}
        </div>
      )}

      <div className="issues-filters" role="group" aria-label="Filter issues">
        <div className="issues-state" role="tablist" aria-label="Issue state">
          {(['open', 'closed', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={state === s}
              className={`issues-state__btn${state === s ? ' issues-state__btn--active' : ''}`}
              data-testid={`issues-state-${s}`}
              onClick={() => setState(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          className="issues-label-select"
          aria-label="Filter by label"
          data-testid="issues-label-select"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        >
          <option value="">All labels</option>
          {labels.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <input
          type="search"
          className="issues-search"
          placeholder="Search issues…"
          aria-label="Search issues"
          data-testid="issues-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {panel.error && (
        <div className="issues-note issues-note--error" data-testid="issues-error">
          {panel.error}
        </div>
      )}
      {panel.stale && !panel.error && (
        <div className="issues-note" data-testid="issues-stale">
          Showing last-known issues — live data is temporarily unavailable.
        </div>
      )}

      {panel.issues.length === 0 ? (
        <div className="issues-note" data-testid="issues-none">
          No issues found.
        </div>
      ) : visible.length === 0 ? (
        <div className="issues-note" data-testid="issues-no-match">
          No issues match the current filter.
        </div>
      ) : (
        <ul className="issues-list" data-testid="issues-list">
          {visible.map((issue) => (
            <IssueRow key={issue.number} issue={issue} now={now} />
          ))}
        </ul>
      )}
    </div>
  )
}
