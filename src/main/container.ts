import { promises as fsPromises } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
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
import { watch as chokidarWatch } from 'chokidar'
import { registerSessionIpc } from './ipc/register'
import { registerFsIpc } from './ipc/register-fs'
import { registerWorkspaceIpc } from './ipc/register-workspace'
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

export async function wireApp(
  wireDeps: WireAppDeps
): Promise<{ pty: PtyManager; shutdown: () => void }> {
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

  // App-owned notifications: toast on waiting/done while unfocused; click
  // focuses the window and activates the tab (spec §4.4.7).
  const notifications = new NotificationService({
    isAppFocused: () => BrowserWindow.getAllWindows().some((w) => w.isFocused()),
    getTitle: (tabId) => {
      const ref = pty.tabRefs().find((r) => r.tabId === tabId)
      return ref ? basename(ref.cwd) || ref.cwd : undefined
    },
    focusTab: (tabId) => {
      const win = BrowserWindow.getAllWindows()[0]
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
        const main = BrowserWindow.getAllWindows()[0]
        main?.webContents.send(CH.reDockTab, {
          tabId,
          title,
          cwd: ref?.cwd ?? '',
          command: ref?.command === 'claude' ? 'claude' : 'shell'
        })
      })
    },
    // E2E/automation seams: WEFT_E2E_OPEN_DIR bypasses the native folder picker
    // (which no automation can drive), and WEFT_OPEN_PROJECT_COMMAND=shell lets
    // tests open a plain shell instead of booting a real `claude`.
    defaultCommand: process.env['WEFT_OPEN_PROJECT_COMMAND'] === 'shell' ? 'shell' : 'claude',
    claudePath: process.env['WEFT_CLAUDE_BIN'] ?? 'claude',
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

  const execFileAsync = promisify(execFile)
  const watchService = new WatchService((path) =>
    chokidarWatch(path, {
      ignoreInitial: true,
      ignored: (p: string) => /node_modules|[\\/]\.git([\\/]|$)/.test(p),
      // Two levels is enough for the visible tree; deeper levels load lazily.
      depth: 4
    })
  )
  registerFsIpc({
    ipcMain,
    fsService: new FsService(fsPromises),
    watchService,
    diffService: new DiffService(fsPromises, (file, args, opts) =>
      execFileAsync(file, args, opts)
    ),
    reveal: (path) => shell.showItemInFolder(path),
    open: async (path) => {
      await shell.openPath(path)
    }
  })

  // Workspace persistence: electron-store JSON blob + pre-migration backup.
  const { default: ElectronStore } = await import('electron-store')
  const electronStore = new ElectronStore()
  registerWorkspaceIpc({
    ipcMain,
    store: new WorkspaceStore({
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
  })

  // Main-process introspection for the E2E suite (never exposed to the renderer).
  ;(globalThis as Record<string, unknown>)['__weft'] = {
    statusEndpoint: endpoint,
    tabRefs: () => pty.tabRefs(),
    pidOf: (tabId: string) => pty.pidOf(tabId)
  }

  // Clean shutdown: kill every PTY (ConPTY children can otherwise pin the
  // process open on Windows) and release the pipe/UDS endpoint.
  const shutdown = (): void => {
    for (const tabId of pty.tabIds()) pty.close(tabId)
    void statusServer.stop()
    void watchService.closeAll()
  }

  return { pty, shutdown }
}
