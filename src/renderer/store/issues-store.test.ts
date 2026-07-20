import { describe, it, expect, beforeEach } from 'vitest'
import { useIssuesStore } from './issues-store'
import type { IssuesPanelData } from '@shared/ipc/api-contract'

const panel: IssuesPanelData = {
  repo: { owner: 'octo', repo: 'hello' },
  issues: [],
  authSource: 'gh',
  fetchedAt: '2026-07-20T12:00:00Z',
  stale: false,
  error: null
}

describe('useIssuesStore', () => {
  beforeEach(() => {
    useIssuesStore.setState({ panel: null, signIn: null, authError: null })
  })

  it('starts empty', () => {
    const s = useIssuesStore.getState()
    expect(s.panel).toBeNull()
    expect(s.signIn).toBeNull()
    expect(s.authError).toBeNull()
  })

  it('stores the panel payload', () => {
    useIssuesStore.getState().setPanel(panel)
    expect(useIssuesStore.getState().panel).toBe(panel)
  })

  it('stores and clears the sign-in prompt', () => {
    useIssuesStore
      .getState()
      .setSignIn({ userCode: 'ABCD-1234', verificationUri: 'https://github.com/login/device' })
    expect(useIssuesStore.getState().signIn?.userCode).toBe('ABCD-1234')
    useIssuesStore.getState().setSignIn(null)
    expect(useIssuesStore.getState().signIn).toBeNull()
  })

  it('stores an auth error', () => {
    useIssuesStore.getState().setAuthError('boom')
    expect(useIssuesStore.getState().authError).toBe('boom')
  })
})
