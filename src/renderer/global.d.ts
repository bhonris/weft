import type { WeftBridge } from '@shared/ipc/api-contract'

declare global {
  interface Window {
    api: WeftBridge
  }
}

export {}
