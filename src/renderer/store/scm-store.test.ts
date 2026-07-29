import { describe, it, expect, beforeEach } from 'vitest'
import { useScmStore } from './scm-store'
import type { GitRepoStatus } from '@shared/ipc/api-contract'

const status: GitRepoStatus = {
  isRepo: true,
  branch: 'main',
  upstream: 'origin/main',
  ahead: 1,
  behind: 0,
  changes: [],
  error: null
}

beforeEach(() => {
  useScmStore.setState({ status: null, commitMsg: '', busy: false, error: null })
})

describe('useScmStore', () => {
  it('stores the latest status', () => {
    useScmStore.getState().setStatus(status)
    expect(useScmStore.getState().status?.branch).toBe('main')
  })

  it('tracks the commit message', () => {
    useScmStore.getState().setCommitMsg('feat: x')
    expect(useScmStore.getState().commitMsg).toBe('feat: x')
  })

  it('tracks busy + error state', () => {
    const s = useScmStore.getState()
    s.setBusy(true)
    s.setError('push rejected')
    expect(useScmStore.getState().busy).toBe(true)
    expect(useScmStore.getState().error).toBe('push rejected')
  })
})
