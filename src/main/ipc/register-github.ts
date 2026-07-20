import { CH } from '@shared/ipc/channels'
import { isSafeExternalUrl } from '@core/net/external-url'
import type { IpcMainLike } from './register'
import type { IssuesPanelData, GithubSignInResult } from '@shared/ipc/api-contract'

/** The service surface these handlers need (kept minimal for testing). */
export interface GithubRegisterDeps {
  ipcMain: IpcMainLike
  githubService: { panel(cwd: string | null): Promise<IssuesPanelData> }
  authService: { beginDeviceFlow(): Promise<GithubSignInResult>; signOut(): void }
  /** Open an http(s) URL in the OS browser (shell.openExternal). */
  openExternal: (url: string) => Promise<void> | void
}

/** Wire the GitHub Issues channels (issues fetch, device-flow sign-in, open-url). */
export function registerGithubIpc(deps: GithubRegisterDeps): void {
  deps.ipcMain.handle(CH.getIssues, (_event, cwd) =>
    deps.githubService.panel((cwd as string | null) ?? null)
  )
  deps.ipcMain.handle(CH.githubSignIn, () => deps.authService.beginDeviceFlow())
  deps.ipcMain.handle(CH.githubSignOut, () => {
    deps.authService.signOut()
  })
  deps.ipcMain.handle(CH.openExternal, async (_event, url) => {
    const target = url as string
    // Only http(s) reaches the OS — never file:/javascript:/custom schemes.
    if (typeof target !== 'string' || !isSafeExternalUrl(target)) {
      throw new Error('refusing to open a non-http(s) URL')
    }
    await deps.openExternal(target)
  })
}
