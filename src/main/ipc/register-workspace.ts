import { CH } from '@shared/ipc/channels'
import type { WorkspaceState } from '@shared/ipc/api-contract'
import type { IpcMainLike } from './register'
import type { WorkspaceStore } from '../services/workspace-store'

export interface WorkspaceRegisterDeps {
  ipcMain: IpcMainLike
  store: WorkspaceStore
}

/** Wire workspace load/save. All shape/migration logic lives in the store/core. */
export function registerWorkspaceIpc(deps: WorkspaceRegisterDeps): void {
  deps.ipcMain.handle(CH.loadWorkspace, () => deps.store.load())
  deps.ipcMain.handle(CH.saveWorkspace, (_event, state) => {
    deps.store.save(state as WorkspaceState)
  })
}
