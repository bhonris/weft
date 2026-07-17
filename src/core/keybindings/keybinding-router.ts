/**
 * Classifies a keyboard event as a reserved Weft chord or terminal passthrough.
 * Everything not explicitly reserved MUST reach the PTY untouched (Ctrl+C,
 * arrows, Ctrl+R history search, …) — spec §7.4. Pure and DOM-free.
 */
export interface KeyLike {
  key: string
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
}

export type KeyAction =
  | { kind: 'new-tab' }
  | { kind: 'close-tab' }
  | { kind: 'next-tab' }
  | { kind: 'prev-tab' }
  | { kind: 'jump-tab'; index: number }
  | { kind: 'passthrough' }

export function routeKey(e: KeyLike): KeyAction {
  // Only plain-Ctrl chords are reserved; Alt/Meta combos always pass through.
  if (!e.ctrlKey || e.altKey || e.metaKey) return { kind: 'passthrough' }

  if (e.key === 'Tab') {
    return e.shiftKey ? { kind: 'prev-tab' } : { kind: 'next-tab' }
  }
  if (e.shiftKey) return { kind: 'passthrough' }

  const key = e.key.toLowerCase()
  if (key === 't') return { kind: 'new-tab' }
  if (key === 'w') return { kind: 'close-tab' }
  if (key >= '1' && key <= '9' && key.length === 1) {
    return { kind: 'jump-tab', index: Number(key) - 1 }
  }
  return { kind: 'passthrough' }
}
