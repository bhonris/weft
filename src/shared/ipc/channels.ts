/**
 * Single source of truth for every IPC channel name, so main and preload
 * cannot drift. `invoke`/`handle` channels and `send`/`on` event channels.
 */
export const CH = {
  // Terminal / session (renderer -> main, invoke)
  createSession: 'session:create',
  writeToSession: 'session:write',
  resizeSession: 'session:resize',
  closeSession: 'session:close',
  renameTab: 'tab:rename',
  reorderTabs: 'tab:reorder',
  moveTabToWindow: 'tab:move-window',

  // Terminal / session (main -> renderer, event)
  sessionData: 'session:data',
  sessionExit: 'session:exit',
  sessionStatus: 'session:status',

  // Filesystem
  listDir: 'fs:list-dir',
  watchDir: 'fs:watch-dir',
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
