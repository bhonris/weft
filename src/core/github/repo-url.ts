/**
 * Parse a git `origin` remote URL into a GitHub `{ owner, repo }` slug.
 *
 * Pure and side-effect free. Handles the three shapes `git remote get-url origin`
 * emits — HTTPS, scp-like SSH, and `ssh://` — and returns null for anything that
 * isn't a github.com repo (other hosts, malformed input, empty string).
 */
export interface RepoSlug {
  owner: string
  repo: string
}

/** Extract `{ owner, repo }` from a GitHub remote URL, or null. */
export function parseRepoSlug(remoteUrl: string): RepoSlug | null {
  const url = remoteUrl.trim()
  if (url.length === 0) return null

  // scp-like SSH: git@github.com:owner/repo(.git)
  const scp = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(url)
  if (scp) return slug(scp[1], scp[2])

  // https://github.com/owner/repo(.git) or ssh://git@github.com/owner/repo(.git)
  const proto = /^(?:https?|ssh|git):\/\/(?:[^@]+@)?github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(
    url
  )
  if (proto) return slug(proto[1], proto[2])

  return null
}

function slug(owner: string | undefined, repo: string | undefined): RepoSlug | null {
  if (!owner || !repo) return null
  // A trailing path segment must not sneak in (repo can't contain a slash).
  if (repo.includes('/')) return null
  return { owner, repo }
}
