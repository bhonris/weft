import { describe, it, expect, vi } from 'vitest'
import { join } from 'node:path'
import { registerFsIpc } from './register-fs'
import { FsService } from '../services/fs-service'
import type { IpcMainLike, IpcEventLike } from './register'
import { CH } from '@shared/ipc/channels'

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

const fsService = new FsService({
  readdir: async () => [
    { name: 'src', isDirectory: () => true, isSymbolicLink: () => false }
  ]
})

describe('registerFsIpc', () => {
  it('listDir returns the service result', async () => {
    const ipcMain = new FakeIpcMain()
    registerFsIpc({ ipcMain, fsService, reveal: () => {}, open: () => {} })
    const out = await ipcMain.invoke(CH.listDir, '/proj')
    expect(out).toEqual([{ name: 'src', path: join('/proj', 'src'), kind: 'dir' }])
  })

  it('reveal and open delegate to the injected handlers', async () => {
    const ipcMain = new FakeIpcMain()
    const reveal = vi.fn()
    const open = vi.fn()
    registerFsIpc({ ipcMain, fsService, reveal, open })

    await ipcMain.invoke(CH.revealInOs, 'C:/a/b.txt')
    await ipcMain.invoke(CH.openWithDefault, 'C:/a/b.txt')

    expect(reveal).toHaveBeenCalledWith('C:/a/b.txt')
    expect(open).toHaveBeenCalledWith('C:/a/b.txt')
  })
})
