import { create } from 'zustand'

export type ViewerMode = 'view' | 'diff'

export interface ViewerState {
  /** The file open in the Monaco pane, or null when the pane is closed. */
  file: { path: string; name: string } | null
  mode: ViewerMode
  /** In 'view' mode, whether the editor is editable (Ctrl+S saves). */
  editing: boolean
  /** Bumped by requestSave(); ViewerPane saves the current model on change. */
  saveTick: number
  openFile: (path: string, name: string) => void
  setMode: (mode: ViewerMode) => void
  setEditing: (editing: boolean) => void
  /** Ask the viewer to persist the current edit (app-level Ctrl+S). */
  requestSave: () => void
  close: () => void
}

export const useViewerStore = create<ViewerState>((set) => ({
  file: null,
  mode: 'view',
  editing: false,
  saveTick: 0,
  openFile: (path, name) => set({ file: { path, name }, mode: 'view', editing: false }),
  // Diff is read-only, so switching to it drops edit mode.
  setMode: (mode) => set(mode === 'diff' ? { mode, editing: false } : { mode }),
  // Editing implies view mode (you can't edit the diff).
  setEditing: (editing) => set(editing ? { editing, mode: 'view' } : { editing }),
  requestSave: () => set((s) => ({ saveTick: s.saveTick + 1 })),
  close: () => set({ file: null, editing: false })
}))
