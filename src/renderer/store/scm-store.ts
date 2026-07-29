import { create } from 'zustand'
import type { GitRepoStatus } from '@shared/ipc/api-contract'

/**
 * Renderer-side mirror of the Source Control panel. `status` is the latest git
 * working-tree status polled from main; `commitMsg` is the in-progress commit
 * message; `busy` guards against overlapping mutations; `error` holds the last
 * mutation failure (git stderr) to surface in the panel.
 */
export interface ScmStoreState {
  status: GitRepoStatus | null
  commitMsg: string
  busy: boolean
  error: string | null
  setStatus: (status: GitRepoStatus) => void
  setCommitMsg: (commitMsg: string) => void
  setBusy: (busy: boolean) => void
  setError: (error: string | null) => void
}

export const useScmStore = create<ScmStoreState>((set) => ({
  status: null,
  commitMsg: '',
  busy: false,
  error: null,
  setStatus: (status) => set({ status }),
  setCommitMsg: (commitMsg) => set({ commitMsg }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error })
}))
