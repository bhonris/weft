import { describe, it, expect } from 'vitest'
import { registerWorkspaceIpc } from './register-workspace'
import { WorkspaceStore, type KeyValueStore } from '../services/workspace-store'
import type { IpcMainLike, IpcEventLike } from './register'
import { CH } from '@shared/ipc/channels'
import { defaultWorkspace } from '@core/persistence/default-workspace'

class FakeIpcMain implements IpcMainLike {
  handlers = new Map<string, (e: IpcEventLike, ...a: unknown[]) => unknown>()
  handle(channel: string, listener: (e: IpcEventLike, ...a: unknown[]) => unknown): void {
    this.handlers.set(channel, listener)
  }
  on(): void {}
  invoke(channel: string, ...args: unknown[]): unknown {
    return this.handlers.get(channel)!({ sender: { id: 1, send: () => {} } }, ...args)
  }
}

class FakeKv implements KeyValueStore {
  data = new Map<string, unknown>()
  get(key: string): unknown {
    return this.data.get(key)
  }
  set(key: string, value: unknown): void {
    this.data.set(key, value)
  }
}

describe('registerWorkspaceIpc', () => {
  it('load returns defaults on first run and save round-trips', async () => {
    const ipcMain = new FakeIpcMain()
    registerWorkspaceIpc({ ipcMain, store: new WorkspaceStore({ store: new FakeKv() }) })

    const first = await ipcMain.invoke(CH.loadWorkspace)
    expect(first).toEqual(defaultWorkspace())

    const state = { ...defaultWorkspace(), explorerRoots: ['C:/x'] }
    await ipcMain.invoke(CH.saveWorkspace, state)
    expect(await ipcMain.invoke(CH.loadWorkspace)).toEqual(state)
  })
})
