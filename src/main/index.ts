import { join } from 'node:path'
import { app, BrowserWindow, screen } from 'electron'
import { wireApp } from './container'
import { clampBoundsToDisplays } from '@core/persistence/clamp-bounds'

const isDev = !!process.env['ELECTRON_RENDERER_URL']

// A stray exception in main must never surface as a blocking error dialog —
// log and keep serving the windows/PTYs that are still healthy.
process.on('uncaughtException', (err) => {
  console.error('[weft-main] uncaught exception:', err)
})

// E2E isolation: each test run gets its own userData dir so persisted
// workspaces never leak between tests or into the real profile.
const userDataOverride = process.env['WEFT_USER_DATA_DIR']
if (userDataOverride) app.setPath('userData', userDataOverride)

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/** Create an app window; `query` selects the tear-off view (e.g. tearoff=<id>). */
function createWindow(query?: string, bounds?: Bounds): BrowserWindow {
  const win = new BrowserWindow({
    ...(bounds ?? {}),
    width: bounds?.width ?? (query ? 960 : 1280),
    height: bounds?.height ?? (query ? 640 : 800),
    show: false,
    backgroundColor: '#1e1e1e',
    title: 'Weft',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => win.show())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    void win.loadURL(query ? `${devUrl}?${query}` : devUrl)
  } else {
    const file = join(__dirname, '../renderer/index.html')
    void win.loadFile(file, query ? { search: query } : undefined)
  }
  return win
}

app.whenReady().then(async () => {
  const { shutdown, initialBounds: savedBounds } = await wireApp({
    createAppWindow: createWindow
  })
  // Never restore a window onto a monitor that no longer exists.
  const initialBounds = clampBoundsToDisplays(
    savedBounds,
    screen.getAllDisplays().map((d) => d.workArea)
  )
  app.on('before-quit', () => {
    shutdown()
    // Windows ConPTY agents can wedge a graceful quit after kill; guarantee
    // process death so neither users nor E2E runs are left with zombies.
    setTimeout(() => app.exit(0), 2000)
  })
  createWindow(undefined, initialBounds)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
