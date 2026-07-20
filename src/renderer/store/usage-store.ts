import { create } from 'zustand'
import type { UsageSummary, UsagePanelData } from '@shared/ipc/api-contract'

/** Renderer-side mirror of the latest Claude Code usage figures from main. */
export interface UsageStoreState {
  /** Status-bar aggregate across live sessions, or null until the first poll. */
  usage: UsageSummary | null
  /** Usage-panel payload (plan limits + weekly + sessions), or null until polled. */
  panel: UsagePanelData | null
  setUsage: (usage: UsageSummary) => void
  setPanel: (panel: UsagePanelData) => void
}

export const useUsageStore = create<UsageStoreState>((set) => ({
  usage: null,
  panel: null,
  setUsage: (usage) => set({ usage }),
  setPanel: (panel) => set({ panel })
}))
