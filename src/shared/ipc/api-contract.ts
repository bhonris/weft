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

export interface LiveSession {
  tabId: string
  cwd: string
  command: SessionCommand
  exited: boolean
}

export type OpenProjectResult =
  | { tabId: string; cwd: string; title: string; command: SessionCommand }
  | { error: string; cwd: string; title: string; command: SessionCommand }

/** The typed preload bridge exposed as `window.api`. */
export interface WeftApi {
  // Terminal / session
  createSession(opts: CreateSessionOpts): Promise<{ tabId: string }>
  /** Sessions currently alive in main — used to re-attach (not respawn) on reload. */
  listSessions(): Promise<LiveSession[]>
  writeToSession(tabId: string, data: string): void
  resizeSession(tabId: string, cols: number, rows: number): void
  closeSession(tabId: string): Promise<void>
  // (Tab rename/reorder are renderer-store concerns persisted via WorkspaceState —
  // deliberately NOT IPC surface.)
  /**
   * Attach this renderer view to a live session. Resolves with the buffered
   * output to replay into a freshly mounted terminal; live output then arrives
   * via `onSessionData`. Safe to call after a reload/HMR — the PTY is never
   * respawned (spec §4.7).
   */
  attachSession(
    tabId: string
  ): Promise<{ snapshot: string; exited: boolean; exitCode: number | null }>
  /** Detach this view; leaves the PTY running (only `closeSession` kills it). */
  detachSession(tabId: string): Promise<void>
  moveTabToWindow(tabId: string, target: 'new' | string, meta?: { title?: string }): Promise<void>
  /** A torn-off window closed; the surviving session should re-join this strip. */
  onReDockTab(
    cb: (e: { tabId: string; title: string; cwd: string; command: SessionCommand }) => void
  ): Unsubscribe
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
  unwatchDir(watchId: string): Promise<void>
  onFsChange(
    cb: (e: { watchId: string; type: 'add' | 'change' | 'unlink'; path: string }) => void
  ): Unsubscribe
  revealInOs(path: string): Promise<void>
  openWithDefault(path: string): Promise<void>
  readFileText(path: string): Promise<string>
  getDiff(path: string): Promise<DiffPayload>

  // App actions
  /**
   * Open an OS directory picker; if a folder is chosen, start a claude session
   * there. A spawn failure (e.g. `claude` not on PATH) resolves with an
   * `error` result rather than rejecting, so the UI can offer a Retry.
   */
  openProject(command?: SessionCommand): Promise<OpenProjectResult | null>

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
  | 'listSessions'
  | 'writeToSession'
  | 'resizeSession'
  | 'closeSession'
  | 'attachSession'
  | 'detachSession'
  | 'onSessionData'
  | 'onSessionExit'
  | 'onSessionStatus'
  | 'onActivateTab'
  | 'moveTabToWindow'
  | 'onReDockTab'
  | 'openProject'
  | 'listDir'
  | 'watchDir'
  | 'unwatchDir'
  | 'onFsChange'
  | 'revealInOs'
  | 'openWithDefault'
  | 'loadWorkspace'
  | 'saveWorkspace'
  | 'readFileText'
  | 'getDiff'
>

