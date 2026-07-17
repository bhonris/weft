import type { SessionStatus } from '@shared/status/hook-events'

export type Unsubscribe = () => void

export type SessionCommand = 'claude' | 'shell'

export interface DirEntry {
  name: string
  path: string
  kind: 'file' | 'dir' | 'symlink'
}

export interface TabState {
  /** App-side identifier. */
  tabId: string
  /** Pinned via `claude --session-id`. */
  sessionId: string
  title: string
  cwd: string
  command: SessionCommand
  /** Which BrowserWindow currently hosts the tab (tear-off). */
  windowId: string
}

export interface WorkspaceState {
  /** Schema version, for migrations. */
  version: number
  tabs: TabState[]
  /** tabId order in the strip. */
  tabOrder: string[]
  explorerRoots: string[]
  theme: 'system' | 'light' | 'dark'
  windowBounds?: { x: number; y: number; width: number; height: number }
}

export interface CreateSessionOpts {
  cwd: string
  command: SessionCommand
  args?: string[]
}

export interface DiffPayload {
  original: string
  modified: string
}

/** The typed preload bridge exposed as `window.api`. */
export interface WeftApi {
  // Terminal / session
  createSession(opts: CreateSessionOpts): Promise<{ tabId: string }>
  writeToSession(tabId: string, data: string): void
  resizeSession(tabId: string, cols: number, rows: number): void
  closeSession(tabId: string): Promise<void>
  /**
   * Attach this renderer view to a live session. Resolves with the buffered
   * output to replay into a freshly mounted terminal; live output then arrives
   * via `onSessionData`. Safe to call after a reload/HMR — the PTY is never
   * respawned (spec §4.7).
   */
  attachSession(tabId: string): Promise<{ snapshot: string }>
  /** Detach this view; leaves the PTY running (only `closeSession` kills it). */
  detachSession(tabId: string): Promise<void>
  renameTab(tabId: string, title: string): Promise<void>
  reorderTabs(tabOrder: string[]): Promise<void>
  moveTabToWindow(tabId: string, target: 'new' | string): Promise<void>
  onSessionData(cb: (e: { tabId: string; data: string }) => void): Unsubscribe
  onSessionExit(cb: (e: { tabId: string; exitCode: number }) => void): Unsubscribe
  onSessionStatus(
    cb: (e: { tabId: string; status: SessionStatus; message?: string }) => void
  ): Unsubscribe
  /** Fired when main wants a tab activated (e.g. a notification was clicked). */
  onActivateTab(cb: (e: { tabId: string }) => void): Unsubscribe

  // Filesystem
  listDir(path: string): Promise<DirEntry[]>
  watchDir(path: string): Promise<{ watchId: string }>
  onFsChange(
    cb: (e: { watchId: string; type: 'add' | 'change' | 'unlink'; path: string }) => void
  ): Unsubscribe
  revealInOs(path: string): Promise<void>
  openWithDefault(path: string): Promise<void>
  readFileText(path: string): Promise<string>
  getDiff(path: string): Promise<DiffPayload>

  // App actions
  /** Open an OS directory picker; if a folder is chosen, start a claude session there. */
  openProject(): Promise<{ tabId: string; cwd: string; title: string } | null>

  // Persistence
  loadWorkspace(): Promise<WorkspaceState>
  saveWorkspace(state: WorkspaceState): Promise<void>
}

/**
 * The subset of {@link WeftApi} currently implemented by the preload bridge and
 * exposed as `window.api`. Grows toward the full `WeftApi` as features land;
 * being a `Pick` of `WeftApi`, it can never drift from the contract.
 */
export type WeftBridge = Pick<
  WeftApi,
  | 'createSession'
  | 'writeToSession'
  | 'resizeSession'
  | 'closeSession'
  | 'attachSession'
  | 'detachSession'
  | 'onSessionData'
  | 'onSessionExit'
  | 'onSessionStatus'
  | 'onActivateTab'
  | 'openProject'
  | 'listDir'
  | 'revealInOs'
  | 'openWithDefault'
>

