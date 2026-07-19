import type { WorkspaceState } from '@shared/ipc/api-contract'
import { WORKSPACE_VERSION } from './schema'

/** A fresh, empty workspace — used on first launch and as a corruption fallback. */
export function defaultWorkspace(): WorkspaceState {
  return {
    version: WORKSPACE_VERSION,
    tabs: [],
    tabOrder: [],
    explorerRoots: [],
    // cyberpunk is the out-of-the-box default theme.
    theme: 'cyberpunk',
    resumeEnabled: false,
    // OS notifications are on out of the box (the "which session needs me?" signal).
    notificationsEnabled: true,
    // No custom keybindings by default — the built-in chords apply.
    keymapOverrides: {}
  }
}
