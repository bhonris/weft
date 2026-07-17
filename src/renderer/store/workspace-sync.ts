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
  theme: WorkspaceState['theme'] = 'system',
  resumeEnabled = false
): WorkspaceState {
  return {
    version: WORKSPACE_VERSION,
    tabs: tabs.map((t) => ({
      tabId: t.tabId,
      // The REAL pinned session id — what --resume needs after a restart.
      // Falls back to tabId for tabs whose id never reached the renderer.
      sessionId: t.sessionId ?? t.tabId,
      title: t.title,
      cwd: t.cwd,
      command: t.command,
      windowId: 'main'
    })),
    tabOrder: tabs.map((t) => t.tabId),
    explorerRoots: [],
    theme,
    resumeEnabled
  }
}

export interface RestoredTab {
  tabId: string
  sessionId?: string
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
      restored.push({
        tabId: tab.tabId,
        sessionId: alive.sessionId,
        title: tab.title,
        cwd: tab.cwd,
        command: tab.command
      })
      continue
    }
    try {
      // A dead claude tab with a real prior session id can resume its
      // conversation — opt-in only (it costs tokens). A sessionId equal to
      // the tabId is a legacy placeholder: nothing real to resume.
      const opts: Parameters<typeof api.createSession>[0] = {
        cwd: tab.cwd,
        command: tab.command
      }
      if (
        saved.resumeEnabled &&
        tab.command === 'claude' &&
        tab.sessionId &&
        tab.sessionId !== tab.tabId
      ) {
        opts.resumeSessionId = tab.sessionId
      }
      const created = await api.createSession(opts)
      restored.push({
        tabId: created.tabId,
        sessionId: created.sessionId,
        title: tab.title,
        cwd: tab.cwd,
        command: tab.command
      })
    } catch {
      // Skip unrestorable tabs (deleted cwd, missing binary) — never block launch.
    }
  }

  // Adopt unclaimed live sessions so no running work is ever stranded.
  for (const session of live) {
    if (claimed.has(session.tabId) || session.exited) continue
    restored.push({
      tabId: session.tabId,
      sessionId: session.sessionId,
      title: session.cwd.split(/[\\/]/).pop() || session.cwd,
      cwd: session.cwd,
      command: session.command
    })
  }

  return restored
}
