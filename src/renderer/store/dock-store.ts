import { create } from 'zustand'
import {
  DEFAULT_DOCK,
  setDockPosition,
  setDockSize,
  clampDockSize,
  type DockState,
  type DockPosition
} from '@core/workspace/dock'

export interface DockUiState extends DockState {
  /**
   * "Maximize CLI" focus mode: when true the editor pane + divider are hidden
   * and the CLI fills the whole split area, WITHOUT closing the open file.
   * Deliberately transient — it is NOT part of the persisted {@link DockState},
   * so `restore` and workspace save ignore it and it resets to split on relaunch.
   */
  maximized: boolean
  setPosition: (position: DockPosition) => void
  setSize: (size: number) => void
  /** Flip the maximize-CLI focus mode. */
  toggleMaximized: () => void
  /** Set the maximize-CLI focus mode explicitly (e.g. reset on file change). */
  setMaximized: (maximized: boolean) => void
  /** Replace the whole dock state (used when restoring the workspace). */
  restore: (dock: DockState) => void
}

export const useDockStore = create<DockUiState>((set) => ({
  ...DEFAULT_DOCK,
  maximized: false,
  setPosition: (position) => set((s) => setDockPosition(s, position)),
  setSize: (size) => set((s) => setDockSize(s, size)),
  toggleMaximized: () => set((s) => ({ maximized: !s.maximized })),
  setMaximized: (maximized) => set({ maximized }),
  // Re-clamp the size so a corrupt/hand-edited persisted value can't break the
  // layout (position is enum-validated by the persistence schema). Maximize is
  // transient and intentionally left untouched by a workspace restore.
  restore: ({ position, size }) => set({ position, size: clampDockSize(size) })
}))
