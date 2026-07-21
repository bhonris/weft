import type { SessionStatus } from '@shared/status/hook-events'

export type Unsubscribe = () => void

export type SessionCommand = 'claude' | 'shell'

export interface DirEntry {
  name: string
  path: string
  kind: 'file' | 'dir' | 'symlink'
}

/**
 * A file discovered by the recursive project walk behind the quick-open finder.
 * `rel` is the path relative to the walked root, always with `/` separators
 * (so the fuzzy matcher scores segments consistently across platforms); `path`
 * is the absolute OS path used to open the file.
 */
export interface IndexedFile {
  name: string
  path: string
  rel: string
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
  theme: 'system' | 'light' | 'dark' | 'cyberpunk'
  /** v2: restored claude tabs relaunch with `--resume <sessionId>`. */
  resumeEnabled: boolean
  /** v3: raise OS toasts for unfocused waiting/done sessions (default true). */
  notificationsEnabled: boolean
  /** v4: user keybinding overrides, `chord → command id` (default {}). */
  keymapOverrides: Record<string, string>
  /** v5: CLI dock placement for the in-project split. */
  dock: { position: 'bottom' | 'right' | 'left'; size: number }
  /** v6: which sidebar activity-bar panel is showing. */
  activePanel: SidebarPanel
  windowBounds?: { x: number; y: number; width: number; height: number }
}

/** The sidebar panels selectable from the activity bar. */
export type SidebarPanel = 'explorer' | 'usage' | 'issues'

export interface CreateSessionOpts {
  cwd: string
  command: SessionCommand
  args?: string[]
  /** Resume this prior conversation (`claude --resume <id>`); claude only. */
  resumeSessionId?: string
}

export interface DiffPayload {
  original: string
  modified: string
}

export interface LiveSession {
  tabId: string
  sessionId: string
  cwd: string
  command: SessionCommand
  exited: boolean
}

/** Aggregated Claude Code usage across the window's live claude sessions. */
export interface UsageSummary {
  /** Estimated USD cost, summed per model from bundled pricing. */
  costUsd: number
  /** All billed tokens (input + output + cache read + cache write). */
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** Number of claude sessions that had a readable transcript. */
  sessionCount: number
}

/** One plan-usage window (5-hour / weekly / weekly-Opus) from `/api/oauth/usage`. */
export interface PlanWindow {
  /** Percent of the window's limit consumed, 0–100. */
  utilization: number
  /** ISO timestamp the window resets, or null when unknown. */
  resetsAt: string | null
}

/** Claude subscription plan limits — the data behind Claude Code's `/usage`. */
export interface PlanLimits {
  fiveHour: PlanWindow | null
  sevenDay: PlanWindow | null
  sevenDayOpus: PlanWindow | null
  /** ISO time the figures were fetched. */
  fetchedAt: string
  /** True when served from the last-known cache after a fresh fetch failed. */
  stale: boolean
}

/** One row in the Usage panel's recent-sessions list. */
export interface SessionUsage {
  sessionId: string
  /** Project display name (the cwd's final path segment). */
  project: string
  /** Model that used the most tokens in the session. */
  model: string
  costUsd: number
  totalTokens: number
  /** ISO time of the session's most recent assistant turn ('' when unknown). */
  lastActive: string
}

/** Everything the Usage sidebar panel renders. */
export interface UsagePanelData {
  /** Plan-limit meters, or null when unavailable (no token / endpoint down). */
  planLimits: PlanLimits | null
  /** Computed rolling-7-day cost + tokens across all projects. */
  weekly: UsageSummary
  /** Recent sessions across all projects, newest first. */
  sessions: SessionUsage[]
}

/** Which credential source authorized the GitHub request (or none). */
export type GithubAuthSource = 'gh' | 'env' | 'oauth' | 'none'

/** A GitHub issue label — `color` is a hex string without the leading '#'. */
export interface GithubLabel {
  name: string
  color: string
}

/** One row in the GitHub Issues panel (pull requests are excluded upstream). */
export interface GithubIssue {
  number: number
  title: string
  state: 'open' | 'closed'
  /** Issue author login, or '' when unknown. */
  author: string
  labels: GithubLabel[]
  /** Comment count. */
  comments: number
  /** Canonical github.com URL — opened in the default browser on click. */
  htmlUrl: string
  /** ISO time of the last update ('' when unknown). */
  updatedAt: string
}

