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
import type { GitDiffSide } from '@shared/ipc/api-contract'

/** Set (or clear) the git-diff side on a specific open file's tab. */
function stampGit(
  open: OpenFilesState,
  path: string,
  side: GitDiffSide | undefined
): OpenFilesState {
  return {
    ...open,
    files: open.files.map((f) => (f.path === path ? { ...f, git: side } : f))
  }
}

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
  /** In 'view' mode, show the rendered Markdown preview instead of the source.
   *  Only meaningful for Markdown files; reset whenever the file/mode changes. */
  preview: boolean
  /** Bumped by requestSave(); ViewerPane saves the current model on change. */
  saveTick: number
  /** Switch the viewer to a project's file set (e.g. when the active tab changes). */
  setProject: (projectId: string | null) => void
  /** Forget a project's open files (when its tab closes / tears off). */
  dropProject: (projectId: string) => void
  /** Open a file as a tab (re-activates it if already open) and show it. */
  openFile: (path: string, name: string) => void
  /**
   * Open a file's git diff for `side` in diff mode (Source Control panel). Stamps
   * the side on the tab so the viewer fetches the right baseline/target pair.
   */
  openGitDiff: (path: string, name: string, side: GitDiffSide) => void
  /** Close a file's tab, activating a neighbour (or clearing when none remain). */
  closeFile: (path: string) => void
  /** Activate the tab at `index`. */
  setActiveFile: (index: number) => void
  setMode: (mode: ViewerMode) => void
  setEditing: (editing: boolean) => void
  /** Toggle the rendered Markdown preview (view mode only). */
  setPreview: (preview: boolean) => void
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
    return file?.path === s.file?.path
      ? base
      : { ...base, mode: 'view', editing: false, preview: false }
  }

  return {
    byProject: {},
    projectId: null,
    openFiles: emptyOpenFiles,
    file: null,
    mode: 'view',
    editing: false,
    preview: false,
    saveTick: 0,
    setProject: (projectId) =>
      set((s) => {
        if (projectId === s.projectId) return s
        const open = s.byProject[keyOf(projectId)] ?? emptyOpenFiles
        // A different project is fresh context: reset transient view state.
        return {
          projectId,
          openFiles: open,
          file: activeFile(open),
          mode: 'view',
          editing: false,
          preview: false
        }
      }),
    dropProject: (projectId) =>
      set((s) => {
        const key = keyOf(projectId)
        if (!(key in s.byProject)) return s
        const byProject = { ...s.byProject }
        delete byProject[key]
        // Dropping the project being shown also clears the visible editor.
        if (projectId === s.projectId) {
          return {
            byProject,
            openFiles: emptyOpenFiles,
            file: null,
            mode: 'view',
            editing: false,
            preview: false
          }
        }
        return { byProject }
      }),
    // A plain (explorer) open clears any git-diff side left on that tab, so the
    // file reverts to normal view / diff-vs-HEAD behaviour.
    openFile: (path, name) =>
      set((s) => mutate(s, (open) => stampGit(coreOpenFile(open, { path, name }), path, undefined))),
    openGitDiff: (path, name, side) =>
      set((s) => {
        const key = keyOf(s.projectId)
        const opened = stampGit(coreOpenFile(s.byProject[key] ?? emptyOpenFiles, { path, name }), path, side)
        return {
          byProject: { ...s.byProject, [key]: opened },
          openFiles: opened,
          file: activeFile(opened),
          mode: 'diff',
          editing: false,
          preview: false
        }
      }),
    closeFile: (path) => set((s) => mutate(s, (open) => coreCloseFile(open, path))),
    setActiveFile: (index) => set((s) => mutate(s, (open) => coreSetActive(open, index))),
    // Diff is read-only, so switching to it drops edit mode. Changing mode always
    // leaves the rendered preview (preview is a view-mode-only surface).
    setMode: (mode) => set(mode === 'diff' ? { mode, editing: false, preview: false } : { mode, preview: false }),
    // Editing implies view mode (you can't edit the diff) and the raw source, not
    // the rendered preview.
    setEditing: (editing) =>
      set(editing ? { editing, mode: 'view', preview: false } : { editing }),
    setPreview: (preview) => set({ preview }),
    requestSave: () => set((s) => ({ saveTick: s.saveTick + 1 })),
    close: () =>
      set((s) => {
        const active = activeFile(s.byProject[keyOf(s.projectId)] ?? emptyOpenFiles)
        if (!active) return s
        return mutate(s, (open) => coreCloseFile(open, active.path))
      })
  }
})
