/**
 * Migrate a legacy v0 blob (pre-versioning) to the v1 shape.
 *
 * v0 blobs came from early prototypes: they had no `version`, tabs lacked
 * `sessionId`/`windowId`, and `explorerRoots`/`tabOrder` may be absent. We
 * fill every missing field with a safe default rather than dropping data.
 */
export function v0ToV1(blob: Record<string, unknown>): Record<string, unknown> {
  const rawTabs = Array.isArray(blob['tabs']) ? (blob['tabs'] as unknown[]) : []
  const tabs = rawTabs.map((t) => {
    const tab = (t ?? {}) as Record<string, unknown>
    const tabId = str(tab['tabId']) ?? cryptoLikeId(tab)
    return {
      tabId,
      sessionId: str(tab['sessionId']) ?? tabId,
      title: str(tab['title']) ?? 'session',
      cwd: str(tab['cwd']) ?? '',
      command: tab['command'] === 'shell' ? 'shell' : 'claude',
      windowId: str(tab['windowId']) ?? 'main'
    }
  })

  const tabOrder = Array.isArray(blob['tabOrder'])
    ? (blob['tabOrder'] as unknown[]).filter((x): x is string => typeof x === 'string')
    : tabs.map((t) => t.tabId)

  const explorerRoots = Array.isArray(blob['explorerRoots'])
    ? (blob['explorerRoots'] as unknown[]).filter((x): x is string => typeof x === 'string')
    : []

  const theme = ['system', 'light', 'dark', 'cyberpunk'].includes(blob['theme'] as string)
    ? (blob['theme'] as string)
    : 'cyberpunk'

  return { version: 1, tabs, tabOrder, explorerRoots, theme }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

/** Deterministic fallback id derived from a tab's cwd (no randomness in a pure fn). */
function cryptoLikeId(tab: Record<string, unknown>): string {
  const seed = str(tab['cwd']) ?? str(tab['title']) ?? 'tab'
  return `legacy-${seed.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 24)}`
}
