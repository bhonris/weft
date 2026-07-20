import { promises as fsPromises } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir, homedir } from 'node:os'
import { basename } from 'node:path'
import { app, ipcMain, dialog, shell, BrowserWindow, Notification } from 'electron'
import { PtyManager } from './services/pty-manager'
import { NodePtyFactory } from './services/pty-factory'
import { FsService } from './services/fs-service'
import { StatusServer } from './services/status-server'
import { NotificationService } from './services/notification-service'
import { writeForwarder } from './services/hook-forwarder'
import { NetTransport } from './platform/net-transport'
import { statusEndpointPath } from '@core/pipe/pipe-name'
import { buildHookSettingsJson } from '@core/status/hook-settings'
import { WorkspaceStore } from './services/workspace-store'
import { DiffService } from './services/diff-service'
import { WatchService } from './services/watch-service'
import { GitService } from './services/git-service'
import { resolveBinary } from './services/resolve-binary'
import { watch as chokidarWatch } from 'chokidar'
import { UsageService } from './services/usage-service'
import { UsageHistoryService } from './services/usage-history-service'
import { PlanLimitsService } from './services/plan-limits-service'
import { GithubService, type GithubFetchLike } from './services/github-service'
import { GithubAuthService } from './services/github-auth-service'
import { registerSessionIpc } from './ipc/register'
import { registerFsIpc } from './ipc/register-fs'
import { registerWorkspaceIpc } from './ipc/register-workspace'
import { registerUsageIpc } from './ipc/register-usage'
import { registerGithubIpc } from './ipc/register-github'
import { CH } from '@shared/ipc/channels'

/**
 * Composition root: constructs the concrete services and wires IPC. This is the
 * only place Electron singletons meet the app's logic, so it is excluded from
 * the unit-coverage gate and exercised by E2E instead.
 */
export interface WireAppDeps {
  /** Creates an app BrowserWindow; a query string selects the tear-off view. */
  createAppWindow: (query?: string) => BrowserWindow
}

/** The main (non-tear-off) window, or null. Never assume getAllWindows()[0]. */
function getMainWindow(): BrowserWindow | null {
  return (
    BrowserWindow.getAllWindows().find(
      (w) => !w.isDestroyed() && !w.webContents.getURL().includes('tearoff=')
    ) ?? null
  )
}

