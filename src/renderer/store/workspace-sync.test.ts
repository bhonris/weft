import { describe, it, expect, vi } from 'vitest'
import { buildWorkspaceState, restoreWorkspace } from './workspace-sync'
import type { Tab } from './session-store'
import type { LiveSession, WorkspaceState } from '@shared/ipc/api-contract'

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

describe('restoreWorkspace (reload reconciliation, spec §4.7)', () => {
  const saved: WorkspaceState = buildWorkspaceState([tab('a'), tab('b', { command: 'shell' })])

  const api = (live: LiveSession[], createImpl?: () => Promise<{ tabId: string }>) => {
    let n = 0
    return {
      listSessions: vi.fn(async () => live),
      createSession: vi.fn(createImpl ?? (async () => ({ tabId: `new-${++n}` })))
    }
  }

  it('re-attaches saved tabs whose sessions are still alive — NO respawn', async () => {
    const a = api([
      { tabId: 'a', cwd: 'C:/p/a', command: 'claude', exited: false },
      { tabId: 'b', cwd: 'C:/p/b', command: 'shell', exited: false }
    ])
    const restored = await restoreWorkspace(a, saved)

    expect(a.createSession).not.toHaveBeenCalled()
    expect(restored).toEqual([
      { tabId: 'a', title: 'proj-a', cwd: 'C:/p/a', command: 'claude' },
      { tabId: 'b', title: 'proj-b', cwd: 'C:/p/b', command: 'shell' }
    ])
  })

  it('spawns fresh sessions on a true restart (nothing live)', async () => {
    const a = api([])
    const restored = await restoreWorkspace(a, saved)
    expect(a.createSession).toHaveBeenNthCalledWith(1, { cwd: 'C:/p/a', command: 'claude' })
    expect(a.createSession).toHaveBeenNthCalledWith(2, { cwd: 'C:/p/b', command: 'shell' })
    expect(restored.map((r) => r.tabId)).toEqual(['new-1', 'new-2'])
  })

  it('mixes: re-attaches the live tab, respawns the dead one', async () => {
    const a = api([{ tabId: 'a', cwd: 'C:/p/a', command: 'claude', exited: false }])
    const restored = await restoreWorkspace(a, saved)
    expect(a.createSession).toHaveBeenCalledTimes(1)
    expect(restored[0]).toMatchObject({ tabId: 'a' }) // reused
    expect(restored[1]).toMatchObject({ tabId: 'new-1' }) // respawned
  })

  it('does not re-attach an exited live session — respawns instead', async () => {
    const a = api([{ tabId: 'a', cwd: 'C:/p/a', command: 'claude', exited: true }])
    const restored = await restoreWorkspace(a, saved)
    expect(a.createSession).toHaveBeenCalledTimes(2)
    expect(restored.map((r) => r.tabId)).toEqual(['new-1', 'new-2'])
  })

  it('adopts live sessions that no saved tab claims (created just before reload)', async () => {
    const a = api([
      { tabId: 'a', cwd: 'C:/p/a', command: 'claude', exited: false },
      { tabId: 'orphan', cwd: 'C:/work/fresh-project', command: 'shell', exited: false }
    ])
    const restored = await restoreWorkspace(a, buildWorkspaceState([tab('a')]))
    expect(restored).toEqual([
      { tabId: 'a', title: 'proj-a', cwd: 'C:/p/a', command: 'claude' },
      { tabId: 'orphan', title: 'fresh-project', cwd: 'C:/work/fresh-project', command: 'shell' }
    ])
  })

  it('skips tabs whose session fails to spawn instead of failing the restore', async () => {
    const createSession = vi
      .fn<() => Promise<{ tabId: string }>>()
      .mockRejectedValueOnce(new Error('cwd gone'))
      .mockResolvedValueOnce({ tabId: 'ok' })
    const restored = await restoreWorkspace(
      { listSessions: async () => [], createSession },
      saved
    )
    expect(restored).toEqual([{ tabId: 'ok', title: 'proj-b', cwd: 'C:/p/b', command: 'shell' }])
  })

  it('falls back to spawn-per-tab when listSessions is unavailable', async () => {
    let n = 0
    const restored = await restoreWorkspace(
      {
        listSessions: async () => {
          throw new Error('no such handler')
        },
        createSession: async () => ({ tabId: `new-${++n}` })
      },
      saved
    )
    expect(restored).toHaveLength(2)
  })

  it('returns empty for an empty workspace with nothing live', async () => {
    const a = api([])
    expect(await restoreWorkspace(a, buildWorkspaceState([]))).toEqual([])
  })
})
