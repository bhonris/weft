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
    // E2E/automation seams: WEFT_E2E_OPEN_DIR bypasses the native folder picker
    // (which no automation can drive), and WEFT_OPEN_PROJECT_COMMAND=shell lets
    // tests open a plain shell instead of booting a real `claude`.
    defaultCommand: process.env['WEFT_OPEN_PROJECT_COMMAND'] === 'shell' ? 'shell' : 'claude',
    pickDirectory: async () => {
      const forced = process.env['WEFT_E2E_OPEN_DIR']
      if (forced) return forced
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
