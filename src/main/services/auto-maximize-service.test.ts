import { describe, it, expect, vi } from 'vitest'
import { AutoMaximizeService } from './auto-maximize-service'

function setup(focused: boolean, opts: { enabled?: boolean } = {}) {
  const restoreAndMaximize = vi.fn()
  let enabled = opts.enabled ?? true
  const svc = new AutoMaximizeService({
    isEnabled: () => enabled,
    isAppFocused: () => focused,
    restoreAndMaximize
  })
  return { svc, restoreAndMaximize, setEnabled: (v: boolean) => (enabled = v) }
}

describe('AutoMaximizeService', () => {
  it('restores and maximizes on waiting while unfocused', () => {
    const { svc, restoreAndMaximize } = setup(false)
    svc.handleStatus({ tabId: 't1', status: 'waiting' })
    expect(restoreAndMaximize).toHaveBeenCalledTimes(1)
  })

  it('restores and maximizes on done while unfocused', () => {
    const { svc, restoreAndMaximize } = setup(false)
    svc.handleStatus({ tabId: 't1', status: 'done' })
    expect(restoreAndMaximize).toHaveBeenCalledTimes(1)
  })

  it('stays silent while the app is focused', () => {
    const { svc, restoreAndMaximize } = setup(true)
    svc.handleStatus({ tabId: 't1', status: 'waiting' })
    expect(restoreAndMaximize).not.toHaveBeenCalled()
  })

  it('suppresses every trigger while disabled', () => {
    const { svc, restoreAndMaximize } = setup(false, { enabled: false })
    svc.handleStatus({ tabId: 't1', status: 'waiting' })
    svc.handleStatus({ tabId: 't1', status: 'done' })
    expect(restoreAndMaximize).not.toHaveBeenCalled()
  })

  it('ignores working/error/unknown transitions', () => {
    const { svc, restoreAndMaximize } = setup(false)
    svc.handleStatus({ tabId: 't1', status: 'working' })
    svc.handleStatus({ tabId: 't1', status: 'error' })
    svc.handleStatus({ tabId: 't1', status: 'unknown' })
    expect(restoreAndMaximize).not.toHaveBeenCalled()
  })

  it('re-enabling takes effect on the next event without a restart', () => {
    const { svc, restoreAndMaximize, setEnabled } = setup(false, { enabled: false })
    svc.handleStatus({ tabId: 't1', status: 'waiting' })
    expect(restoreAndMaximize).not.toHaveBeenCalled()
    setEnabled(true)
    svc.handleStatus({ tabId: 't1', status: 'waiting' })
    expect(restoreAndMaximize).toHaveBeenCalledTimes(1)
  })
})