export async function wireApp(wireDeps: WireAppDeps): Promise<{
  pty: PtyManager
  shutdown: () => void
  initialBounds?: { x: number; y: number; width: number; height: number } | undefined
}> {
  const pty = new PtyManager(new NodePtyFactory())

  // ── Status pipeline (spec §4.4): endpoint + forwarder + server ─────────────
  const instanceId = randomUUID().slice(0, 8)
  const runtimeDir = process.env['XDG_RUNTIME_DIR'] ?? tmpdir()
  const endpoint = statusEndpointPath(process.platform, instanceId, runtimeDir)

  const { wrapperPath } = await writeForwarder({
    fs: fsPromises,
    dir: join(app.getPath('userData'), 'hooks'),
    electronExe: process.execPath,
    platform: process.platform
  })
  const settingsJson = buildHookSettingsJson({ forwarderCommand: `"${wrapperPath}"` })

  // Workspace persistence: electron-store JSON blob + pre-migration backup.
  // Constructed here (before notifications) so the notification service can read
  // the persisted on/off switch straight from it.
  const { default: ElectronStore } = await import('electron-store')
  const electronStore = new ElectronStore()
  const workspaceStore = new WorkspaceStore({
      store: {
        get: (key) => electronStore.get(key),
        set: (key, value) => electronStore.set(key, value)
      },
      backup: (blob) => {
        void fsPromises.writeFile(
          join(app.getPath('userData'), 'config.bak'),
          JSON.stringify(blob, null, 2)
        )
      },
      onWarn: (message) => console.warn(`[weft-workspace] ${message}`)
  })

  // App-owned notifications: toast on waiting/done while unfocused; click
  // focuses the window and activates the tab (spec §4.4.7). Muted centrally when
  // the user turns notifications off — read per event so no restart is needed.
  const notifications = new NotificationService({
    isEnabled: () => workspaceStore.load().notificationsEnabled,
    isAppFocused: () => BrowserWindow.getAllWindows().some((w) => w.isFocused()),
    getTitle: (tabId) => {
      const ref = pty.tabRefs().find((r) => r.tabId === tabId)
      return ref ? basename(ref.cwd) || ref.cwd : undefined
    },
    focusTab: (tabId) => {
      const win = getMainWindow()
      if (!win) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
      win.webContents.send(CH.activateTab, { tabId })
    },
    showToast: (toast) => {
      if (!Notification.isSupported()) return
      const n = new Notification({ title: toast.title, body: toast.body })
      n.on('click', toast.onClick)
      n.show()
    }
  })

  const statusServer = new StatusServer({
    transport: new NetTransport(),
    endpointPath: endpoint,
    getTabs: () => pty.tabRefs(),
    onStatus: (change) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(CH.sessionStatus, change)
      }
      notifications.handleStatus(change)
    },
    onDrop: (reason) => console.warn(`[weft-status] dropped payload: ${reason}`)
  })
  await statusServer.start()

  const execFileAsync = promisify(execFile)

  // node-pty/ConPTY does not do PATH+PATHEXT resolution — resolve `claude` to
  // an absolute path once, up front (WEFT_CLAUDE_BIN still overrides for E2E).
  const claudePath =
    process.env['WEFT_CLAUDE_BIN'] ??
    (await resolveBinary('claude', (file, args, opts) => execFileAsync(file, args, opts)))

  registerSessionIpc({
    ipcMain,
    pty,
    hooks: { endpoint, settingsJson },
    onSessionClosed: (tabId) => statusServer.forget(tabId),
    // Tear-off (spec §4.2): the PTY stays in main; a new window re-attaches to
    // the same stream. Closing the window with the session alive re-docks it.
    openTearOff: (tabId, title) => {
      const ref = pty.tabRefs().find((r) => r.tabId === tabId)
      const win = wireDeps.createAppWindow(
        `tearoff=${encodeURIComponent(tabId)}&title=${encodeURIComponent(title)}`
      )
      win.on('closed', () => {
        if (!pty.has(tabId)) return // session was closed inside the tear-off
        const payload = {
          tabId,
          title,
          cwd: ref?.cwd ?? '',
          command: ref?.command === 'claude' ? 'claude' : ('shell' as const)
        }
        const main = getMainWindow()
        if (main) {
          main.webContents.send(CH.reDockTab, payload)
          return
        }
        // Main was closed while this tear-off lived on: never strand a live
        // session — recreate a main window and re-dock once it's ready.
        const revived = wireDeps.createAppWindow()
        revived.webContents.once('did-finish-load', () => {
          revived.webContents.send(CH.reDockTab, payload)
        })
      })
    },
    // E2E/automation seams: WEFT_E2E_OPEN_DIR bypasses the native folder picker
    // (which no automation can drive), and WEFT_OPEN_PROJECT_COMMAND=shell lets
    // tests open a plain shell instead of booting a real `claude`.
    defaultCommand: process.env['WEFT_OPEN_PROJECT_COMMAND'] === 'shell' ? 'shell' : 'claude',
    claudePath,
    pickDirectory: async () => {
      const forced = process.env['WEFT_E2E_OPEN_DIR']
      if (forced) return forced
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Open a project in Weft'
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0] ?? null
    }
  })

  const watchService = new WatchService(
    (path) =>
      chokidarWatch(path, {
        ignoreInitial: true,
        ignored: (p: string) => /[\\/](node_modules|\.git)([\\/]|$)/.test(p),
        // Watch a few levels deep for the visible tree; deeper levels load lazily.
        depth: 4
      }),
    (path, err) => console.warn(`[weft-watch] error watching ${path}:`, err)
  )
  const gitService = new GitService((file, args, opts) => execFileAsync(file, args, opts))
  registerFsIpc({
    ipcMain,
    fsService: new FsService(fsPromises),
    watchService,
    diffService: new DiffService(fsPromises, (file, args, opts) =>
      execFileAsync(file, args, opts)
    ),
    gitService,
    getWritableRoots: () => pty.tabRefs().map((r) => r.cwd),
    reveal: (path) => shell.showItemInFolder(path),
    open: async (path) => {
      await shell.openPath(path)
    }
  })

  registerWorkspaceIpc({ ipcMain, store: workspaceStore })

  // Claude Code usage: read the CLI's own transcripts and aggregate cost/tokens
  // across live claude sessions (read-only; never writes under ~/.claude).
  const usageFs = {
    readFile: (path: string, encoding: 'utf8') => fsPromises.readFile(path, encoding),
    stat: (path: string) => fsPromises.stat(path),
    readdir: (path: string) => fsPromises.readdir(path)
  }
  const projectsDir = join(homedir(), '.claude', 'projects')
  const usageService = new UsageService(usageFs, projectsDir)
  // The Usage panel: all-projects weekly/session history + plan-limit meters.
  const historyService = new UsageHistoryService(usageFs, projectsDir, () => Date.now())
  const planLimitsService = new PlanLimitsService({
    // Read-only OAuth token; used only to authorize the usage request and never
    // sent to the renderer. A missing/unreadable file simply disables the meter.
    // WEFT_DISABLE_PLAN_LIMITS is an E2E seam: no token → no network call, so
    // tests never hit the real authenticated endpoint.
    getToken: async () => {
      if (process.env['WEFT_DISABLE_PLAN_LIMITS']) return null
      try {
        const raw = await fsPromises.readFile(
          join(homedir(), '.claude', '.credentials.json'),
          'utf8'
        )
        const parsed = JSON.parse(raw) as { claudeAiOauth?: { accessToken?: unknown } }
        const token = parsed.claudeAiOauth?.accessToken
        return typeof token === 'string' ? token : null
      } catch {
        return null
      }
    },
    fetch: (url, init) => fetch(url, init),
    now: () => Date.now(),
    // Refresh the plan-limit meters ~once a minute so the always-on 5-hour
    // readout stays live. The renderer may poll faster while the Usage panel is
    // open; this cache still bounds real hits to the (rate-limited) endpoint to
    // one per minute.
    cacheMs: 60 * 1000
  })
  registerUsageIpc({
    ipcMain,
    usageService,
    historyService,
    planLimitsService,
    getSessions: () =>
      pty
        .tabRefs()
        .filter((r) => r.command === 'claude')
        .map((r) => ({ sessionId: r.sessionId, cwd: r.cwd }))
  })

  // GitHub Issues: detect the repo from the cwd's origin remote, fetch its
  // issues, and run the OAuth device flow for sign-in. The token is resolved in
  // main (gh CLI → GITHUB_TOKEN → stored) and never sent to the renderer.
  const githubFetch: GithubFetchLike = (url, init) => fetch(url, init)
  const githubAuthService = new GithubAuthService({
    fetch: githubFetch,
    exec: (file, args, opts) => execFileAsync(file, args, opts),
    getEnv: (name) => process.env[name],
    store: {
      get: () => {
        const v = electronStore.get('githubToken')
        return typeof v === 'string' ? v : null
      },
      set: (token) => electronStore.set('githubToken', token),
      delete: () => electronStore.delete('githubToken')
    },
    openExternal: (url) => shell.openExternal(url),
    emit: (event) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(CH.githubAuth, event)
      }
    },
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    // A registered GitHub OAuth App client id enables in-app sign-in. Public by
    // design (device flow uses no client secret). Until provided, sign-in reports
    // "not configured" and the gh/env/unauthenticated paths still work.
    clientId: process.env['WEFT_GITHUB_CLIENT_ID'] ?? null
  })
  const githubService = new GithubService({
    fetch: githubFetch,
    getRemoteUrl: (cwd) => gitService.remoteUrl(cwd),
    getAuth: () => githubAuthService.resolveAuth(),
    now: () => Date.now(),
    cacheMs: 60 * 1000
  })
  registerGithubIpc({
    ipcMain,
    githubService,
    authService: githubAuthService,
    openExternal: (url) => shell.openExternal(url)
  })

  // Main-process introspection for the E2E suite (never exposed to the renderer).
  ;(globalThis as Record<string, unknown>)['__weft'] = {
    statusEndpoint: endpoint,
    tabRefs: () => pty.tabRefs(),
    pidOf: (tabId: string) => pty.pidOf(tabId)
  }

  // Clean shutdown: persist the main window's bounds, kill every PTY (ConPTY
  // children can otherwise pin the process open), release the pipe endpoint.
  const shutdown = (): void => {
    const main = getMainWindow()
    if (main && !main.isDestroyed()) {
      workspaceStore.save({ ...workspaceStore.load(), windowBounds: main.getBounds() })
    }
    for (const tabId of pty.tabIds()) pty.close(tabId)
    void statusServer.stop()
    void watchService.closeAll()
  }

  // Restore the prior window geometry on launch (spec AC 15).
  const initialBounds = workspaceStore.load().windowBounds

  return { pty, shutdown, initialBounds }
}
