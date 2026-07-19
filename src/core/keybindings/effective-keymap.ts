import { DEFAULT_KEYMAP, isProtectedChord, type Chord, type Keymap } from './keymap'
import { actionForCommand, commandIdForAction } from '../commands/action-dispatch'
import type { KeyAction } from './keybinding-router'

/**
 * The user's persisted rebindings, `chord → command id`. Stored (not the full
 * effective map) so the persisted shape stays small and stable — see
 * WorkspaceState.keymapOverrides. Values are plain strings: they're validated
 * defensively by {@link buildKeymap}, so a stale/unknown id is simply ignored.
 * The reserved value {@link UNBOUND} (`""`) means "suppress this default chord"
 * — how a rebind frees the chord a command used to sit on.
 */
export type KeymapOverrides = Readonly<Record<Chord, string>>

/** Override value meaning "unbind this (default) chord entirely". */
export const UNBOUND = ''

function actionEq(a: KeyAction, b: KeyAction): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** A copy of `overrides` with every chord that maps to `commandId` removed. */
function withoutCommand(overrides: KeymapOverrides, commandId: string): Record<Chord, string> {
  const next: Record<Chord, string> = {}
  for (const [chord, id] of Object.entries(overrides)) {
    if (id !== commandId) next[chord] = id
  }
  return next
}

/**
 * Merge user overrides onto {@link DEFAULT_KEYMAP} to get the effective keymap
 * `routeKey` should resolve against. An override that names a protected chord,
 * or a command with no chord form, is skipped — so a bad override can never
 * shadow a terminal key or crash resolution. The {@link UNBOUND} value deletes a
 * default chord. With no overrides this is a copy of the defaults, so routing
 * behaves exactly as the built-ins.
 */
export function buildKeymap(overrides: KeymapOverrides): Keymap {
  const map: Record<Chord, KeyAction> = { ...DEFAULT_KEYMAP }
  for (const [chord, commandId] of Object.entries(overrides)) {
    if (isProtectedChord(chord)) continue
    if (commandId === UNBOUND) {
      delete map[chord]
      continue
    }
    const action = actionForCommand(commandId)
    if (action) map[chord] = action
  }
  return map
}

/** The chord currently bound to `commandId` in the effective keymap, or null. */
export function chordForCommand(overrides: KeymapOverrides, commandId: string): Chord | null {
  const target = actionForCommand(commandId)
  if (!target) return null
  const map = buildKeymap(overrides)
  for (const [chord, action] of Object.entries(map)) {
    if (actionEq(action, target)) return chord
  }
  return null
}

/** The built-in chord for `commandId` (before any overrides), or null. */
function defaultChordForCommand(commandId: string): Chord | null {
  const target = actionForCommand(commandId)
  if (!target) return null
  for (const [chord, action] of Object.entries(DEFAULT_KEYMAP)) {
    if (actionEq(action, target)) return chord
  }
  return null
}

/** Result of {@link rebindCommand}. */
export type RebindResult =
  | { ok: true; overrides: Record<Chord, string>; displaced: string | null }
  | { ok: false; reason: 'protected' | 'invalid' }

/**
 * Move `commandId` to `chord`, returning the NEW overrides map (pure). Refuses a
 * protected or empty chord. The command truly *moves*: any prior override chords
 * for it are dropped, and if it currently sits on a built-in default chord that
 * default is unbound — so its old shortcut stops working. `displaced` names the
 * command that previously occupied `chord` (a conflict the caller can warn on),
 * or null.
 */
export function rebindCommand(
  overrides: KeymapOverrides,
  commandId: string,
  chord: Chord
): RebindResult {
  if (!chord) return { ok: false, reason: 'invalid' }
  if (isProtectedChord(chord)) return { ok: false, reason: 'protected' }
  if (actionForCommand(commandId) === null) return { ok: false, reason: 'invalid' }

  const effective = buildKeymap(overrides)
  const at = effective[chord]
  // commandIdForAction maps terminal-search → null (it's passthrough, not a
  // dispatched command), so recover it explicitly for the conflict warning.
  const displaced = at
    ? (commandIdForAction(at) ?? (at.kind === 'terminal-search' ? 'general.terminalSearch' : null))
    : null
  const oldChord = chordForCommand(overrides, commandId)

  const next = withoutCommand(overrides, commandId) // drop its prior custom chords
  // If the command sat on a built-in default chord, suppress it so it moves.
  if (oldChord && oldChord !== chord && defaultChordForCommand(commandId) === oldChord) {
    next[oldChord] = UNBOUND
  }
  next[chord] = commandId
  return { ok: true, overrides: next, displaced }
}

/** Reset a single command to its built-in default (or unbound if it has none). */
export function clearCommandBinding(
  overrides: KeymapOverrides,
  commandId: string
): Record<Chord, string> {
  const next = withoutCommand(overrides, commandId) // remove its custom chords
  const def = defaultChordForCommand(commandId)
  if (def && next[def] === UNBOUND) delete next[def] // restore a suppressed default
  return next
}
