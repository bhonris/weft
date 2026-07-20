import type { WorkspaceState } from '@shared/ipc/api-contract'
import { WORKSPACE_VERSION } from './schema'
import { DEFAULT_DOCK } from '@core/workspace/dock'
import { DEFAULT_FONT } from '@core/workspace/font'

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
    keymapOverrides: {},
    // CLI dock defaults to the bottom edge (see core/workspace/dock).
    dock: { ...DEFAULT_DOCK },
    // The file explorer is the default sidebar panel.
    activePanel: 'explorer',
    // Text sizing starts at the historical defaults (13px terminal, 14px editor,
    // 100% zoom); the user adjusts via status-bar buttons and Ctrl+= / - / 0.
    terminalFontSize: DEFAULT_FONT.terminalFontSize,
    editorFontSize: DEFAULT_FONT.editorFontSize,
    uiZoom: DEFAULT_FONT.uiZoom
  }
}
