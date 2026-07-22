import { describe, it, expect, beforeEach } from 'vitest'
import { useUsageStore } from './usage-store'
import { emptySummary } from '@core/usage/summary'

describe('useUsageStore', () => {
  beforeEach(() => {
    useUsageStore.setState({ usage: null, panel: null, sessionInfo: null })
  })

  it('starts empty', () => {
    expect(useUsageStore.getState().usage).toBeNull()
    expect(useUsageStore.getState().panel).toBeNull()
    expect(useUsageStore.getState().sessionInfo).toBeNull()
  })

  it('setSessionInfo replaces (and clears) the active model/effort', () => {
    useUsageStore.getState().setSessionInfo({ model: 'claude-opus-4-8', effort: 'high' })
    expect(useUsageStore.getState().sessionInfo).toEqual({ model: 'claude-opus-4-8', effort: 'high' })
    useUsageStore.getState().setSessionInfo(null)
    expect(useUsageStore.getState().sessionInfo).toBeNull()
  })

  it('setUsage replaces the summary', () => {
    const summary = { ...emptySummary(), costUsd: 0.5, totalTokens: 1000, sessionCount: 1 }
    useUsageStore.getState().setUsage(summary)
    expect(useUsageStore.getState().usage).toEqual(summary)
  })

  it('setPanel replaces the panel payload', () => {
    const panel = {
      planLimits: null,
      weekly: { ...emptySummary(), costUsd: 4.2 },
      sessions: []
    }
    useUsageStore.getState().setPanel(panel)
    expect(useUsageStore.getState().panel).toEqual(panel)
  })
})
