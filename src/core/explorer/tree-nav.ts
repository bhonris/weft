/**
 * Pure WAI-ARIA tree keyboard navigation. Operates on a FLATTENED list of the
 * currently-visible nodes (a collapsed dir contributes one node; an expanded dir
 * is followed by its descendants). DOM-free: the renderer maps the returned
 * intent to focus moves / expand / collapse / open. See the ARIA Authoring
 * Practices "tree view" pattern.
 */
export interface NavNode {
  /** 0-based nesting depth (root entries are depth 0). */
  depth: number
  isDir: boolean
  /** For directories: whether currently expanded. Ignored for files. */
  expanded: boolean
}

/**
 * Pure updater for the set of expanded directory paths. Returns the SAME set
 * reference when there is nothing to change (so React can skip a re-render),
 * otherwise a new Set. One helper for both expand (`expanded: true`) and
 * collapse (`expanded: false`) — the Explorer folds its old expandPath/
 * collapsePath pair onto this.
 */
export function nextExpanded(
  current: ReadonlySet<string>,
  path: string,
  expanded: boolean
): ReadonlySet<string> {
  if (expanded === current.has(path)) return current // already in the target state
  const next = new Set(current)
  if (expanded) next.add(path)
  else next.delete(path)
  return next
}

export type NavIntent =
  | { type: 'move'; index: number }
  | { type: 'expand' }
  | { type: 'collapse' }
  | { type: 'activate' } // Enter/Space: open a file or toggle a directory
  | { type: 'none' }

/** Nearest preceding node with a shallower depth (the parent), or -1. */
function parentIndex(nodes: readonly NavNode[], index: number): number {
  const depth = nodes[index]!.depth
  for (let i = index - 1; i >= 0; i--) {
    if (nodes[i]!.depth < depth) return i
  }
  return -1
}

export function treeNav(nodes: readonly NavNode[], index: number, key: string): NavIntent {
  if (nodes.length === 0) return { type: 'none' }
  const cur = nodes[index]
  if (!cur) return { type: 'none' }

  switch (key) {
    case 'ArrowDown':
      return { type: 'move', index: Math.min(index + 1, nodes.length - 1) }
    case 'ArrowUp':
      return { type: 'move', index: Math.max(index - 1, 0) }
    case 'Home':
      return { type: 'move', index: 0 }
    case 'End':
      return { type: 'move', index: nodes.length - 1 }
    case 'ArrowRight':
      if (cur.isDir && !cur.expanded) return { type: 'expand' }
      if (cur.isDir && cur.expanded) return { type: 'move', index: Math.min(index + 1, nodes.length - 1) }
      return { type: 'none' }
    case 'ArrowLeft': {
      if (cur.isDir && cur.expanded) return { type: 'collapse' }
      const p = parentIndex(nodes, index)
      return p === -1 ? { type: 'none' } : { type: 'move', index: p }
    }
    case 'Enter':
    case ' ':
    case 'Spacebar': // legacy key name
      return { type: 'activate' }
    default:
      return { type: 'none' }
  }
}
