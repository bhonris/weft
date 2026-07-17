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
  renameTab: 'tab:rename',
  reorderTabs: 'tab:reorder',
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
  watchDir: 'fs:watch-dir',
  unwatchDir: 'fs:unwatch-dir',
  fsChange: 'fs:change',
  revealInOs: 'fs:reveal',
  openWithDefault: 'fs:open',
  readFileText: 'fs:read-text',
  getDiff: 'fs:get-diff',

  // Persistence
  loadWorkspace: 'workspace:load',
  saveWorkspace: 'workspace:save'
} as const

export type ChannelName = (typeof CH)[keyof typeof CH]
