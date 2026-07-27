import type { GitFileChange, GitFileStatus, ScmGroup } from '@shared/ipc/api-contract'

/**
 * A single change as parsed from porcelain output — repo-relative only. The main
 * adapter (`GitService`) resolves absolute `path`/`origPath` from the repo root
 * and produces the shared {@link GitFileChange}.
 */
export interface ParsedChange {
  /** Repo-relative path (forward slashes, as git emits). */
  rel: string
  /** Rename/copy source (repo-relative), when this is an `R`/`C` entry. */
  origRel?: string
  group: ScmGroup
  status: GitFileStatus
}

/** Everything derived from `git status --porcelain=v2 -z --branch`. */
export interface ParsedStatus {
  /** Branch name, `(detached)` at a detached HEAD, or null when unknown. */
  branch: string | null
  /** Upstream ref (e.g. `origin/main`), or null when none is configured. */
  upstream: string | null
  ahead: number
  behind: number
  changes: ParsedChange[]
}

/** Map a porcelain-v2 XY status code letter to our display status letter. */
function statusLetter(code: string): GitFileStatus {
  switch (code) {
    case 'M':
    case 'A':
    case 'D':
    case 'R':
    case 'C':
    case 'T':
      return code
    default:
      // Unknown/unmodified '.' should never reach here for a real change.
      return 'M'
  }
}

/**
 * Parse `git status --porcelain=v2 -z --branch` output into a {@link ParsedStatus}.
 *
 * Pure string→data — the single home for every git-status classification rule.
 * Records are NUL-separated (`-z`); rename/copy (`2`) entries are immediately
 * followed by a separate NUL-terminated token holding the original path. A file
 * changed in BOTH the index and the worktree (e.g. XY = `MM`) yields TWO changes
 * — one `staged`, one `unstaged` — exactly as VS Code shows it in both groups.
 */
export function parseStatus(stdout: string): ParsedStatus {
  const result: ParsedStatus = {
    branch: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    changes: []
  }

  // Split on NUL; drop the trailing empty token. Newlines only ever terminate
  // header lines (git never mixes -z record seps into the `# ` headers), so a
  // header token can itself contain '\n'-joined lines when git buffers them —
  // guard by splitting headers on '\n' too.
  const tokens = stdout.split('\0')
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (!token) continue

    if (token.startsWith('# ')) {
      for (const line of token.split('\n')) {
        parseHeader(line, result)
      }
      continue
    }

    const kind = token[0]
    if (kind === '1') {
      pushOrdinary(token, result.changes)
    } else if (kind === '2') {
      // The very next token is this rename/copy's original path.
      const origRel = tokens[i + 1] ?? ''
      i += 1
      pushRename(token, origRel, result.changes)
    } else if (kind === 'u') {
      pushUnmerged(token, result.changes)
    } else if (kind === '?') {
      result.changes.push({ rel: token.slice(2), group: 'untracked', status: '?' })
    }
    // '!' (ignored) and anything else are skipped.
  }

  return result
}

/** Parse one `# branch.*` header line into the accumulating result. */
function parseHeader(line: string, out: ParsedStatus): void {
  if (line.startsWith('# branch.head ')) {
    const head = line.slice('# branch.head '.length).trim()
    out.branch = head === '(detached)' ? '(detached)' : head
  } else if (line.startsWith('# branch.upstream ')) {
    const up = line.slice('# branch.upstream '.length).trim()
    out.upstream = up.length > 0 ? up : null
  } else if (line.startsWith('# branch.ab ')) {
    // Format: `# branch.ab +<ahead> -<behind>`.
    const m = /\+(-?\d+)\s+-(-?\d+)/.exec(line)
    if (m) {
      out.ahead = Math.abs(parseInt(m[1] ?? '0', 10)) || 0
      out.behind = Math.abs(parseInt(m[2] ?? '0', 10)) || 0
    }
  }
}

/**
 * Split off the path field of a porcelain-v2 changed entry: the path is
 * everything after the first `fieldCount` space-separated fields. Paths can
 * contain spaces, so we cannot naively `split(' ')` the whole token.
 */
function pathAfter(token: string, fieldCount: number): string {
  let idx = 0
  for (let f = 0; f < fieldCount; f++) {
    const next = token.indexOf(' ', idx)
    if (next < 0) return ''
    idx = next + 1
  }
  return token.slice(idx)
}

/** `1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>` — an ordinary tracked change. */
function pushOrdinary(token: string, changes: ParsedChange[]): void {
  const xy = token.slice(2, 4)
  const rel = pathAfter(token, 8)
  addXy(xy, rel, undefined, changes)
}

/** `2 <XY> ... <Xscore> <path>` (+ separate origRel) — a rename/copy. */
function pushRename(token: string, origRel: string, changes: ParsedChange[]): void {
  const xy = token.slice(2, 4)
  const rel = pathAfter(token, 9)
  addXy(xy, rel, origRel, changes)
}

/** `u <xy> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>` — an unmerged entry. */
function pushUnmerged(token: string, changes: ParsedChange[]): void {
  const rel = pathAfter(token, 10)
  changes.push({ rel, group: 'conflict', status: 'U' })
}

/**
 * Emit up to two changes from an XY code: a `staged` one when the index status
 * (X) is not `.`, and an `unstaged` one when the worktree status (Y) is not `.`.
 */
function addXy(
  xy: string,
  rel: string,
  origRel: string | undefined,
  changes: ParsedChange[]
): void {
  const x = xy[0] ?? '.'
  const y = xy[1] ?? '.'
  if (x !== '.') {
    changes.push({
      rel,
      ...(origRel ? { origRel } : {}),
      group: 'staged',
      status: statusLetter(x)
    })
  }
  if (y !== '.') {
    changes.push({
      rel,
      ...(origRel ? { origRel } : {}),
      group: 'unstaged',
      status: statusLetter(y)
    })
  }
}

/** Count of DISTINCT changed files (the activity-bar badge number). */
export function changeCount(changes: Pick<GitFileChange, 'rel'>[]): number {
  return new Set(changes.map((c) => c.rel)).size
}
