import { CH } from '@shared/ipc/channels'
import type { IpcMainLike } from './register'
import type { FsService } from '../services/fs-service'
import type { DiffService } from '../services/diff-service'
import type { WatchService } from '../services/watch-service'
import type { GitService } from '../services/git-service'
import { isInsideAnyRoot } from '@core/fs/path-guard'

export interface FsRegisterDeps {
  ipcMain: IpcMainLike
  fsService: FsService
  diffService: DiffService
  watchService: WatchService
  gitService: GitService
  /** Open project roots — the only directories the renderer may write into. */
  getWritableRoots: () => string[]
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

  ipcMain.handle(CH.getGitBranch, (_event, cwd) =>
    typeof cwd === 'string' ? deps.gitService.currentBranch(cwd) : null
  )

  ipcMain.handle(CH.saveFile, async (_event, path, content) => {
    if (typeof path !== 'string' || typeof content !== 'string') {
      throw new Error('invalid saveFile arguments')
    }
    // The renderer is semi-trusted: writes are confined to open project roots.
    if (!isInsideAnyRoot(deps.getWritableRoots(), path)) {
      throw new Error('refusing to write outside an open project')
    }
    await deps.diffService.saveFileText(path, content)
  })

  ipcMain.handle(CH.watchDir, (event, path) => {
    const sender = event.sender
    return deps.watchService.watch(path as string, (change) =>
      sender.send(CH.fsChange, change)
    )
  })

  ipcMain.handle(CH.unwatchDir, (_event, watchId) =>
    deps.watchService.unwatch(watchId as string)
  )
}
