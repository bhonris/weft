/**
 * v3 → v4: adds `keymapOverrides` (user keybinding rebindings, `chord → command
 * id`). Defaults to `{}` — existing users keep the built-in chords until they
 * remap something. Other fields pass through untouched.
 */
export function v3ToV4(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 4, keymapOverrides: {} }
}
