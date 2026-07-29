import { describe, it, expect, vi } from 'vitest'
import { registerScmIpc } from './register-scm'
import type { IpcMainLike, IpcEventLike } from './register'
import type { GitService } from '../services/git-service'
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

const fakeGit = () => ({
  status: vi.fn(async () => ({ isRepo: true, changes: [] })),
  stage: vi.fn(async () => {}),
  unstage: vi.fn(async () => {}),
  discard: vi.fn(async () => {}),
  commit: vi.fn(async () => {}),
  push: vi.fn(async () => {}),
  pull: vi.fn(async () => {})
})

const wire = (git = fakeGit(), roots = ['C:/proj']) => {
  const ipcMain = new FakeIpcMain()
  registerScmIpc({ ipcMain, gitService: git as unknown as GitService, getWritableRoots: () => roots })
  return { ipcMain, git }
}

describe('registerScmIpc — status (read-only)', () => {
  it('delegates status for a string cwd', async () => {
    const { ipcMain, git } = wire()
    await ipcMain.invoke(CH.getGitStatus, 'C:/anywhere')
    expect(git.status).toHaveBeenCalledWith('C:/anywhere')
  })

  it('passes null through for a non-string cwd', async () => {
    const { ipcMain, git } = wire()
    await ipcMain.invoke(CH.getGitStatus, undefined)
    expect(git.status).toHaveBeenCalledWith(null)
  })
})

describe('registerScmIpc — mutations confine to open roots', () => {
  it('stages files inside a project root', async () => {
    const { ipcMain, git } = wire()
    await ipcMain.invoke(CH.stageFiles, 'C:/proj', ['C:/proj/a.ts'])
    expect(git.stage).toHaveBeenCalledWith('C:/proj', ['C:/proj/a.ts'])
  })

  it('rejects a cwd outside every open root', async () => {
    const { ipcMain, git } = wire()
    await expect(ipcMain.invoke(CH.stageFiles, 'C:/evil', ['C:/evil/a.ts'])).rejects.toThrow(
      /outside an open project/
    )
    expect(git.stage).not.toHaveBeenCalled()
  })

  it('rejects a path outside the cwd', async () => {
    const { ipcMain, git } = wire()
    await expect(ipcMain.invoke(CH.stageFiles, 'C:/proj', ['C:/other/a.ts'])).rejects.toThrow(
      /outside the project/
    )
    expect(git.stage).not.toHaveBeenCalled()
  })

  it('rejects a non-array path list', async () => {
    const { ipcMain } = wire()
    await expect(ipcMain.invoke(CH.stageFiles, 'C:/proj', 'nope')).rejects.toThrow(/path list/)
  })

  it('unstages inside a root', async () => {
    const { ipcMain, git } = wire()
    await ipcMain.invoke(CH.unstageFiles, 'C:/proj', ['C:/proj/a.ts'])
    expect(git.unstage).toHaveBeenCalledWith('C:/proj', ['C:/proj/a.ts'])
  })

  it('discards with the untracked flag coerced to a boolean', async () => {
    const { ipcMain, git } = wire()
    await ipcMain.invoke(CH.discardChanges, 'C:/proj', ['C:/proj/a.ts'], true)
    expect(git.discard).toHaveBeenCalledWith('C:/proj', ['C:/proj/a.ts'], true)
    await ipcMain.invoke(CH.discardChanges, 'C:/proj', ['C:/proj/a.ts'], undefined)
    expect(git.discard).toHaveBeenLastCalledWith('C:/proj', ['C:/proj/a.ts'], false)
  })

  it('commits with a non-empty message', async () => {
    const { ipcMain, git } = wire()
    await ipcMain.invoke(CH.gitCommit, 'C:/proj', 'feat: x')
    expect(git.commit).toHaveBeenCalledWith('C:/proj', 'feat: x')
  })

  it('rejects an empty / whitespace commit message', async () => {
    const { ipcMain, git } = wire()
    await expect(ipcMain.invoke(CH.gitCommit, 'C:/proj', '   ')).rejects.toThrow(/message is required/)
    expect(git.commit).not.toHaveBeenCalled()
  })

  it('pushes and pulls inside a root', async () => {
    const { ipcMain, git } = wire()
    await ipcMain.invoke(CH.gitPush, 'C:/proj')
    await ipcMain.invoke(CH.gitPull, 'C:/proj')
    expect(git.push).toHaveBeenCalledWith('C:/proj')
    expect(git.pull).toHaveBeenCalledWith('C:/proj')
  })

  it('rejects push outside a root', async () => {
    const { ipcMain, git } = wire()
    await expect(ipcMain.invoke(CH.gitPush, 'C:/evil')).rejects.toThrow(/outside an open project/)
    expect(git.push).not.toHaveBeenCalled()
  })
})
