import { describe, it, expect, vi } from 'vitest'
import { createWeftApi, type IpcRendererLike } from './create-bridge'
import { CH } from '@shared/ipc/channels'

function fakeIpc() {
  const invoke = vi.fn(async () => undefined as unknown)
  const send = vi.fn()
  const listeners = new Map<string, (e: unknown, p: unknown) => void>()
  const ipc: IpcRendererLike = {
    invoke,
    send,
    on: (channel, listener) => listeners.set(channel, listener),
    removeListener: (channel, listener) => {
      if (listeners.get(channel) === listener) listeners.delete(channel)
    }
  }
  return { ipc, invoke, send, listeners }
}

describe('createWeftApi', () => {
  it('routes invoke-style calls to the right channels', async () => {
    const { ipc, invoke } = fakeIpc()
    const api = createWeftApi(ipc)

    await api.createSession({ cwd: 'C:/p', command: 'claude' })
    await api.closeSession('t1')
    await api.attachSession('t1')
    await api.detachSession('t1')
    await api.openProject()

    expect(invoke).toHaveBeenCalledWith(CH.createSession, { cwd: 'C:/p', command: 'claude' })
    expect(invoke).toHaveBeenCalledWith(CH.closeSession, 't1')
    expect(invoke).toHaveBeenCalledWith(CH.attachSession, 't1')
    expect(invoke).toHaveBeenCalledWith(CH.detachSession, 't1')
    expect(invoke).toHaveBeenCalledWith(CH.openProject, undefined)
  })

  it('routes fire-and-forget calls via send', () => {
    const { ipc, send } = fakeIpc()
    const api = createWeftApi(ipc)
    api.writeToSession('t1', 'ls\n')
    api.resizeSession('t1', 80, 24)
    expect(send).toHaveBeenCalledWith(CH.writeToSession, 't1', 'ls\n')
    expect(send).toHaveBeenCalledWith(CH.resizeSession, 't1', 80, 24)
  })

  it('onSessionData delivers payloads and unsubscribes cleanly', () => {
    const { ipc, listeners } = fakeIpc()
    const api = createWeftApi(ipc)
    const received: unknown[] = []
    const off = api.onSessionData((e) => received.push(e))

    listeners.get(CH.sessionData)!(null, { tabId: 't1', data: 'x' })
    expect(received).toEqual([{ tabId: 't1', data: 'x' }])

    off()
    expect(listeners.has(CH.sessionData)).toBe(false)
  })

  it('subscribes exit and status channels too', () => {
    const { ipc, listeners } = fakeIpc()
    const api = createWeftApi(ipc)
    api.onSessionExit(() => {})
    api.onSessionStatus(() => {})
    expect(listeners.has(CH.sessionExit)).toBe(true)
    expect(listeners.has(CH.sessionStatus)).toBe(true)
  })

  it('routes every remaining bridge method to its channel', async () => {
    const { ipc, invoke, listeners } = fakeIpc()
    const api = createWeftApi(ipc)

    await api.listDir('/p')
    await api.listFilesDeep('/p')
    await api.watchDir('/p')
    await api.unwatchDir('w1')
    await api.revealInOs('/p/a')
    await api.openWithDefault('/p/a')
    await api.readFileText('/p/a')
    await api.getDiff('/p/a')
    await api.loadWorkspace()
    await api.saveWorkspace({
      version: 1,
      tabs: [],
      tabOrder: [],
      explorerRoots: [],
      theme: 'system'
    })
    await api.moveTabToWindow('t1', 'new', { title: 'x' })
    await api.getUsage()
    await api.getUsagePanel()

    expect(invoke).toHaveBeenCalledWith(CH.listDir, '/p')
    expect(invoke).toHaveBeenCalledWith(CH.listFilesDeep, '/p')
    expect(invoke).toHaveBeenCalledWith(CH.getUsage)
    expect(invoke).toHaveBeenCalledWith(CH.getUsagePanel)
    expect(invoke).toHaveBeenCalledWith(CH.watchDir, '/p')
    expect(invoke).toHaveBeenCalledWith(CH.unwatchDir, 'w1')
    expect(invoke).toHaveBeenCalledWith(CH.revealInOs, '/p/a')
    expect(invoke).toHaveBeenCalledWith(CH.openWithDefault, '/p/a')
    expect(invoke).toHaveBeenCalledWith(CH.readFileText, '/p/a')
    expect(invoke).toHaveBeenCalledWith(CH.getDiff, '/p/a')
    expect(invoke).toHaveBeenCalledWith(CH.loadWorkspace)
    expect(invoke).toHaveBeenCalledWith(CH.saveWorkspace, expect.objectContaining({ version: 1 }))
    expect(invoke).toHaveBeenCalledWith(CH.moveTabToWindow, 't1', 'new', { title: 'x' })

    api.onFsChange(() => {})
    api.onActivateTab(() => {})
    api.onReDockTab(() => {})
    expect(listeners.has(CH.fsChange)).toBe(true)
    expect(listeners.has(CH.activateTab)).toBe(true)
    expect(listeners.has(CH.reDockTab)).toBe(true)
  })
})