/** Everything the GitHub Issues sidebar panel renders. */
export interface IssuesPanelData {
  /** The detected `owner/repo`, or null when the cwd isn't a GitHub repo. */
  repo: { owner: string; repo: string } | null
  /** Fetched issues (open + closed); the panel filters these client-side. */
  issues: GithubIssue[]
  /** Which credential source is in use — drives the panel's auth banner. */
  authSource: GithubAuthSource
  /** ISO time the figures were fetched. */
  fetchedAt: string
  /** True when served from cache after a fresh fetch failed. */
  stale: boolean
  /** Human-readable error (rate limit, 404, network), or null. */
  error: string | null
}

/** Result of starting the GitHub device-flow sign-in. */
export type GithubSignInResult =
  | { userCode: string; verificationUri: string; expiresInSec: number }
  | { error: string }

/** A device-flow progress/terminal event pushed from main during sign-in. */
export interface GithubAuthEvent {
  state: 'authorized' | 'pending' | 'error'
  message?: string
}

export type OpenProjectResult =
  | { tabId: string; sessionId: string; cwd: string; title: string; command: SessionCommand }
  | { error: string; cwd: string; title: string; command: SessionCommand }

/** The typed preload bridge exposed as `window.api`. */
export interface WeftApi {
  // Terminal / session
  createSession(opts: CreateSessionOpts): Promise<{ tabId: string; sessionId: string }>
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
  /**
   * Recursively enumerate the files under `root` for the quick-open finder.
   * Prunes ignored directories (node_modules/.git…), never follows symlinks,
   * and is bounded in depth and count. Main confines `root` to an open project.
   */
  listFilesDeep(root: string): Promise<IndexedFile[]>
  watchDir(path: string): Promise<{ watchId: string }>
  unwatchDir(watchId: string): Promise<void>
  onFsChange(
    cb: (e: { watchId: string; type: 'add' | 'change' | 'unlink'; path: string }) => void
  ): Unsubscribe
  revealInOs(path: string): Promise<void>
  openWithDefault(path: string): Promise<void>
  readFileText(path: string): Promise<string>
  getDiff(path: string): Promise<DiffPayload>
  /** Save edited text to a file INSIDE an open project root (viewer Edit mode). */
  saveFile(path: string, content: string): Promise<void>
  /** Current git branch for a directory, or null when not a repo. */
  getGitBranch(cwd: string): Promise<string | null>

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

  // Claude Code usage
  /** Aggregated cost + token usage across all live claude sessions. */
  getUsage(): Promise<UsageSummary>
  /** Full Usage-panel payload: plan limits + weekly totals + recent sessions. */
  getUsagePanel(): Promise<UsagePanelData>

  // GitHub Issues
  /**
   * Issues for the GitHub repo at `cwd` (its `origin` remote). Resolves with
   * `repo: null` when `cwd` is null or not a GitHub repo. Never rejects — main
   * degrades every failure to a stale/empty payload with a human `error`.
   */
  getIssues(cwd: string | null): Promise<IssuesPanelData>
  /**
   * Start the GitHub OAuth device flow: opens the browser to the verification
   * URI and returns the user code to display. Main polls in the background and
   * pushes the outcome via {@link WeftApi.onGithubAuth}.
   */
  githubSignIn(): Promise<GithubSignInResult>
  /** Forget the stored GitHub token (device-flow sign-out). */
  githubSignOut(): Promise<void>
  /** Device-flow progress + terminal result, pushed from main. */
  onGithubAuth(cb: (e: GithubAuthEvent) => void): Unsubscribe
  /** Open an http(s) URL in the OS default browser (guarded against other schemes). */
  openExternal(url: string): Promise<void>
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
  | 'listFilesDeep'
  | 'watchDir'
  | 'unwatchDir'
  | 'onFsChange'
  | 'revealInOs'
  | 'openWithDefault'
  | 'loadWorkspace'
  | 'saveWorkspace'
  | 'readFileText'
  | 'getDiff'
  | 'getGitBranch'
  | 'saveFile'
  | 'getUsage'
  | 'getUsagePanel'
  | 'getIssues'
  | 'githubSignIn'
  | 'githubSignOut'
  | 'onGithubAuth'
  | 'openExternal'
>

