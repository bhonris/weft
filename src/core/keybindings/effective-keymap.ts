import { DEFAULT_KEYMAP, isProtectedChord, type Chord, type Keymap } from './keymap'
import { actionForCommand } from '../commands/action-dispatch'
import type { KeyAction } from './keybinding-router'

/**
 * The user's persisted rebindings, `chord → command id`. Stored (not the full
 * effective map) so the persisted shape stays small and stable — see
 * WorkspaceState.keymapOverrides. Values are plain strings: they're validated
 * defensively by {@link buildKeymap}, so a stale/unknown id is simply ignored.
 */
export type KeymapOverrides = Readonly<Record<Chord, string>>

/**
 * Merge user overrides onto {@link DEFAULT_KEYMAP} to get the effective keymap
 * `routeKey` should resolve against. Overrides that name a protected chord, or a
 * command with no chord form, are skipped — so a bad override can never shadow a
 * terminal key or crash resolution. With no overrides this is a copy of the
 * defaults, so routing behaves exactly as the built-ins.
 */
export function buildKeymap(overrides: KeymapOverrides): Keymap {
  const map: Record<Chord, KeyAction> = { ...DEFAULT_KEYMAP }
  for (const [chord, commandId] of Object.entries(overrides)) {
    if (isProtectedChord(chord)) continue
    const action = actionForCommand(commandId)
    if (action) map[chord] = action
  }
  return map
}
