import { create } from 'zustand'
import {
  emptyOpenFiles,
  openFile as coreOpenFile,
  closeFile as coreCloseFile,
  setActiveFile as coreSetActive,
  activeFile,
  type OpenFile,
  type OpenFilesState
} from '@core/workspace/open-files'

export type ViewerMode = 'view' | 'diff'

export interface ViewerState {
  /** All files open as editor tabs + which is active (pure model in core). */
  openFiles: OpenFilesState
  /** The active file, or null when nothing is open. Derived from `openFiles`;
   *  kept as a field so selectors/consumers can read `s.file` directly. */
  file: OpenFile | null
  mode: ViewerMode
  /** In 'view' mode, whether the editor is editable (Ctrl+S saves). */
  editing: boolean
  /** Bumped by requestSave(); ViewerPane saves the current model on change. */
  saveTick: number
  /** Open a file as a tab (re-activates it if already open) and show it. */
  openFile: (path: string, name: string) => void
  /** Close a file's tab, activating a neighbour (or clearing when none remain). */
  closeFile: (path: string) => void
  /** Activate the tab at `index`. */
  setActiveFile: (index: number) => void
  setMode: (mode: ViewerMode) => void
  setEditing: (editing: boolean) => void
  /** Ask the viewer to persist the current edit (app-level Ctrl+S). */
  requestSave: () => void
  /** Close the active tab (the viewer's × / "Close Viewer" command). */
  close: () => void
}

export const useViewerStore = create<ViewerState>((set) => ({
  openFiles: emptyOpenFiles,
  file: null,
  mode: 'view',
  editing: false,
  saveTick: 0,
  openFile: (path, name) =>
    set((s) => {
      const openFiles = coreOpenFile(s.openFiles, { path, name })
      const file = activeFile(openFiles)
      // Only reset mode/editing when the ACTIVE file actually changes — otherwise
      // re-opening the file you're editing would tear down Monaco and lose edits.
      return file?.path === s.file?.path
        ? { openFiles }
        : { openFiles, file, mode: 'view', editing: false }
    }),
  closeFile: (path) =>
    set((s) => {
      const openFiles = coreCloseFile(s.openFiles, path)
      const file = activeFile(openFiles)
      return file?.path === s.file?.path ? { openFiles } : { openFiles, file, editing: false }
    }),
  setActiveFile: (index) =>
    set((s) => {
      const openFiles = coreSetActive(s.openFiles, index)
      const file = activeFile(openFiles)
      return file?.path === s.file?.path
        ? { openFiles }
        : { openFiles, file, mode: 'view', editing: false }
    }),
  // Diff is read-only, so switching to it drops edit mode.
  setMode: (mode) => set(mode === 'diff' ? { mode, editing: false } : { mode }),
  // Editing implies view mode (you can't edit the diff).
  setEditing: (editing) => set(editing ? { editing, mode: 'view' } : { editing }),
  requestSave: () => set((s) => ({ saveTick: s.saveTick + 1 })),
  close: () =>
    set((s) => {
      const active = activeFile(s.openFiles)
      if (!active) return s
      const openFiles = coreCloseFile(s.openFiles, active.path)
      return { openFiles, file: activeFile(openFiles), editing: false }
    })
}))
