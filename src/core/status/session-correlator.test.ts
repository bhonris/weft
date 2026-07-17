import { describe, it, expect } from 'vitest'
import { correlate, type TabRef } from './session-correlator'
import type { HookPayload } from '@shared/status/hook-events'

const tabs: TabRef[] = [
  { tabId: 't1', sessionId: 's1', cwd: 'C:/a' },
  { tabId: 't2', sessionId: 's2', cwd: 'C:/b' },
  { tabId: 't3', sessionId: 's3', cwd: 'C:/b' } // shares cwd with t2
]

const ev = (p: Partial<HookPayload>): HookPayload => ({ event: 'Stop', ...p })

describe('correlate', () => {
  it('resolves by session_id first', () => {
    expect(correlate(ev({ session_id: 's2', tabId: 't1', cwd: 'C:/a' }), tabs)).toBe('t2')
  })

  it('falls back to tabId when session_id is absent', () => {
    expect(correlate(ev({ tabId: 't3' }), tabs)).toBe('t3')
  })

  it('falls back to tabId when session_id does not match any tab', () => {
    expect(correlate(ev({ session_id: 'ghost', tabId: 't1' }), tabs)).toBe('t1')
  })

  it('falls back to cwd only when it is unambiguous', () => {
    expect(correlate(ev({ cwd: 'C:/a' }), tabs)).toBe('t1')
  })

  it('does not resolve by cwd when multiple tabs share it', () => {
    expect(correlate(ev({ cwd: 'C:/b' }), tabs)).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(correlate(ev({ session_id: 'ghost', tabId: 'ghost', cwd: 'C:/z' }), tabs)).toBeNull()
  })

  it('returns null for a payload with no identifiers', () => {
    expect(correlate(ev({}), tabs)).toBeNull()
  })

  it('matches cwd across separator, trailing-slash, and case differences', () => {
    const winTabs = [{ tabId: 'w1', sessionId: 'ws1', cwd: 'C:\\Users\\me\\Proj' }]
    expect(correlate(ev({ cwd: 'c:/users/me/proj' }), winTabs)).toBe('w1')
    expect(correlate(ev({ cwd: 'C:\\Users\\me\\Proj\\' }), winTabs)).toBe('w1')
    expect(correlate(ev({ cwd: 'C:/Users/me/Proj/' }), winTabs)).toBe('w1')
    expect(correlate(ev({ cwd: 'C:/Users/me/Other' }), winTabs)).toBeNull()
  })
})
