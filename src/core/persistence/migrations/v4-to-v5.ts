import { DEFAULT_DOCK } from '@core/workspace/dock'

/**
 * v4 → v5: adds `dock` (CLI dock placement for the in-project split). Defaults
 * to the bottom edge at the standard ratio; other fields pass through untouched.
 */
export function v4ToV5(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 5, dock: { ...DEFAULT_DOCK } }
}
