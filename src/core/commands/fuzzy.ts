/**
 * Pure fuzzy subsequence matcher + ranker for the command palette. DOM-free,
 * synchronous, sized for a few dozen commands. Case-insensitive.
 *
 * Scoring rewards: matches at the start of the string or right after a word
 * separator (space, `-`, `_`, `/`, `.`, `:`), and runs of consecutive matched
 * characters; it penalizes leading gaps. A non-subsequence match returns null.
 */
const SEPARATORS = new Set([' ', '-', '_', '/', '.', ':'])

export interface FuzzyHit {
  /** Higher is better. */
  score: number
  /** Indices in `text` that matched, in order. */
  positions: number[]
}

export function fuzzyMatch(query: string, text: string): FuzzyHit | null {
  if (query.length === 0) return { score: 0, positions: [] }

  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const positions: number[] = []

  let score = 0
  let ti = 0
  let prevMatch = -2 // so the first match is never "consecutive"

  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    let found = -1
    for (; ti < t.length; ti++) {
      if (t[ti] === ch) {
        found = ti
        break
      }
    }
    if (found === -1) return null

    let charScore = 1
    if (found === prevMatch + 1) charScore += 4 // consecutive run
    if (found === 0 || SEPARATORS.has(t[found - 1] as string)) charScore += 3 // word boundary
    if (qi === 0) charScore -= Math.min(found, 3) // penalize a late first match

    score += charScore
    positions.push(found)
    prevMatch = found
    ti = found + 1
  }

  // Shorter targets that the query fills more of rank slightly higher.
  score += Math.round((q.length / t.length) * 2)
  return { score, positions }
}

export interface RankedItem<T> {
  item: T
  hit: FuzzyHit
}

/**
 * Filter `items` to those matching `query` and sort best-first. An empty query
 * returns every item in original order (score 0). Ties preserve original order
 * (stable).
 */
export function fuzzyFilter<T>(
  query: string,
  items: readonly T[],
  toText: (item: T) => string
): RankedItem<T>[] {
  const ranked: Array<RankedItem<T> & { index: number }> = []
  items.forEach((item, index) => {
    const hit = fuzzyMatch(query, toText(item))
    if (hit) ranked.push({ item, hit, index })
  })
  ranked.sort((a, b) => (b.hit.score - a.hit.score) || (a.index - b.index))
  return ranked.map(({ item, hit }) => ({ item, hit }))
}
