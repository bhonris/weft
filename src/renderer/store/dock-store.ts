import { create } from 'zustand'
import {
  DEFAULT_DOCK,
  setDockPosition,
  setDockSize,
  type DockState,
  type DockPosition
} from '@core/workspace/dock'

export interface DockUiState extends DockState {
  setPosition: (position: DockPosition) => void
  setSize: (size: number) => void
  /** Replace the whole dock state (used when restoring the workspace). */
  restore: (dock: DockState) => void
}

export const useDockStore = create<DockUiState>((set) => ({
  ...DEFAULT_DOCK,
  setPosition: (position) => set((s) => setDockPosition(s, position)),
  setSize: (size) => set((s) => setDockSize(s, size)),
  restore: ({ position, size }) => set({ position, size })
}))
