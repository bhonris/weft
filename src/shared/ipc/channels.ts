/**
 * Single source of truth for every IPC channel name, so main and preload
 * cannot drift. `invoke`/`handle` channels and `send`/`on` event channels.
 */
export const CH = {
  // Terminal / session (renderer -> main, invoke)
  createSession: 'session:create',
  // Live sessions in main — the renderer reconciles against this on reload.
  listSessions: 'session:list',
  writeToSession: 'session:write',
  resizeSession: 'session:resize',
  closeSession: 'session:close',
  // Attach/detach a renderer view to a live session (survives reload; §4.7).
  attachSession: 'session:attach',
  detachSession: 'session:detach',
  moveTabToWindow: 'tab:move-window',
  // Open an OS directory picker and start a claude session rooted there.
  openProject: 'app:open-project',

  // Terminal / session (main -> renderer, event)
  sessionData: 'session:data',
  sessionExit: 'session:exit',
  sessionStatus: 'session:status',
  // Main asks the renderer to activate a tab (notification click routing).
  activateTab: 'tab:activate',
  // A torn-off window closed with its session alive — main window re-docks it.
  reDockTab: 'tab:re-dock',

  // Filesystem
  listDir: 'fs:list-dir',
  listFilesDeep: 'fs:list-deep',
  watchDir: 'fs:watch-dir',
  unwatchDir: 'fs:unwatch-dir',
  fsChange: 'fs:change',
  revealInOs: 'fs:reveal',
  openWithDefault: 'fs:open',
  readFileText: 'fs:read-text',
  // Existence check for a terminal file link (root-guarded; returns a boolean).
  pathExists: 'fs:path-exists',
  // Parse a spreadsheet (xlsx/xls) to structured JSON for the table viewer.
  readSpreadsheet: 'fs:read-spreadsheet',
  getDiff: 'fs:get-diff',
  getGitBranch: 'fs:git-branch',
  saveFile: 'fs:save-file',
  // Per-side git diff for a changed file (read-only; rides with the fs group).
  getGitFileDiff: 'fs:git-file-diff',

  // Source control (renderer -> main, invoke)
  getGitStatus: 'scm:status',
  stageFiles: 'scm:stage',
  unstageFiles: 'scm:unstage',
  discardChanges: 'scm:discard',
  gitCommit: 'scm:commit',
  gitPush: 'scm:push',
  gitPull: 'scm:pull',

  // Persistence
  loadWorkspace: 'workspace:load',
  saveWorkspace: 'workspace:save',

  // Claude Code usage (renderer -> main, invoke)
  getUsage: 'usage:get',
  getUsagePanel: 'usage:panel',
  getSessionInfo: 'usage:session-info',

  // GitHub Issues (renderer -> main, invoke)
  getIssues: 'github:get',
  createIssue: 'github:create',
  githubSignIn: 'github:sign-in',
  githubSignOut: 'github:sign-out',
  // Device-flow progress + result (main -> renderer, event)
  githubAuth: 'github:auth',
  // Open an external http(s) URL in the default browser.
  openExternal: 'app:open-external'
} as const

export type ChannelName = (typeof CH)[keyof typeof CH]
