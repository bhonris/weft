import { create } from 'zustand'

export type ViewerMode = 'view' | 'diff'

export interface ViewerState {
  /** The file open in the Monaco pane, or null when the pane is closed. */
  file: { path: string; name: string } | null
  mode: ViewerMode
  openFile: (path: string, name: string) => void
  setMode: (mode: ViewerMode) => void
  close: () => void
}

export const useViewerStore = create<ViewerState>((set) => ({
  file: null,
  mode: 'view',
  openFile: (path, name) => set({ file: { path, name }, mode: 'view' }),
  setMode: (mode) => set({ mode }),
  close: () => set({ file: null })
}))
