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

/** Plain-Ctrl chords Weft is allowed to own (everything else plain-Ctrl belongs
 *  to the terminal). Ctrl+Shift+* is always fair game; see isProtectedChord. */
const BINDABLE_PLAIN_CTRL: ReadonlySet<Chord> = new Set(['ctrl+t', 'ctrl+w', 'ctrl+`'])

/**
 * True when binding `chord` to an app command would swallow a key the terminal
 * needs (spec §7.4) — so the editor must refuse it. The rule is deliberately
 * conservative:
 *   - `Ctrl+Shift+<key>` — never protected (terminals don't use this space).
 *   - `Ctrl+1..9` — protected: the positional tab-jump built-in, not remappable.
 *   - any other plain `Ctrl+<key>` — protected UNLESS it is one Weft already
 *     reserves by default (Ctrl+T/W/`), because plain-Ctrl is readline/control
 *     territory (Ctrl+C interrupt, Ctrl+H backspace, Ctrl+R search, …).
 */
export function isProtectedChord(chord: Chord): boolean {
  if (chord.startsWith('ctrl+shift+')) return false
  if (/^ctrl\+[1-9]$/.test(chord)) return true
  return !BINDABLE_PLAIN_CTRL.has(chord)
}

/** Outcome of {@link bindChord}: either the new keymap (plus any displaced
 *  binding, so the editor can warn about a conflict) or a refusal reason. */
export type BindResult =
  | { ok: true; keymap: Keymap; displaced: KeyAction | null }
  | { ok: false; reason: 'protected' }

/**
 * Assign `chord` → `action`, returning a NEW keymap (never mutates the input).
 * Refuses protected chords (criterion 3). When `chord` was already bound to a
 * different action the binding still wins, but the displaced action is reported
 * so the caller can surface the conflict (criterion 4 — reassign-with-warning).
 */
export function bindChord(keymap: Keymap, chord: Chord, action: KeyAction): BindResult {
  if (isProtectedChord(chord)) return { ok: false, reason: 'protected' }
  return { ok: true, keymap: { ...keymap, [chord]: action }, displaced: keymap[chord] ?? null }
}

/** Restore a single chord to its built-in default (or unbind it if it has none). */
export function resetChord(keymap: Keymap, chord: Chord): Keymap {
  const next: Record<Chord, KeyAction> = { ...keymap }
  if (chord in DEFAULT_KEYMAP) next[chord] = DEFAULT_KEYMAP[chord]!
  else delete next[chord]
  return next
}

/** A fresh copy of the built-in defaults (reset-to-defaults). */
export function resetAll(): Keymap {
  return { ...DEFAULT_KEYMAP }
}
