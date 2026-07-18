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
 *
 * The reserved chords themselves are now data — see `keymap.ts`. `routeKey`
 * resolves an event against a {@link Keymap} (the built-in `DEFAULT_KEYMAP` by
 * default), so bindings can be overridden without touching this classifier.
 */
import { DEFAULT_KEYMAP, chordOf, type Keymap } from './keymap'

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
  | { kind: 'terminal-search' }
  | { kind: 'passthrough' }

export function routeKey(e: KeyLike, keymap: Keymap = DEFAULT_KEYMAP): KeyAction {
  // Alt/Meta combos and non-Ctrl keys always reach the PTY.
  if (!e.ctrlKey || e.altKey || e.metaKey) return { kind: 'passthrough' }

  // Ctrl+1..9 — positional tab jump. A built-in: parameterized by digit, with
  // no registry command, and deliberately NOT remappable.
  const key = e.key.toLowerCase()
  if (!e.shiftKey && key.length === 1 && key >= '1' && key <= '9') {
    return { kind: 'jump-tab', index: Number(key) - 1 }
  }

  // Everything else is data-driven: canonicalize the chord and look it up. An
  // unbindable event (chordOf === null) or an unbound chord passes through.
  const chord = chordOf(e)
  if (chord === null) return { kind: 'passthrough' }
  return keymap[chord] ?? { kind: 'passthrough' }
}
