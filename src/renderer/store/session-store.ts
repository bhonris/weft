import { create } from 'zustand'
import type { SessionStatus } from '@shared/status/hook-events'
import type { SessionCommand } from '@shared/ipc/api-contract'

export interface Tab {
  tabId: string
  title: string
  cwd: string
  command: SessionCommand
  status: SessionStatus
}

export type ThemeChoice = 'system' | 'light' | 'dark'

export interface SessionState {
  tabs: Tab[]
  activeTabId: string | null
  theme: ThemeChoice
  setTheme: (theme: ThemeChoice) => void
  addTab: (
    tab: Omit<Tab, 'status' | 'command'> & { status?: SessionStatus; command?: SessionCommand }
  ) => void
  removeTab: (tabId: string) => void
  setActive: (tabId: string) => void
  setStatus: (tabId: string, status: SessionStatus) => void
  rename: (tabId: string, title: string) => void
  /** Move `dragId` to `targetId`'s position (drag-and-drop reorder). */
  moveTab: (dragId: string, targetId: string) => void
  /** Activate the tab `step` positions away from the active one (wraps). */
  cycleTab: (step: 1 | -1) => void
}

/** Renderer-side mirror of the tabs; the authoritative PTY state lives in main. */
export const useSessionStore = create<SessionState>((set) => ({
  tabs: [],
  activeTabId: null,
  theme: 'system',
  setTheme: (theme) => set({ theme }),

  addTab: (tab) =>
    set((s) => {
      if (s.tabs.some((t) => t.tabId === tab.tabId)) return s
      // 'unknown' until a hook actually reports — never claim a state we
      // haven't observed (spec AC: endpoint down / no hook → unknown).
      const next: Tab = { status: 'unknown', command: 'claude', ...tab }
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
    })),

  moveTab: (dragId, targetId) =>
    set((s) => {
      if (dragId === targetId) return s
      const dragged = s.tabs.find((t) => t.tabId === dragId)
      const targetIdx = s.tabs.findIndex((t) => t.tabId === targetId)
      if (!dragged || targetIdx === -1) return s
      const without = s.tabs.filter((t) => t.tabId !== dragId)
      const insertAt = without.findIndex((t) => t.tabId === targetId)
      without.splice(insertAt, 0, dragged)
      return { tabs: without }
    }),

  cycleTab: (step) =>
    set((s) => {
      if (s.tabs.length === 0) return s
      const idx = s.tabs.findIndex((t) => t.tabId === s.activeTabId)
      const next = (idx + step + s.tabs.length) % s.tabs.length
      return { activeTabId: s.tabs[next]!.tabId }
    })
}))
