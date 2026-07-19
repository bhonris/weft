/**
 * Pure reducer for the set of files open as editor tabs within a project. The
 * renderer holds one of these per project; the active file drives the Monaco
 * pane. DOM-free and fully unit-tested.
 */
export interface OpenFile {
  path: string
  name: string
}

export interface OpenFilesState {
  files: OpenFile[]
  /** Index into `files`, or -1 when nothing is open. */
  activeIndex: number
}

export const emptyOpenFiles: OpenFilesState = { files: [], activeIndex: -1 }

/** Open a file: re-activate its existing tab if already open (no duplicate), else append + activate. */
export function openFile(state: OpenFilesState, file: OpenFile): OpenFilesState {
  const existing = state.files.findIndex((f) => f.path === file.path)
  if (existing >= 0) return { ...state, activeIndex: existing }
  const files = [...state.files, file]
  return { files, activeIndex: files.length - 1 }
}

/** Close a file's tab, reselecting a sensible neighbour (or -1 when none remain). */
export function closeFile(state: OpenFilesState, path: string): OpenFilesState {
  const i = state.files.findIndex((f) => f.path === path)
  if (i < 0) return state
  const files = state.files.filter((_, j) => j !== i)
  if (files.length === 0) return emptyOpenFiles
  let activeIndex = state.activeIndex
  if (i < activeIndex) activeIndex -= 1 // shift left with the removed tab
  else if (i === activeIndex) activeIndex = Math.min(i, files.length - 1) // land on the neighbour
  return { files, activeIndex }
}

/** Activate the tab at `index` (ignored if out of range). */
export function setActiveFile(state: OpenFilesState, index: number): OpenFilesState {
  if (index < 0 || index >= state.files.length) return state
  return { ...state, activeIndex: index }
}

/** The currently active file, or null when nothing is open. */
export function activeFile(state: OpenFilesState): OpenFile | null {
  return state.activeIndex >= 0 ? (state.files[state.activeIndex] ?? null) : null
}
