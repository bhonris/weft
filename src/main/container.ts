import { promises as fsPromises } from 'node:fs'
import { ipcMain, dialog, shell } from 'electron'
import { PtyManager } from './services/pty-manager'
import { NodePtyFactory } from './services/pty-factory'
import { FsService } from './services/fs-service'
import { registerSessionIpc } from './ipc/register'
import { registerFsIpc } from './ipc/register-fs'

/**
 * Composition root: constructs the concrete services and wires IPC. This is the
 * only place Electron singletons meet the app's logic, so it is excluded from
 * the unit-coverage gate and exercised by E2E instead.
 */
export function wireApp(): { pty: PtyManager } {
  const pty = new PtyManager(new NodePtyFactory())

  registerSessionIpc({
    ipcMain,
    pty,
    pickDirectory: async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Open a project in Weft'
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0] ?? null
    }
  })

  registerFsIpc({
    ipcMain,
    fsService: new FsService(fsPromises),
    reveal: (path) => shell.showItemInFolder(path),
    open: async (path) => {
      await shell.openPath(path)
    }
  })

  return { pty }
}
