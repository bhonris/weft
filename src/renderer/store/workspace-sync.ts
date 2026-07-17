import type {
  WeftBridge,
  WorkspaceState,
  SessionCommand,
  LiveSession
} from '@shared/ipc/api-contract'
import { WORKSPACE_VERSION } from '@core/persistence/schema'
import type { Tab } from './session-store'

/** The bridge subset workspace sync needs (test-friendly). */
export type WorkspaceSyncApi = Pick<WeftBridge, 'createSession' | 'listSessions'> & {
  loadWorkspace(): Promise<WorkspaceState>
  saveWorkspace(state: WorkspaceState): Promise<void>
}

/** Serialize the renderer's tab list into a persistable WorkspaceState. */
export function buildWorkspaceState(
  tabs: readonly Tab[],
  theme: WorkspaceState['theme'] = 'system'
): WorkspaceState {
  return {
    version: WORKSPACE_VERSION,
    tabs: tabs.map((t) => ({
      tabId: t.tabId,
      // The pinned session id lives in main; persistence only needs identity
      // for restore, where a FRESH session is spawned anyway.
      sessionId: t.tabId,
      title: t.title,
      cwd: t.cwd,
      command: t.command,
      windowId: 'main'
    })),
    tabOrder: tabs.map((t) => t.tabId),
    explorerRoots: [],
    theme
  }
}

export interface RestoredTab {
  tabId: string
  title: string
  cwd: string
  command: SessionCommand
}

/**
 * Rebuild the tab list on launch/reload by RECONCILING against main's live
 * sessions (spec §4.7 — a renderer reload must re-attach, never respawn):
 *
 *   1. A saved tab whose session is still alive in main is RE-ATTACHED under
 *      its original tabId — same PTY, scrollback replays on mount.
 *   2. A saved tab with no live session (true app restart) spawns fresh.
 *   3. A live session no tab claims (e.g. created moments before a reload,
 *      never saved) is ADOPTED as a tab rather than orphaned.
 *
 * Tabs whose cwd no longer spawns are skipped rather than failing the restore.
 */
export async function restoreWorkspace(
  api: Pick<WorkspaceSyncApi, 'createSession' | 'listSessions'>,
  saved: WorkspaceState
): Promise<RestoredTab[]> {
  let live: LiveSession[] = []
  try {
    live = await api.listSessions()
  } catch {
    // Older main without listSessions — fall back to spawn-per-tab below.
  }
  const liveById = new Map(live.map((s) => [s.tabId, s]))
  const claimed = new Set<string>()
  const restored: RestoredTab[] = []

  for (const tab of saved.tabs) {
    const alive = liveById.get(tab.tabId)
    if (alive && !alive.exited) {
      claimed.add(tab.tabId)
      restored.push({ tabId: tab.tabId, title: tab.title, cwd: tab.cwd, command: tab.command })
      continue
    }
    try {
      const { tabId } = await api.createSession({ cwd: tab.cwd, command: tab.command })
      restored.push({ tabId, title: tab.title, cwd: tab.cwd, command: tab.command })
    } catch {
      // Skip unrestorable tabs (deleted cwd, missing binary) — never block launch.
    }
  }

  // Adopt unclaimed live sessions so no running work is ever stranded.
  for (const session of live) {
    if (claimed.has(session.tabId) || session.exited) continue
    restored.push({
      tabId: session.tabId,
      title: session.cwd.split(/[\\/]/).pop() || session.cwd,
      cwd: session.cwd,
      command: session.command
    })
  }

  return restored
}
