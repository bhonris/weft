import { join } from 'node:path'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchWeft, openCommandPalette } from './helpers'

/**
 * Quick file open (Ctrl+Shift+O) — the VS Code "Go to File" analogue. Drives the
 * REAL built app: opens the finder, fuzzy-filters a nested file, opens it in the
 * viewer, and proves the reserved terminal key Ctrl+P is NOT hijacked by it
 * (the whole reason the finder lives on Ctrl+Shift+O and not Ctrl+P).
 */

let app: ElectronApplication
let page: Page
let projectDir: string

test.beforeEach(async () => {
  projectDir = mkdtempSync(join(tmpdir(), 'weft-qopen-'))
  writeFileSync(join(projectDir, 'hello.txt'), 'hi weft')
  mkdirSync(join(projectDir, 'sub'))
  writeFileSync(join(projectDir, 'sub', 'nested.md'), '# nested')

  app = await launchWeft({
    WEFT_E2E_OPEN_DIR: projectDir,
    WEFT_OPEN_PROJECT_COMMAND: 'shell' // no real `claude` boot in E2E
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByTestId('status-bar')).toBeVisible()

  // A project tab must exist so the finder has a root (activeTab.cwd) to index.
  await openCommandPalette(page)
  await page.keyboard.type('new shell tab')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('tab')).toHaveCount(1)
  await expect(page.getByText('hello.txt')).toBeVisible()
})

test.afterEach(async () => {
  await app.close()
})

/** Open the quick-open finder resiliently (the first post-launch chord can drop). */
async function openQuickOpen(): Promise<void> {
  await expect(async () => {
    await page.keyboard.press('Control+Shift+O')
    await expect(page.getByTestId('quick-open')).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 20_000 })
}

test('Ctrl+Shift+O finds a nested file and opens it in the viewer', async () => {
  await openQuickOpen()

  // Fuzzy-filter by name; the nested file surfaces even though it's in a subdir.
  await page.keyboard.type('nested')
  await expect(page.getByRole('option')).toHaveCount(1)
  await expect(page.getByRole('option')).toContainText('nested.md')
  await page.screenshot({ path: 'screenshots/quick-open-overlay.png' })

  await page.keyboard.press('Enter')
  await expect(page.getByTestId('quick-open')).toBeHidden()
  await expect(page.getByTestId('viewer-pane')).toBeVisible()
  await expect(page.getByTestId('viewer-pane')).toContainText('nested.md')
})

test('plain Ctrl+P does NOT open the finder (it belongs to the terminal)', async () => {
  // Regression for the reported conflict: Ctrl+P is reserved for shell/Claude
  // history and must pass through — it must never open the quick-open finder.
  await page.keyboard.press('Control+`') // focus the terminal
  await page.keyboard.press('Control+P')
  await expect(page.getByTestId('quick-open')).toBeHidden()

  // And the sibling chord still works right after.
  await openQuickOpen()
  await expect(page.getByTestId('quick-open')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('quick-open')).toBeHidden()
})
