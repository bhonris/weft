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
  /** v7: xterm terminal font size in px. */
  terminalFontSize: number
  /** v7: Monaco viewer/diff font size in px. */
  editorFontSize: number
  /** v7: whole-window zoom factor (1 = 100%), applied on top of the font sizes. */
  uiZoom: number
  /** v8: auto-restore + maximize the window on unfocused waiting/done (default false). */
  autoMaximizeEnabled: boolean
  windowBounds?: { x: number; y: number; width: number; height: number }
}

/** The sidebar panels selectable from the activity bar. */
export type SidebarPanel = 'explorer' | 'usage' | 'issues' | 'scm'

/** Which change group a working-tree change belongs to (mirrors VS Code's SCM groups). */
export type ScmGroup = 'staged' | 'unstaged' | 'untracked' | 'conflict'

/** Single-letter git status of a change (porcelain XY letters + untracked `?`). */
export type GitFileStatus = 'M' | 'A' | 'D' | 'R' | 'C' | 'T' | 'U' | '?'

/** One changed file in the Source Control panel. A file changed in both the
 *  index and the worktree appears twice — once `staged`, once `unstaged`. */
export interface GitFileChange {
  /** Absolute OS path (used to open its diff). */
  path: string
  /** Repo-relative path (forward slashes), the stable identity for git commands. */
  rel: string
  /** Rename/copy source (repo-relative), when `status` is `R`/`C`. */
  origRel?: string
  group: ScmGroup
  status: GitFileStatus
}

/** Everything the Source Control panel renders for the active repo. */
export interface GitRepoStatus {
  /** False when the cwd is null or not inside a git repo. */
  isRepo: boolean
  /** Branch name, `(detached)`, or null. */
  branch: string | null
  /** Upstream ref (e.g. `origin/main`), or null when none is set. */
  upstream: string | null
  ahead: number
  behind: number
  changes: GitFileChange[]
  /** Human-readable error (e.g. a failed refresh), or null. */
  error: string | null
}

/** Which baseline/target pair a change's diff compares (see DiffService.gitFileDiff). */
export type GitDiffSide = 'staged' | 'unstaged' | 'untracked'

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

/** One worksheet from a parsed workbook: a name and a grid of string cells. */
export interface Sheet {
  name: string
  rows: string[][]
}

/** A parsed spreadsheet returned by {@link WeftApi.readSpreadsheet}. */
export interface SpreadsheetData {
  sheets: Sheet[]
  /** True when row/column/sheet caps were hit (the table is a prefix). */
  truncated: boolean
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

/** The model + reasoning-effort an active session is running, from its transcript. */
export interface SessionInfo {
  /** Raw model id, e.g. `claude-opus-4-8` (mapped to a display name by the UI). */
  model: string
  /** Reasoning-effort tier (e.g. "high"), or null when the turn recorded none. */
  effort: string | null
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

/** Fields for a new GitHub issue created from the Issues panel. */
export interface CreateIssueInput {
  /** Issue title (required; the service rejects an empty/whitespace title). */
  title: string
  /** Markdown body — may be empty. */
  body: string
  /** Label names to apply (a subset of the repo's existing labels). */
  labels: string[]
}

/** Outcome of {@link WeftApi.createIssue} — the created issue, or a human error. */
export type CreateIssueResult = { issue: GithubIssue } | { error: string }

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
  /**
   * Whether `path` is an existing file inside an open project root. Used to
   * decide whether a terminal token becomes a clickable file link. Resolves
   * `false` (never rejects) for a missing path or one outside every root.
   */
  pathExists(path: string): Promise<boolean>
  /**
   * Parse a spreadsheet (xlsx/xlsm/xlsb/xls) into structured JSON for the table
   * viewer. Rejects for paths outside an open project root, oversize workbooks,
   * or when spreadsheet support isn't installed.
   */
  readSpreadsheet(path: string): Promise<SpreadsheetData>
  getDiff(path: string): Promise<DiffPayload>
  /** Save edited text to a file INSIDE an open project root (viewer Edit mode). */
  saveFile(path: string, content: string): Promise<void>
  /** Current git branch for a directory, or null when not a repo. */
  getGitBranch(cwd: string): Promise<string | null>

  // Source control (git working-tree changes for the SCM sidebar panel)
  /**
   * Full working-tree status for the repo at `cwd`. Resolves `{ isRepo: false }`
   * (not a rejection) when `cwd` is null or not a git repo, so the panel can
   * render an empty state.
   */
  getGitStatus(cwd: string | null): Promise<GitRepoStatus>
  /** Stage the given paths (`git add`). Rejects with git's stderr on failure. */
  stageFiles(cwd: string, paths: string[]): Promise<void>
  /** Unstage the given paths (`git reset HEAD`). Rejects with stderr on failure. */
  unstageFiles(cwd: string, paths: string[]): Promise<void>
  /**
   * Discard changes to the given paths — irreversible. `untracked: true` deletes
   * them (`git clean`); otherwise reverts them (`git checkout --`). Rejects with
   * stderr on failure. (Callers confirm first; see ConfirmDialog.)
   */
  discardChanges(cwd: string, paths: string[], untracked: boolean): Promise<void>
  /** Commit the staged changes with `message`. Rejects with stderr on failure. */
  gitCommit(cwd: string, message: string): Promise<void>
  /** Push the current branch (`git push`). Rejects with stderr on failure. */
  gitPush(cwd: string): Promise<void>
  /** Pull the current branch (`git pull`). Rejects with stderr on failure. */
  gitPull(cwd: string): Promise<void>
  /**
   * Diff payload for one changed file, per side: `unstaged` → working-tree vs
   * index, `staged` → index vs HEAD, `untracked` → empty baseline vs on-disk.
   */
  getGitFileDiff(path: string, side: GitDiffSide): Promise<DiffPayload>

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
  /**
   * The model + reasoning-effort the given session is currently running, read
   * from its transcript's latest assistant turn. Resolves null when there's no
   * readable transcript or no turn yet. Never rejects.
   */
  getSessionInfo(cwd: string, sessionId: string): Promise<SessionInfo | null>

  // GitHub Issues
  /**
   * Issues for the GitHub repo at `cwd` (its `origin` remote). Resolves with
   * `repo: null` when `cwd` is null or not a GitHub repo. Never rejects — main
   * degrades every failure to a stale/empty payload with a human `error`.
   */
  getIssues(cwd: string | null): Promise<IssuesPanelData>
  /**
   * Create a new issue on the GitHub repo at `cwd` (its `origin` remote).
   * Requires an authenticated token; resolves `{ error }` (never rejects) when
   * `cwd` isn't a GitHub repo, the title is blank, no token is available, or the
   * request fails, and `{ issue }` with the created issue on success.
   */
  createIssue(cwd: string | null, input: CreateIssueInput): Promise<CreateIssueResult>
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
  | 'pathExists'
  | 'readSpreadsheet'
  | 'getDiff'
  | 'getGitBranch'
  | 'getGitStatus'
  | 'stageFiles'
  | 'unstageFiles'
  | 'discardChanges'
  | 'gitCommit'
  | 'gitPush'
  | 'gitPull'
  | 'getGitFileDiff'
  | 'saveFile'
  | 'getUsage'
  | 'getUsagePanel'
  | 'getSessionInfo'
  | 'getIssues'
  | 'createIssue'
  | 'githubSignIn'
  | 'githubSignOut'
  | 'onGithubAuth'
  | 'openExternal'
>

