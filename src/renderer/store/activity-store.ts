import { create } from 'zustand'
import type { SidebarPanel } from '@shared/ipc/api-contract'

/**
 * Which sidebar activity-bar panel is showing (file explorer vs usage). Mirrors
 * the persisted `activePanel` workspace field; App.tsx restores it on launch and
 * persists changes.
 */
export interface ActivityStoreState {
  active: SidebarPanel
  setActive: (panel: SidebarPanel) => void
}

export const useActivityStore = create<ActivityStoreState>((set) => ({
  active: 'explorer',
  setActive: (active) => set({ active })
}))
