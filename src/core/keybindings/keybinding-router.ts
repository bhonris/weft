/**
 * Classifies a keyboard event as a reserved Weft chord or terminal passthrough.
 * Everything not explicitly reserved MUST reach the PTY untouched (Ctrl+C,
 * arrows, Ctrl+R history search, Ctrl+S flow-control, function keys, …) —
 * spec §7.4 and the Expansion 6 passthrough regression test. Pure and DOM-free.
 *
 * This is the SINGLE source of truth for global app chords: both the App-level
 * window keydown listener and xterm's `attachCustomKeyEventHandler` consult it,
 * so they can never disagree. Region-local keys (explorer arrows, F2-rename on a
 * focused tab, Ctrl+S while the viewer is focused) are intentionally NOT global
 * chords — they are handled by their own components' key handlers so they only
 * act in-context and otherwise pass through to the terminal.
 */
export interface KeyLike {
  key: string
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
}

/** Regions that a global chord can move DOM focus to directly. */
export type FocusRegion = 'terminal' | 'explorer'

export type KeyAction =
  | { kind: 'new-tab' }
  | { kind: 'close-tab' }
  | { kind: 'next-tab' }
  | { kind: 'prev-tab' }
  | { kind: 'jump-tab'; index: number }
  | { kind: 'command-palette' }
  | { kind: 'help-overlay' }
  | { kind: 'focus-region'; region: FocusRegion }
  | { kind: 'focus-cycle'; dir: 1 | -1 }
  | { kind: 'move-tab'; dir: 1 | -1 }
  | { kind: 'passthrough' }

export function routeKey(e: KeyLike): KeyAction {
  // Only plain-Ctrl chords are reserved; Alt/Meta combos always pass through.
  if (!e.ctrlKey || e.altKey || e.metaKey) return { kind: 'passthrough' }

  // Ctrl+Tab / Ctrl+Shift+Tab — cycle tabs.
  if (e.key === 'Tab') {
    return e.shiftKey ? { kind: 'prev-tab' } : { kind: 'next-tab' }
  }

  // Ctrl+F6 / Ctrl+Shift+F6 — cycle focus region forward / back. (Ctrl+F-key is
  // not terminal-bound; plain F6 is left for TUIs.)
  if (e.key === 'F6') return { kind: 'focus-cycle', dir: e.shiftKey ? -1 : 1 }

  // Ctrl+Shift+PageUp / PageDown — move the active tab left / right. (Plain and
  // Ctrl PageUp/PageDown are left for terminal scrollback.)
  if (e.shiftKey && e.key === 'PageUp') return { kind: 'move-tab', dir: -1 }
  if (e.shiftKey && e.key === 'PageDown') return { kind: 'move-tab', dir: 1 }

  // Ctrl+` — focus the terminal (VS Code convention; not terminal-bound).
  if (e.key === '`') return { kind: 'focus-region', region: 'terminal' }

  if (e.shiftKey) {
    // Ctrl+Shift+<key> chords. Anything not claimed here passes through — in
    // particular Ctrl+Shift+F stays passthrough so the in-terminal search
    // (handled by TerminalPane) keeps working until it is folded in here.
    const sk = e.key.toLowerCase()
    if (sk === 'p') return { kind: 'command-palette' }
    if (sk === 'e') return { kind: 'focus-region', region: 'explorer' }
    // Shift+/ produces '?' on US layouts; accept both for the help overlay.
    if (e.key === '?' || e.key === '/') return { kind: 'help-overlay' }
    return { kind: 'passthrough' }
  }

  // Plain Ctrl+<key> chords.
  const key = e.key.toLowerCase()
  if (key === 't') return { kind: 'new-tab' }
  if (key === 'w') return { kind: 'close-tab' }
  if (key >= '1' && key <= '9' && key.length === 1) {
    return { kind: 'jump-tab', index: Number(key) - 1 }
  }
  return { kind: 'passthrough' }
}
