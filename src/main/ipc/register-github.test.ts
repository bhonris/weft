import { describe, it, expect, vi } from 'vitest'
import { registerGithubIpc } from './register-github'
import type { IpcMainLike, IpcEventLike } from './register'
import { CH } from '@shared/ipc/channels'
import type { IssuesPanelData } from '@shared/ipc/api-contract'

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

const panel: IssuesPanelData = {
  repo: { owner: 'octo', repo: 'hello' },
  issues: [],
  authSource: 'gh',
  fetchedAt: '2026-07-20T12:00:00Z',
  stale: false,
  error: null
}

const wire = (over: Partial<Parameters<typeof registerGithubIpc>[0]> = {}) => {
  const ipcMain = new FakeIpcMain()
  const deps = {
    ipcMain,
    githubService: { panel: vi.fn(async () => panel) },
    authService: { beginDeviceFlow: vi.fn(async () => ({ error: 'x' })), signOut: vi.fn() },
    openExternal: vi.fn(),
    ...over
  }
  registerGithubIpc(deps)
  return { ipcMain, deps }
}

describe('registerGithubIpc', () => {
  it('fetches issues for the given cwd on github:get', async () => {
    const { ipcMain, deps } = wire()
    const out = await ipcMain.invoke(CH.getIssues, 'C:/repo')
    expect(deps.githubService.panel).toHaveBeenCalledWith('C:/repo')
    expect(out).toBe(panel)
  })

  it('passes null through when cwd is undefined', async () => {
    const { ipcMain, deps } = wire()
    await ipcMain.invoke(CH.getIssues, undefined)
    expect(deps.githubService.panel).toHaveBeenCalledWith(null)
  })

  it('starts the device flow on github:sign-in', async () => {
    const beginDeviceFlow = vi.fn(async () => ({
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device',
      expiresInSec: 900
    }))
    const { ipcMain } = wire({ authService: { beginDeviceFlow, signOut: vi.fn() } })
    const out = await ipcMain.invoke(CH.githubSignIn)
    expect(out).toMatchObject({ userCode: 'ABCD-1234' })
    expect(beginDeviceFlow).toHaveBeenCalled()
  })

  it('signs out on github:sign-out', async () => {
    const signOut = vi.fn()
    const { ipcMain } = wire({ authService: { beginDeviceFlow: vi.fn(), signOut } })
    await ipcMain.invoke(CH.githubSignOut)
    expect(signOut).toHaveBeenCalled()
  })

  it('opens a safe http(s) URL', async () => {
    const openExternal = vi.fn()
    const { ipcMain } = wire({ openExternal })
    await ipcMain.invoke(CH.openExternal, 'https://github.com/octo/hello/issues/1')
    expect(openExternal).toHaveBeenCalledWith('https://github.com/octo/hello/issues/1')
  })

  it('refuses a non-http(s) URL', async () => {
    const openExternal = vi.fn()
    const { ipcMain } = wire({ openExternal })
    await expect(ipcMain.invoke(CH.openExternal, 'file:///etc/passwd')).rejects.toThrow(/refusing/)
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('refuses a non-string URL', async () => {
    const openExternal = vi.fn()
    const { ipcMain } = wire({ openExternal })
    await expect(ipcMain.invoke(CH.openExternal, 123)).rejects.toThrow(/refusing/)
    expect(openExternal).not.toHaveBeenCalled()
  })
})
