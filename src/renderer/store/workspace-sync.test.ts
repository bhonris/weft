import { describe, it, expect, vi } from 'vitest'
import { buildWorkspaceState, restoreWorkspace } from './workspace-sync'
import type { Tab } from './session-store'
import type { WorkspaceState } from '@shared/ipc/api-contract'

const tab = (id: string, over: Partial<Tab> = {}): Tab => ({
  tabId: id,
  title: `proj-${id}`,
  cwd: `C:/p/${id}`,
  command: 'claude',
  status: 'working',
  ...over
})

describe('buildWorkspaceState', () => {
  it('serializes tabs, order, and defaults at the current version', () => {
    const ws = buildWorkspaceState([tab('a'), tab('b', { command: 'shell' })])
    expect(ws.version).toBe(1)
    expect(ws.tabs).toEqual([
      {
        tabId: 'a',
        sessionId: 'a',
        title: 'proj-a',
        cwd: 'C:/p/a',
        command: 'claude',
        windowId: 'main'
      },
      {
        tabId: 'b',
        sessionId: 'b',
        title: 'proj-b',
        cwd: 'C:/p/b',
        command: 'shell',
        windowId: 'main'
      }
    ])
    expect(ws.tabOrder).toEqual(['a', 'b'])
    expect(ws.theme).toBe('system')
  })

  it('persists an explicit theme override', () => {
    expect(buildWorkspaceState([], 'dark').theme).toBe('dark')
    expect(buildWorkspaceState([], 'light').theme).toBe('light')
  })
})

describe('restoreWorkspace', () => {
  const saved: WorkspaceState = buildWorkspaceState([tab('a'), tab('b', { command: 'shell' })])

  it('respawns a fresh session per saved tab, preserving order and titles', async () => {
    let n = 0
    const createSession = vi.fn(async () => ({ tabId: `new-${++n}` }))
    const restored = await restoreWorkspace({ createSession }, saved)

    expect(createSession).toHaveBeenNthCalledWith(1, { cwd: 'C:/p/a', command: 'claude' })
    expect(createSession).toHaveBeenNthCalledWith(2, { cwd: 'C:/p/b', command: 'shell' })
    expect(restored).toEqual([
      { tabId: 'new-1', title: 'proj-a', cwd: 'C:/p/a', command: 'claude' },
      { tabId: 'new-2', title: 'proj-b', cwd: 'C:/p/b', command: 'shell' }
    ])
  })

  it('skips tabs whose session fails to spawn instead of failing the restore', async () => {
    const createSession = vi
      .fn<() => Promise<{ tabId: string }>>()
      .mockRejectedValueOnce(new Error('cwd gone'))
      .mockResolvedValueOnce({ tabId: 'ok' })
    const restored = await restoreWorkspace({ createSession }, saved)
    expect(restored).toEqual([
      { tabId: 'ok', title: 'proj-b', cwd: 'C:/p/b', command: 'shell' }
    ])
  })

  it('returns empty for an empty workspace', async () => {
    const createSession = vi.fn()
    const restored = await restoreWorkspace(
      { createSession },
      buildWorkspaceState([])
    )
    expect(restored).toEqual([])
    expect(createSession).not.toHaveBeenCalled()
  })
})
