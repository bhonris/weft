import { promises as fsPromises } from 'node:fs'
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
import { registerSessionIpc } from './ipc/register'
import { registerFsIpc } from './ipc/register-fs'
import { CH } from '@shared/ipc/channels'

/**
 * Composition root: constructs the concrete services and wires IPC. This is the
 * only place Electron singletons meet the app's logic, so it is excluded from
 * the unit-coverage gate and exercised by E2E instead.
 */
export async function wireApp(): Promise<{ pty: PtyManager; shutdown: () => void }> {
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
    // E2E/automation seams: WEFT_E2E_OPEN_DIR bypasses the native folder picker
    // (which no automation can drive), and WEFT_OPEN_PROJECT_COMMAND=shell lets
    // tests open a plain shell instead of booting a real `claude`.
    defaultCommand: process.env['WEFT_OPEN_PROJECT_COMMAND'] === 'shell' ? 'shell' : 'claude',
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

  registerFsIpc({
    ipcMain,
    fsService: new FsService(fsPromises),
    reveal: (path) => shell.showItemInFolder(path),
    open: async (path) => {
      await shell.openPath(path)
    }
  })

  // Main-process introspection for the E2E suite (never exposed to the renderer).
  ;(globalThis as Record<string, unknown>)['__weft'] = {
    statusEndpoint: endpoint,
    tabRefs: () => pty.tabRefs()
  }

  // Clean shutdown: kill every PTY (ConPTY children can otherwise pin the
  // process open on Windows) and release the pipe/UDS endpoint.
  const shutdown = (): void => {
    for (const tabId of pty.tabIds()) pty.close(tabId)
    void statusServer.stop()
  }

  return { pty, shutdown }
}
