import { create } from 'zustand'
import type { IssuesPanelData } from '@shared/ipc/api-contract'

/**
 * Renderer-side mirror of the GitHub Issues panel state. `panel` is the latest
 * data polled from main; `signIn` holds the device-flow code to display while a
 * sign-in is pending; `authError` is the last sign-in failure message.
 */
export interface IssuesStoreState {
  panel: IssuesPanelData | null
  signIn: { userCode: string; verificationUri: string } | null
  authError: string | null
  setPanel: (panel: IssuesPanelData) => void
  setSignIn: (signIn: { userCode: string; verificationUri: string } | null) => void
  setAuthError: (message: string | null) => void
}

export const useIssuesStore = create<IssuesStoreState>((set) => ({
  panel: null,
  signIn: null,
  authError: null,
  setPanel: (panel) => set({ panel }),
  setSignIn: (signIn) => set({ signIn }),
  setAuthError: (authError) => set({ authError })
}))
