/**
 * Pure helpers to parse a human-readable shortcut hint (e.g. "Ctrl+Shift+P")
 * into a `KeyLike`, so tests can prove a command's advertised shortcut actually
 * routes through `keybinding-router` (no drift between the palette/help labels
 * and the real chords). DOM-free.
 */
import type { KeyLike } from '../keybindings/keybinding-router'

const MODIFIERS: Record<string, keyof KeyLike> = {
  ctrl: 'ctrlKey',
  control: 'ctrlKey',
  shift: 'shiftKey',
  alt: 'altKey',
  option: 'altKey',
  meta: 'metaKey',
  cmd: 'metaKey',
  command: 'metaKey'
}

/**
 * Parse "Ctrl+Shift+P" → { ctrlKey:true, shiftKey:true, key:'P', … }.
 * The final token is the key; earlier tokens are modifiers. Returns null if a
 * non-final token is not a recognized modifier or the hint is empty.
 */
export function parseChord(hint: string): KeyLike | null {
  const parts = hint
    .split('+')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  if (parts.length === 0) return null

  const out: KeyLike = { key: '', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }
  const keyToken = parts[parts.length - 1]
  if (keyToken === undefined) return null
  const modTokens = parts.slice(0, -1)

  for (const m of modTokens) {
    const flag = MODIFIERS[m.toLowerCase()]
    if (!flag) return null
    ;(out[flag] as boolean) = true
  }

  // A bare modifier as the key token (e.g. "Ctrl") is not a chord.
  if (MODIFIERS[keyToken.toLowerCase()]) return null
  out.key = keyToken
  return out
}
