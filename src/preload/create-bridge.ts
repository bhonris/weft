import { CH } from '@shared/ipc/channels'
import type {
  WeftBridge,
  DirEntry,
  DiffPayload,
  WorkspaceState,
  SessionCommand
} from '@shared/ipc/api-contract'

/** The ipcRenderer surface the bridge needs — satisfied by electron and a fake. */
export interface IpcRendererLike {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  send(channel: string, ...args: unknown[]): void
  on(channel: string, listener: (event: unknown, payload: unknown) => void): void
  removeListener(channel: string, listener: (event: unknown, payload: unknown) => void): void
}

/**
 * Build the `window.api` bridge over an injected ipcRenderer. Kept free of any
 * direct electron import so it is unit-testable with a fake. Every `on*` returns
 * an unsubscribe that removes exactly the listener it added (no leaks on reload).
 */
export function createWeftApi(ipc: IpcRendererLike): WeftBridge {
  function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
    const listener = (_event: unknown, payload: unknown): void => cb(payload as T)
    ipc.on(channel, listener)
    return () => ipc.removeListener(channel, listener)
  }

  return {
    createSession: (opts) =>
      ipc.invoke(CH.createSession, opts) as Promise<{ tabId: string }>,
    writeToSession: (tabId, data) => ipc.send(CH.writeToSession, tabId, data),
    resizeSession: (tabId, cols, rows) => ipc.send(CH.resizeSession, tabId, cols, rows),
    closeSession: (tabId) => ipc.invoke(CH.closeSession, tabId) as Promise<void>,
    attachSession: (tabId) =>
      ipc.invoke(CH.attachSession, tabId) as Promise<{ snapshot: string }>,
    detachSession: (tabId) => ipc.invoke(CH.detachSession, tabId) as Promise<void>,
    onSessionData: (cb) => subscribe(CH.sessionData, cb),
    onSessionExit: (cb) => subscribe(CH.sessionExit, cb),
    onSessionStatus: (cb) => subscribe(CH.sessionStatus, cb),
    onActivateTab: (cb) => subscribe(CH.activateTab, cb),
    openProject: () =>
      ipc.invoke(CH.openProject) as Promise<{
        tabId: string
        cwd: string
        title: string
        command: SessionCommand
      } | null>,
    listDir: (path) => ipc.invoke(CH.listDir, path) as Promise<DirEntry[]>,
    revealInOs: (path) => ipc.invoke(CH.revealInOs, path) as Promise<void>,
    openWithDefault: (path) => ipc.invoke(CH.openWithDefault, path) as Promise<void>,
    loadWorkspace: () => ipc.invoke(CH.loadWorkspace) as Promise<WorkspaceState>,
    saveWorkspace: (state) => ipc.invoke(CH.saveWorkspace, state) as Promise<void>,
    readFileText: (path) => ipc.invoke(CH.readFileText, path) as Promise<string>,
    getDiff: (path) => ipc.invoke(CH.getDiff, path) as Promise<DiffPayload>
  }
}
