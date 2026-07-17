import { contextBridge, ipcRenderer } from 'electron'
import { createWeftApi, type IpcRendererLike } from './create-bridge'

/**
 * The typed preload bridge. All wiring lives in `createWeftApi` (unit-tested with
 * a fake ipcRenderer); this file is just the electron glue that injects the real
 * ipcRenderer and exposes the API on `window.api` under context isolation.
 */
const api = createWeftApi(ipcRenderer as unknown as IpcRendererLike)

contextBridge.exposeInMainWorld('api', api)
