import { describe, it, expect, vi } from 'vitest'
import { NotificationService, type ToastRequest } from './notification-service'

function setup(focused: boolean) {
  const toasts: ToastRequest[] = []
  const focusTab = vi.fn()
  const svc = new NotificationService({
    isAppFocused: () => focused,
    showToast: (t) => toasts.push(t),
    focusTab,
    getTitle: (id) => (id === 't1' ? 'my-proj' : undefined)
  })
  return { svc, toasts, focusTab }
}

describe('NotificationService', () => {
  it('raises a "needs you" toast for waiting while unfocused', () => {
    const { svc, toasts } = setup(false)
    svc.handleStatus({ tabId: 't1', status: 'waiting', message: 'Allow edit?' })
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({
      title: 'my-proj — needs you',
      body: 'Allow edit?',
      tabId: 't1'
    })
  })

  it('uses a default body when the notification has no message', () => {
    const { svc, toasts } = setup(false)
    svc.handleStatus({ tabId: 't1', status: 'waiting' })
    expect(toasts[0]!.body).toBe('Claude is waiting on your input')
  })

  it('raises a "done" toast when a session finishes unfocused', () => {
    const { svc, toasts } = setup(false)
    svc.handleStatus({ tabId: 't1', status: 'done' })
    expect(toasts[0]!.title).toBe('my-proj — done')
  })

  it('stays silent while the app is focused', () => {
    const { svc, toasts } = setup(true)
    svc.handleStatus({ tabId: 't1', status: 'waiting' })
    expect(toasts).toHaveLength(0)
  })

  it('ignores working/error/unknown transitions', () => {
    const { svc, toasts } = setup(false)
    svc.handleStatus({ tabId: 't1', status: 'working' })
    svc.handleStatus({ tabId: 't1', status: 'error' })
    svc.handleStatus({ tabId: 't1', status: 'unknown' })
    expect(toasts).toHaveLength(0)
  })

  it('clicking the toast focuses the tab', () => {
    const { svc, toasts, focusTab } = setup(false)
    svc.handleStatus({ tabId: 't1', status: 'waiting' })
    toasts[0]!.onClick()
    expect(focusTab).toHaveBeenCalledWith('t1')
  })

  it('falls back to a generic title for unknown tabs', () => {
    const { svc, toasts } = setup(false)
    svc.handleStatus({ tabId: 'ghost', status: 'done' })
    expect(toasts[0]!.title).toBe('Weft session — done')
  })
})
