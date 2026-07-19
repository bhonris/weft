import { create } from 'zustand'
import type { SessionStatus } from '@shared/status/hook-events'
import type { SessionCommand } from '@shared/ipc/api-contract'

export interface Tab {
  tabId: string
  /** The pinned claude session id (enables --resume across restarts). */
  sessionId?: string
  title: string
  cwd: string
  command: SessionCommand
  status: SessionStatus
}

export type ThemeChoice = 'system' | 'light' | 'dark' | 'cyberpunk'

/** The status-bar toggle / "Cycle Theme" command order. */
export const THEME_CYCLE: readonly ThemeChoice[] = ['system', 'light', 'dark', 'cyberpunk']

/** The next theme in the cycle after `theme` (wraps). */
export function nextTheme(theme: ThemeChoice): ThemeChoice {
  const i = THEME_CYCLE.indexOf(theme)
  return THEME_CYCLE[(i + 1) % THEME_CYCLE.length]!
}

export interface SpawnFailure {
  message: string
  cwd: string
  title: string
  command: SessionCommand
}

export interface SessionState {
  tabs: Tab[]
  activeTabId: string | null
  theme: ThemeChoice
  setTheme: (theme: ThemeChoice) => void
  /** Last failed spawn (claude not found, …) — drives the retry banner. */
  spawnFailure: SpawnFailure | null
  setSpawnFailure: (failure: SpawnFailure | null) => void
  /** Restored claude tabs relaunch with --resume (opt-in; costs tokens). */
  resumeEnabled: boolean
  setResumeEnabled: (enabled: boolean) => void
  /** Raise OS toasts for unfocused waiting/done sessions (on by default). */
  notificationsEnabled: boolean
  setNotificationsEnabled: (enabled: boolean) => void
  /** User keybinding overrides, `chord → command id` (empty = built-in chords). */
  keymapOverrides: Record<string, string>
  setKeymapOverrides: (overrides: Record<string, string>) => void
  addTab: (
    tab: Omit<Tab, 'status' | 'command' | 'sessionId'> & {
      status?: SessionStatus
      command?: SessionCommand
      sessionId?: string
    }
  ) => void
  removeTab: (tabId: string) => void
  setActive: (tabId: string) => void
  setStatus: (tabId: string, status: SessionStatus) => void
  rename: (tabId: string, title: string) => void
  /** Move `dragId` to `targetId`'s position (drag-and-drop reorder). */
  moveTab: (dragId: string, targetId: string) => void
  /** Reorder the ACTIVE tab one slot left (-1) or right (+1); clamps at ends. */
  moveActiveTab: (dir: 1 | -1) => void
  /** Activate the tab `step` positions away from the active one (wraps). */
  cycleTab: (step: 1 | -1) => void
}

/** Renderer-side mirror of the tabs; the authoritative PTY state lives in main. */
export const useSessionStore = create<SessionState>((set) => ({
  tabs: [],
  activeTabId: null,
  theme: 'cyberpunk',
  setTheme: (theme) => set({ theme }),
  spawnFailure: null,
  setSpawnFailure: (spawnFailure) => set({ spawnFailure }),
  resumeEnabled: false,
  setResumeEnabled: (resumeEnabled) => set({ resumeEnabled }),
  notificationsEnabled: true,
  setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
  keymapOverrides: {},
  setKeymapOverrides: (keymapOverrides) => set({ keymapOverrides }),

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
    }),

  moveActiveTab: (dir) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.tabId === s.activeTabId)
      if (idx === -1) return s
      const target = idx + dir
      if (target < 0 || target >= s.tabs.length) return s // clamp at ends
      const tabs = [...s.tabs]
      const [moved] = tabs.splice(idx, 1)
      tabs.splice(target, 0, moved!)
      return { tabs }
    })
}))
