import type { WeftBridge, WorkspaceState, SessionCommand } from '@shared/ipc/api-contract'
import { WORKSPACE_VERSION } from '@core/persistence/schema'
import type { Tab } from './session-store'

/** The bridge subset workspace sync needs (test-friendly). */
export type WorkspaceSyncApi = Pick<WeftBridge, 'createSession'> & {
  loadWorkspace(): Promise<WorkspaceState>
  saveWorkspace(state: WorkspaceState): Promise<void>
}

/** Serialize the renderer's tab list into a persistable WorkspaceState. */
export function buildWorkspaceState(tabs: readonly Tab[]): WorkspaceState {
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
    theme: 'system'
  }
}

export interface RestoredTab {
  tabId: string
  title: string
  cwd: string
  command: SessionCommand
}

/**
 * Respawn a session for every saved tab (fresh PTYs — a restart cannot revive
 * dead processes) and return the new tab identities in saved order. Tabs whose
 * cwd no longer spawns are skipped rather than failing the whole restore.
 */
export async function restoreWorkspace(
  api: Pick<WorkspaceSyncApi, 'createSession'>,
  saved: WorkspaceState
): Promise<RestoredTab[]> {
  const restored: RestoredTab[] = []
  for (const tab of saved.tabs) {
    try {
      const { tabId } = await api.createSession({ cwd: tab.cwd, command: tab.command })
      restored.push({ tabId, title: tab.title, cwd: tab.cwd, command: tab.command })
    } catch {
      // Skip unrestorable tabs (deleted cwd, missing binary) — never block launch.
    }
  }
  return restored
}
