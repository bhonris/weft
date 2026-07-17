import { CH } from '@shared/ipc/channels'
import type { IpcMainLike } from './register'
import type { FsService } from '../services/fs-service'
import type { DiffService } from '../services/diff-service'

export interface FsRegisterDeps {
  ipcMain: IpcMainLike
  fsService: FsService
  diffService: DiffService
  /** Reveal a path in the OS file manager (electron shell.showItemInFolder). */
  reveal: (path: string) => void
  /** Open a path with its default OS handler (electron shell.openPath). */
  open: (path: string) => Promise<void> | void
}

/** Wire the filesystem IPC channels used by the explorer. */
export function registerFsIpc(deps: FsRegisterDeps): void {
  const { ipcMain, fsService } = deps

  ipcMain.handle(CH.listDir, (_event, path) => fsService.listDir(path as string))

  ipcMain.handle(CH.revealInOs, (_event, path) => {
    deps.reveal(path as string)
  })

  ipcMain.handle(CH.openWithDefault, async (_event, path) => {
    await deps.open(path as string)
  })

  ipcMain.handle(CH.readFileText, (_event, path) => deps.diffService.readFileText(path as string))

  ipcMain.handle(CH.getDiff, (_event, path) => deps.diffService.getDiff(path as string))
}
