import { CH } from '@shared/ipc/channels'
import type { IpcMainLike } from './register'
import type { GitService } from '../services/git-service'
import { isInsideAnyRoot, isPathInside } from '@core/fs/path-guard'

export interface ScmRegisterDeps {
  ipcMain: IpcMainLike
  gitService: GitService
  /** Open project roots — the only directories the renderer may mutate git in. */
  getWritableRoots: () => string[]
}

/** Coerce an unknown IPC arg to a string[] (rejects anything else). */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error('invalid path list')
  }
  return value as string[]
}

/**
 * Wire the Source Control IPC channels. Reads (`status`) are unguarded like the
 * other read-only fs channels; every MUTATION confines `cwd` to an open project
 * root — and each affected path to that cwd — via {@link isInsideAnyRoot}, the
 * same guard `saveFile` uses, so the semi-trusted renderer can never run git
 * outside an open project.
 */
export function registerScmIpc(deps: ScmRegisterDeps): void {
  const { ipcMain, gitService } = deps

  const guardCwd = (cwd: unknown): string => {
    if (typeof cwd !== 'string' || !isInsideAnyRoot(deps.getWritableRoots(), cwd)) {
      throw new Error('refusing to run git outside an open project')
    }
    return cwd
  }

  const guardPaths = (cwd: string, paths: string[]): void => {
    if (paths.some((p) => !isPathInside(cwd, p))) {
      throw new Error('refusing to touch a path outside the project')
    }
  }

  // Handlers are async so a guard/validation throw surfaces as a rejected IPC
  // promise (the renderer catches it), matching the fs handlers' contract.
  ipcMain.handle(CH.getGitStatus, (_event, cwd) =>
    gitService.status(typeof cwd === 'string' ? cwd : null)
  )

  ipcMain.handle(CH.stageFiles, async (_event, cwd, paths) => {
    const root = guardCwd(cwd)
    const list = asStringArray(paths)
    guardPaths(root, list)
    await gitService.stage(root, list)
  })

  ipcMain.handle(CH.unstageFiles, async (_event, cwd, paths) => {
    const root = guardCwd(cwd)
    const list = asStringArray(paths)
    guardPaths(root, list)
    await gitService.unstage(root, list)
  })

  ipcMain.handle(CH.discardChanges, async (_event, cwd, paths, untracked) => {
    const root = guardCwd(cwd)
    const list = asStringArray(paths)
    guardPaths(root, list)
    await gitService.discard(root, list, untracked === true)
  })

  ipcMain.handle(CH.gitCommit, async (_event, cwd, message) => {
    const root = guardCwd(cwd)
    if (typeof message !== 'string' || message.trim().length === 0) {
      throw new Error('a commit message is required')
    }
    await gitService.commit(root, message)
  })

  ipcMain.handle(CH.gitPush, async (_event, cwd) => {
    await gitService.push(guardCwd(cwd))
  })
  ipcMain.handle(CH.gitPull, async (_event, cwd) => {
    await gitService.pull(guardCwd(cwd))
  })
}
