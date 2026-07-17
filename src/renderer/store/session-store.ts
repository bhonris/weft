import { create } from 'zustand'
import type { SessionStatus } from '@shared/status/hook-events'

export interface Tab {
  tabId: string
  title: string
  cwd: string
  status: SessionStatus
}

export interface SessionState {
  tabs: Tab[]
  activeTabId: string | null
  addTab: (tab: Omit<Tab, 'status'> & { status?: SessionStatus }) => void
  removeTab: (tabId: string) => void
  setActive: (tabId: string) => void
  setStatus: (tabId: string, status: SessionStatus) => void
  rename: (tabId: string, title: string) => void
}

/** Renderer-side mirror of the tabs; the authoritative PTY state lives in main. */
export const useSessionStore = create<SessionState>((set) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab) =>
    set((s) => {
      if (s.tabs.some((t) => t.tabId === tab.tabId)) return s
      const next: Tab = { status: 'working', ...tab }
      return { tabs: [...s.tabs, next], activeTabId: tab.tabId }
    }),

  removeTab: (tabId) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.tabId !== tabId)
      const activeTabId =
        s.activeTabId === tabId ? (tabs[tabs.length - 1]?.tabId ?? null) : s.activeTabId
      return { tabs, activeTabId }
    }),

  setActive: (tabId) => set({ activeTabId: tabId }),

  setStatus: (tabId, status) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.tabId === tabId ? { ...t, status } : t))
    })),

  rename: (tabId, title) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.tabId === tabId ? { ...t, title } : t))
    }))
}))
