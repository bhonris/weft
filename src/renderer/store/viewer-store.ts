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
  /** Open-file tabs kept PER PROJECT (keyed by the project's tabId) so switching
   *  or closing a project never shows another project's files. */
  byProject: Record<string, OpenFilesState>
  /** The project whose files are currently shown (its tabId), or null for none. */
  projectId: string | null
  /** The active project's open files + active index (mirror of byProject[key]). */
  openFiles: OpenFilesState
  /** The active file, or null when nothing is open. Derived from `openFiles`;
   *  kept as a field so selectors/consumers can read `s.file` directly. */
  file: OpenFile | null
  mode: ViewerMode
  /** In 'view' mode, whether the editor is editable (Ctrl+S saves). */
  editing: boolean
  /** Bumped by requestSave(); ViewerPane saves the current model on change. */
  saveTick: number
  /** Switch the viewer to a project's file set (e.g. when the active tab changes). */
  setProject: (projectId: string | null) => void
  /** Forget a project's open files (when its tab closes / tears off). */
  dropProject: (projectId: string) => void
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

/** Map a nullable projectId to a stable object key (null → the shared default). */
const keyOf = (projectId: string | null): string => projectId ?? ''

export const useViewerStore = create<ViewerState>((set) => {
  /**
   * Apply a reducer to the ACTIVE project's open files and produce the store
   * patch: writes the new set into `byProject`, mirrors it into `openFiles`,
   * and re-derives `file`. `resetView` clears mode/editing when the active file
   * actually changes (so a genuine tab switch starts fresh, but re-selecting the
   * current tab never tears down Monaco / drops unsaved edits).
   */
  const mutate = (
    s: ViewerState,
    reduce: (open: OpenFilesState) => OpenFilesState
  ): Partial<ViewerState> => {
    const key = keyOf(s.projectId)
    const nextOpen = reduce(s.byProject[key] ?? emptyOpenFiles)
    const file = activeFile(nextOpen)
    const base: Partial<ViewerState> = {
      byProject: { ...s.byProject, [key]: nextOpen },
      openFiles: nextOpen,
      file
    }
    return file?.path === s.file?.path ? base : { ...base, mode: 'view', editing: false }
  }

  return {
    byProject: {},
    projectId: null,
    openFiles: emptyOpenFiles,
    file: null,
    mode: 'view',
    editing: false,
    saveTick: 0,
    setProject: (projectId) =>
      set((s) => {
        if (projectId === s.projectId) return s
        const open = s.byProject[keyOf(projectId)] ?? emptyOpenFiles
        // A different project is fresh context: reset transient view state.
        return { projectId, openFiles: open, file: activeFile(open), mode: 'view', editing: false }
      }),
    dropProject: (projectId) =>
      set((s) => {
        const key = keyOf(projectId)
        if (!(key in s.byProject)) return s
        const byProject = { ...s.byProject }
        delete byProject[key]
        // Dropping the project being shown also clears the visible editor.
        if (projectId === s.projectId) {
          return { byProject, openFiles: emptyOpenFiles, file: null, mode: 'view', editing: false }
        }
        return { byProject }
      }),
    openFile: (path, name) => set((s) => mutate(s, (open) => coreOpenFile(open, { path, name }))),
    closeFile: (path) => set((s) => mutate(s, (open) => coreCloseFile(open, path))),
    setActiveFile: (index) => set((s) => mutate(s, (open) => coreSetActive(open, index))),
    // Diff is read-only, so switching to it drops edit mode.
    setMode: (mode) => set(mode === 'diff' ? { mode, editing: false } : { mode }),
    // Editing implies view mode (you can't edit the diff).
    setEditing: (editing) => set(editing ? { editing, mode: 'view' } : { editing }),
    requestSave: () => set((s) => ({ saveTick: s.saveTick + 1 })),
    close: () =>
      set((s) => {
        const active = activeFile(s.byProject[keyOf(s.projectId)] ?? emptyOpenFiles)
        if (!active) return s
        return mutate(s, (open) => coreCloseFile(open, active.path))
      })
  }
})
