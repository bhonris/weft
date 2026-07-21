/**
 * Pure display helpers for Claude model ids and reasoning-effort tiers, used by
 * the status-bar model/effort indicator. No I/O.
 */

/** Friendly names for the model ids we know; the fallback handles the rest. */
const KNOWN_MODELS: Readonly<Record<string, string>> = {
  'claude-opus-4-8': 'Opus 4.8',
  'claude-opus-4-7': 'Opus 4.7',
  'claude-sonnet-5': 'Sonnet 5',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-fable-5': 'Fable 5',
  'claude-haiku-4-5': 'Haiku 4.5',
  'claude-haiku-4-5-20251001': 'Haiku 4.5'
}

const DATE_SEGMENT = /^\d{8}$/

/**
 * A human display name for a model id. Known ids get a curated name; any other
 * `claude-<family>-<version…>[-<date>]` id is cleaned up generically (drop the
 * `claude-` prefix and a trailing date, Title-case the family, join the version
 * parts with dots — so `claude-opus-9-1` → "Opus 9.1"). Anything that isn't a
 * recognizable claude id (e.g. `<synthetic>`) is returned verbatim.
 */
export function modelDisplayName(id: string): string {
  const known = KNOWN_MODELS[id]
  if (known) return known
  if (!id.startsWith('claude-')) return id

  const parts = id.slice('claude-'.length).split('-').filter((p) => p.length > 0)
  if (parts.length > 1 && DATE_SEGMENT.test(parts[parts.length - 1]!)) parts.pop()
  const family = parts.shift()
  if (!family) return id
  const name = family.charAt(0).toUpperCase() + family.slice(1)
  return parts.length > 0 ? `${name} ${parts.join('.')}` : name
}

/** A title-cased effort label ("high" → "High"), or null when there is none. */
export function effortLabel(effort: string | null | undefined): string | null {
  if (!effort) return null
  return effort.charAt(0).toUpperCase() + effort.slice(1)
}
