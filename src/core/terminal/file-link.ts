/**
 * Pure detection of file-path tokens in a single terminal-buffer row, so the
 * terminal can offer VS Code-style Ctrl+Click "open this file". DOM-free and
 * fully unit-tested; the renderer adapter (TerminalPane) turns each match into
 * an xterm link and decides truth (existence, in-root) separately.
 *
 * Deliberately liberal about SHAPE — it accepts relative and absolute paths,
 * Windows and POSIX separators, and bare `name.ext` — because whether a token
 * is a real, openable file is decided downstream by the main-process existence
 * check. The one filter here keeps the candidate set small: a token must look
 * path-like (contain a separator, or be a dotted filename).
 */

/** One path-like token found in a row. Offsets are 0-based, half-open [start,end). */
export interface FileLinkMatch {
  /** Char offset of the first char of the whole token (path + any :line:col). */
  start: number
  /** Char offset just past the last char of the whole token. */
  end: number
  /** The path portion only (no `:line:col` suffix, no wrapping/trailing punctuation). */
  path: string
  /** 1-based line from a `:line` / `:line:col` suffix, when present. */
  line?: number
  /** 1-based column from a `:line:col` suffix, when present. */
  column?: number
}

// A run of "path characters": letters, digits, and the punctuation that legally
// appears in paths. Notably includes `:` (Windows drive) and `\` and `/`. Excludes
// whitespace, quotes, parens/brackets, and comma/semicolon so surrounding prose
// doesn't get swallowed. We post-process the `:line:col` suffix out of the run.
const PATH_RUN = /[A-Za-z0-9_./\\:+@%~$-]+/g

// Trailing punctuation that is almost always prose, not part of the path
// (e.g. end-of-sentence `.`, a closing quote, a colon before a description).
// Leading wrappers (`("'[{`) need no trimming — PATH_RUN already excludes them,
// so a run never starts with one (an opening `(` before `src/x.ts` is skipped).
const TRAILING = /[.,:;'")\]}>]+$/

/** A `:line` or `:line:col` suffix at the very end of a token. */
const LINE_COL = /:(\d+)(?::(\d+))?$/

/**
 * Does this token look like a path worth checking? Requires either a path
 * separator, or a dotted filename (`something.ext`). This rejects bare words
 * ("hello") and plain numbers while keeping `README.md`, `src/x`, `./a`.
 */
function looksPathLike(token: string): boolean {
  if (token.includes('/') || token.includes('\\')) return true
  // A dotted, non-trivial filename: at least one char, a dot, then an extension.
  return /[A-Za-z0-9_-]+\.[A-Za-z0-9]+/.test(token)
}

/**
 * A run may end in a `:line[:col]` suffix, but a leading Windows drive letter
 * (`C:`) also uses a colon. Only treat a trailing `:number[:number]` as a
 * position suffix; never strip the drive colon. Returns the path + parsed pos.
 */
function splitLineCol(token: string): { path: string; line?: number; column?: number } {
  const m = LINE_COL.exec(token)
  if (!m) return { path: token }
  const path = token.slice(0, m.index)
  // Guard: a bare `C:` (drive) would leave an empty/no-separator path — reject
  // the split so the colon stays part of the token.
  if (path.length === 0) return { path: token }
  return { path, line: Number(m[1]), column: m[2] !== undefined ? Number(m[2]) : undefined }
}

/**
 * Find every path-like token in one terminal row. Never throws; returns matches
 * in left-to-right order with correct char offsets into `line`.
 */
export function parseFileLinks(line: string): FileLinkMatch[] {
  const out: FileLinkMatch[] = []
  PATH_RUN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PATH_RUN.exec(line)) !== null) {
    const raw = m[0]
    const start = m.index
    let end = m.index + raw.length

    // Trim trailing prose punctuation, adjusting the end offset to match.
    let token = raw
    const trail = TRAILING.exec(token)
    if (trail) {
      token = token.slice(0, token.length - trail[0].length)
      end -= trail[0].length
    }
    if (token.length === 0) continue

    const { path, line: lineNo, column } = splitLineCol(token)
    if (!looksPathLike(path)) continue

    out.push({
      start,
      end,
      path,
      ...(lineNo !== undefined ? { line: lineNo } : {}),
      ...(column !== undefined ? { column } : {})
    })
  }
  return out
}
