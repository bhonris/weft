import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

const MAIN = join(process.cwd(), 'dist-electron', 'main', 'index.js')

// A shell command that echoes a unique marker, cross-platform.
const echoCmd = (marker: string): string =>
  process.platform === 'win32' ? `echo ${marker}\r` : `echo ${marker}\n`

let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  app = await electron.launch({
    args: [MAIN],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      WEFT_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'weft-ud-'))
    }
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterEach(async () => {
  await app.close()
})

test('the app window renders the workbench shell', async () => {
  await expect(page.getByTestId('tab-strip')).toBeVisible()
  await expect(page.getByTestId('status-bar')).toBeVisible()
  await expect(page.getByText('Open a project to begin')).toBeVisible()
  // The preload bridge must be exposed under context isolation.
  const hasApi = await page.evaluate(() => typeof (window as unknown as { api?: unknown }).api === 'object')
  expect(hasApi).toBe(true)
})

test('a shell session spawns and echoes input through the real IPC/PTY pipeline', async () => {
  const cmd = echoCmd('weft-e2e-echo')
  await page.evaluate(async (command) => {
    const w = window as unknown as {
      api: {
        createSession(o: { cwd: string; command: 'shell' }): Promise<{ tabId: string }>
        attachSession(id: string): Promise<{ snapshot: string }>
        onSessionData(cb: (e: { tabId: string; data: string }) => void): () => void
        writeToSession(id: string, data: string): void
      }
      __out: string
      __tab: string
    }
    w.__out = ''
    const { tabId } = await w.api.createSession({ cwd: '.', command: 'shell' })
    w.__tab = tabId
    w.api.onSessionData((e) => {
      if (e.tabId === tabId) w.__out += e.data
    })
    await w.api.attachSession(tabId)
    w.api.writeToSession(tabId, command)
  }, cmd)

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __out: string }).__out), {
      timeout: 25_000
    })
    .toContain('weft-e2e-echo')
})

test('a session survives a renderer reload and replays its buffered output (§4.7)', async () => {
  const cmd = echoCmd('weft-reload-survives')

  // Create a session, run a command, and wait for its output.
  const tabId: string = await page.evaluate(async (command) => {
    const w = window as unknown as {
      api: {
        createSession(o: { cwd: string; command: 'shell' }): Promise<{ tabId: string }>
        attachSession(id: string): Promise<{ snapshot: string }>
        onSessionData(cb: (e: { tabId: string; data: string }) => void): () => void
        writeToSession(id: string, data: string): void
      }
      __out: string
    }
    w.__out = ''
    const { tabId } = await w.api.createSession({ cwd: '.', command: 'shell' })
    w.api.onSessionData((e) => {
      if (e.tabId === tabId) w.__out += e.data
    })
    await w.api.attachSession(tabId)
    w.api.writeToSession(tabId, command)
    return tabId
  }, cmd)

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __out: string }).__out), {
      timeout: 25_000
    })
    .toContain('weft-reload-survives')

  // Hard-reload the renderer — this destroys the React tree and window globals,
  // but the PTY lives in the main process and must survive.
  await page.reload()
  await page.waitForLoadState('domcontentloaded')

  // Re-attach to the SAME session id; its ring buffer must replay the earlier output.
  const snapshot: string = await page.evaluate(async (id) => {
    const w = window as unknown as {
      api: { attachSession(id: string): Promise<{ snapshot: string }> }
    }
    const res = await w.api.attachSession(id)
    return res.snapshot
  }, tabId)

  expect(snapshot).toContain('weft-reload-survives')
})
