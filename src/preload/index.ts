import { contextBridge } from 'electron'

/**
 * The typed preload bridge. Phase 2 exposes a minimal, versioned handshake;
 * the full `WeftApi` surface (sessions, fs, persistence) is wired in Phase 1/2
 * of development against `@shared/ipc/channels` and `@shared/ipc/api-contract`.
 */
const bridge = {
  version: '0.0.0'
}

contextBridge.exposeInMainWorld('weft', bridge)
