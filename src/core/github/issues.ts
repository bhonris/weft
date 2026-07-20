import type { GithubIssue, GithubLabel } from '@shared/ipc/api-contract'

/**
 * Pure helpers for the GitHub issues list: parsing the REST response and the
 * client-side filtering the panel applies. No I/O — the service does the fetch,
 * this turns the raw body into typed data and filters it.
 */

/** A predicate set for {@link filterIssues}. */
export interface IssueFilter {
  /** Which states to keep. 'all' keeps both. */
  state: 'open' | 'closed' | 'all'
  /** Label name that must be present, or '' for no label filter. */
  label: string
  /** Case-insensitive substring matched against title / #number / author. */
  query: string
}

/**
 * Parse GitHub's `GET /repos/{owner}/{repo}/issues` body into {@link GithubIssue}s.
 * Pull requests are returned by that endpoint too (they carry a `pull_request`
 * field) — those are dropped. Anything malformed is skipped, never thrown.
 */
export function parseIssues(body: unknown): GithubIssue[] {
  if (!Array.isArray(body)) return []
  const out: GithubIssue[] = []
  for (const raw of body) {
    if (typeof raw !== 'object' || raw === null) continue
    const r = raw as Record<string, unknown>
    if ('pull_request' in r) continue // it's a PR, not an issue
    const number = r['number']
    const title = r['title']
    if (typeof number !== 'number' || typeof title !== 'string') continue
    out.push({
      number,
      title,
      state: r['state'] === 'closed' ? 'closed' : 'open',
      author: readAuthor(r['user']),
      labels: readLabels(r['labels']),
      comments: typeof r['comments'] === 'number' ? r['comments'] : 0,
      htmlUrl: typeof r['html_url'] === 'string' ? r['html_url'] : '',
      updatedAt: typeof r['updated_at'] === 'string' ? r['updated_at'] : ''
    })
  }
  return out
}

function readAuthor(user: unknown): string {
  if (typeof user !== 'object' || user === null) return ''
  const login = (user as Record<string, unknown>)['login']
  return typeof login === 'string' ? login : ''
}

function readLabels(labels: unknown): GithubLabel[] {
  if (!Array.isArray(labels)) return []
  const out: GithubLabel[] = []
  for (const l of labels) {
    if (typeof l !== 'object' || l === null) continue
    const name = (l as Record<string, unknown>)['name']
    if (typeof name !== 'string') continue
    const color = (l as Record<string, unknown>)['color']
    out.push({ name, color: typeof color === 'string' ? color : '888888' })
  }
  return out
}

/** Apply the panel's state/label/text filter (predicates AND together). */
export function filterIssues(issues: readonly GithubIssue[], filter: IssueFilter): GithubIssue[] {
  const q = filter.query.trim().toLowerCase()
  return issues.filter((issue) => {
    if (filter.state !== 'all' && issue.state !== filter.state) return false
    if (filter.label && !issue.labels.some((l) => l.name === filter.label)) return false
    if (q) {
      const hay = `${issue.title} #${issue.number} ${issue.author}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/** The sorted, de-duplicated set of label names present across the issues. */
export function collectLabels(issues: readonly GithubIssue[]): string[] {
  const names = new Set<string>()
  for (const issue of issues) for (const l of issue.labels) names.add(l.name)
  return [...names].sort((a, b) => a.localeCompare(b))
}
