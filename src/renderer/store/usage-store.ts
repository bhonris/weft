import { create } from 'zustand'
import type { UsageSummary, UsagePanelData, SessionInfo } from '@shared/ipc/api-contract'

/** Renderer-side mirror of the latest Claude Code usage figures from main. */
export interface UsageStoreState {
  /** Status-bar aggregate across live sessions, or null until the first poll. */
  usage: UsageSummary | null
  /** Usage-panel payload (plan limits + weekly + sessions), or null until polled. */
  panel: UsagePanelData | null
  /** The active claude tab's current model + effort, or null (shell tab / none). */
  sessionInfo: SessionInfo | null
  setUsage: (usage: UsageSummary) => void
  setPanel: (panel: UsagePanelData) => void
  setSessionInfo: (info: SessionInfo | null) => void
}

export const useUsageStore = create<UsageStoreState>((set) => ({
  usage: null,
  panel: null,
  sessionInfo: null,
  setUsage: (usage) => set({ usage }),
  setPanel: (panel) => set({ panel }),
  setSessionInfo: (sessionInfo) => set({ sessionInfo })
}))
