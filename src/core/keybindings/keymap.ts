import type { KeyAction, KeyLike } from './keybinding-router'

/**
 * A canonical chord string, e.g. `"ctrl+shift+p"`. Lowercased, modifiers in a
 * fixed order (`ctrl` then `shift`), `?` folded to `/`. Alt/Meta combos and
 * non-Ctrl keys are never app chords (they pass straight through to the PTY),
 * so they have no canonical form — `chordOf` returns `null` for them.
 */
export type Chord = string

/** Resolves a canonical {@link Chord} to the action it triggers. */
export type Keymap = Readonly<Record<Chord, KeyAction>>

/** Fold an event `key` to its canonical token. */
function normalizeKey(key: string): string {
  const k = key.toLowerCase()
  // Shift+/ yields '?' on US layouts; treat both as the same physical key so a
  // single `ctrl+shift+/` binding fires for either.
  return k === '?' ? '/' : k
}

const BARE_MODIFIERS = new Set(['control', 'shift', 'alt', 'meta', ''])

/**
 * Canonical chord for a *bindable* event, or `null` when the event can never be
 * an app chord — no Ctrl, an Alt/Meta combo, or a bare modifier press — and so
 * must reach the terminal untouched. This `null` path is what preserves the
 * spec §7.4 passthrough invariant regardless of what the keymap contains.
 */
export function chordOf(e: KeyLike): Chord | null {
  if (!e.ctrlKey || e.altKey || e.metaKey) return null
  const key = normalizeKey(e.key)
  if (BARE_MODIFIERS.has(key)) return null
  return e.shiftKey ? `ctrl+shift+${key}` : `ctrl+${key}`
}

/**
 * The built-in bindings — the single source of truth for Weft's default chords.
 * `routeKey` resolves against this by default; the (upcoming) user keymap layers
 * overrides on top. `jump-tab` (Ctrl+1..9) is intentionally NOT here: it is a
 * positional built-in computed by `routeKey` and is not remappable.
 */
export const DEFAULT_KEYMAP: Keymap = {
  'ctrl+t': { kind: 'new-tab' },
  'ctrl+w': { kind: 'close-tab' },
  'ctrl+tab': { kind: 'next-tab' },
  'ctrl+shift+tab': { kind: 'prev-tab' },
  'ctrl+shift+pageup': { kind: 'move-tab', dir: -1 },
  'ctrl+shift+pagedown': { kind: 'move-tab', dir: 1 },
  'ctrl+`': { kind: 'focus-region', region: 'terminal' },
  'ctrl+shift+e': { kind: 'focus-region', region: 'explorer' },
  'ctrl+f6': { kind: 'focus-cycle', dir: 1 },
  'ctrl+shift+f6': { kind: 'focus-cycle', dir: -1 },
  'ctrl+shift+p': { kind: 'command-palette' },
  'ctrl+shift+/': { kind: 'help-overlay' },
  'ctrl+shift+f': { kind: 'terminal-search' }
}
