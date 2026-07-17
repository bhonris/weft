import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { launchWeft } from './helpers'

const MAIN = join(process.cwd(), 'dist-electron', 'main', 'index.js')

let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  app = await launchWeft({
      WEFT_E2E_OPEN_DIR: mkdtempSync(join(tmpdir(), 'weft-uireload-')),
      WEFT_OPEN_PROJECT_COMMAND: 'shell'
    })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterEach(async () => {
  await app.close()
})

const liveState = () =>
  app.evaluate(() => {
    const g = globalThis as unknown as {
      __weft: {
        tabRefs: () => Array<{ tabId: string }>
        pidOf: (id: string) => number | undefined
      }
    }
    const refs = g.__weft.tabRefs()
    return { count: refs.length, pid: refs[0] ? g.__weft.pidOf(refs[0].tabId) : undefined }
  })

test('a REAL UI reload re-attaches the session: same PID, no orphaned PTYs, scrollback replayed', async () => {
  test.setTimeout(90_000)

  // Open a project through the actual UI and leave a marker in scrollback.
  await page.getByRole('button', { name: 'open project' }).click()
  await page.locator('.terminal-pane .xterm').click()
  await page.keyboard.type('echo ui-reload-proof')
  await page.keyboard.press('Enter')
  await expect(page.locator('.terminal-pane')).toContainText('ui-reload-proof', {
    timeout: 20_000
  })
  // Let the workspace save land before reloading.
  await page.waitForTimeout(400)

  const before = await liveState()
  expect(before.count).toBe(1)
  expect(before.pid).toBeGreaterThan(0)

  // Hard renderer reload — the full React app boots again and must RECONCILE,
  // not respawn (spec §4.7 / review finding reload-respawns-sessions).
  await page.reload()
  await page.waitForLoadState('domcontentloaded')

  // The tab is back, showing the SAME session's scrollback.
  await expect(page.getByTestId('tab')).toHaveCount(1)
  await expect(page.locator('.terminal-pane')).toContainText('ui-reload-proof', {
    timeout: 20_000
  })

  // Main still owns exactly ONE PTY, and it is the same process.
  const after = await liveState()
  expect(after.count).toBe(1) // no orphan spawned by the reload
  expect(after.pid).toBe(before.pid) // same PTY, not a lookalike

  // And it is still interactive after the reload.
  await page.locator('.terminal-pane .xterm').click()
  await page.keyboard.type('echo still-interactive')
  await page.keyboard.press('Enter')
  await expect(page.locator('.terminal-pane')).toContainText('still-interactive', {
    timeout: 20_000
  })
})

test('a session whose process exited shows the error badge and a dead-terminal notice', async () => {
  test.setTimeout(90_000)

  await page.getByRole('button', { name: 'open project' }).click()
  await page.locator('.terminal-pane .xterm').click()
  await page.keyboard.type('exit 3')
  await page.keyboard.press('Enter')

  // Non-zero exit → ✕ error badge (AC 356).
  await expect(page.locator('.tab__badge--error')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.terminal-pane')).toContainText('[process exited: 3]', {
    timeout: 20_000
  })

  // Typing into the dead terminal must not crash anything (exit-guard fix).
  await page.locator('.terminal-pane .xterm').click()
  await page.keyboard.type('into the void')
  await expect(page.getByTestId('tab')).toHaveCount(1)

  // The dead tab still closes cleanly.
  await page.getByRole('button', { name: /^close / }).click()
  await expect(page.getByTestId('tab')).toHaveCount(0)
})
