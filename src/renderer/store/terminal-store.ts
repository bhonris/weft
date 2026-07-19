import { create } from 'zustand'

/**
 * Small UI-signal store for terminal actions that the command layer needs to
 * reach the (DOM/xterm-bound) TerminalPane — mirroring viewer-store's saveTick.
 * Only the active tab's TerminalPane is mounted, so a single tick is enough.
 */
export interface TerminalUiState {
  /** Bumped by requestSearch(); the mounted TerminalPane opens its search bar. */
  searchTick: number
  /** Ask the terminal to open its in-terminal search (e.g. the palette command). */
  requestSearch: () => void
}

export const useTerminalStore = create<TerminalUiState>((set) => ({
  searchTick: 0,
  requestSearch: () => set((s) => ({ searchTick: s.searchTick + 1 }))
}))
