import type { WorkspaceState } from '@shared/ipc/api-contract'
import { WORKSPACE_VERSION } from './schema'

/** A fresh, empty workspace — used on first launch and as a corruption fallback. */
export function defaultWorkspace(): WorkspaceState {
  return {
    version: WORKSPACE_VERSION,
    tabs: [],
    tabOrder: [],
    explorerRoots: [],
    theme: 'system',
    resumeEnabled: false
  }
}
