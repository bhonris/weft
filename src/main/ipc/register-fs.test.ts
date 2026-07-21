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

const makeDeps = () => ({
  diffService: {
    readFileText: async () => 'x',
    getDiff: async () => ({ original: '', modified: '' }),
    saveFileText: vi.fn(async () => {})
  } as never,
  watchService: { watch: () => ({ watchId: 'w' }), unwatch: async () => {} } as never,
  gitService: { currentBranch: async () => null } as never,
  getWritableRoots: () => ['C:/proj']
})

describe('registerFsIpc', () => {
  it('listDir returns the service result', async () => {
    const ipcMain = new FakeIpcMain()
    registerFsIpc({ ipcMain, fsService, reveal: () => {}, open: () => {}, ...makeDeps() })
    const out = await ipcMain.invoke(CH.listDir, '/proj')
    expect(out).toEqual([{ name: 'src', path: join('/proj', 'src'), kind: 'dir' }])
  })

  it('listFilesDeep returns the walk, confined to open project roots', async () => {
    const ipcMain = new FakeIpcMain()
    // A fs that terminates (files only) so the recursive walk doesn't loop.
    const deepFs = new FsService({
      readdir: async () => [
        { name: 'a.ts', isDirectory: () => false, isSymbolicLink: () => false }
      ]
    })
    registerFsIpc({
      ipcMain,
      fsService: deepFs,
      reveal: () => {},
      open: () => {},
      ...makeDeps()
    })

    const out = await ipcMain.invoke(CH.listFilesDeep, 'C:/proj')
    expect(out).toEqual([{ name: 'a.ts', path: join('C:/proj', 'a.ts'), rel: 'a.ts' }])

    // Outside every open root, or a non-string arg → rejected.
    await expect(ipcMain.invoke(CH.listFilesDeep, 'C:/somewhere-else')).rejects.toThrow(
      /outside an open project/
    )
    await expect(ipcMain.invoke(CH.listFilesDeep, 123 as never)).rejects.toThrow(
      /invalid listFilesDeep/
    )
  })

  it('reveal and open delegate to the injected handlers', async () => {
    const ipcMain = new FakeIpcMain()
    const reveal = vi.fn()
    const open = vi.fn()
    registerFsIpc({ ipcMain, fsService, reveal, open, ...makeDeps() })

    await ipcMain.invoke(CH.revealInOs, 'C:/a/b.txt')
    await ipcMain.invoke(CH.openWithDefault, 'C:/a/b.txt')

    expect(reveal).toHaveBeenCalledWith('C:/a/b.txt')
    expect(open).toHaveBeenCalledWith('C:/a/b.txt')
  })

  it('saveFile writes inside an open root and refuses everything else', async () => {
    const ipcMain = new FakeIpcMain()
    const deps = makeDeps()
    registerFsIpc({ ipcMain, fsService, reveal: () => {}, open: () => {}, ...deps })

    await ipcMain.invoke(CH.saveFile, 'C:/proj/notes.txt', 'hello')
    expect(
      (deps.diffService as { saveFileText: ReturnType<typeof vi.fn> }).saveFileText
    ).toHaveBeenCalledWith('C:/proj/notes.txt', 'hello')

    await expect(
      ipcMain.invoke(CH.saveFile, 'C:/windows/system32/evil.txt', 'x')
    ).rejects.toThrow(/outside an open project/)
    await expect(ipcMain.invoke(CH.saveFile, 'C:/proj-evil/a.txt', 'x')).rejects.toThrow(
      /outside/
    )
    await expect(ipcMain.invoke(CH.saveFile, 'C:/proj/a.txt', 123 as never)).rejects.toThrow(
      /invalid saveFile/
    )
  })
})
