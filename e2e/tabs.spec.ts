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
      WEFT_E2E_OPEN_DIR: mkdtempSync(join(tmpdir(), 'weft-tabs-')),
      WEFT_OPEN_PROJECT_COMMAND: 'shell'
    })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterEach(async () => {
  await app.close()
})

test('double-click renames a tab', async () => {
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('tab')).toHaveCount(1)

  await page.locator('.tab__label').dblclick()
  const input = page.getByLabel('rename tab')
  await expect(input).toBeVisible()
  await input.fill('renamed-project')
  await input.press('Enter')

  await expect(page.getByTestId('tab')).toContainText('renamed-project')
})

test('Ctrl+1/Ctrl+2 jump between tabs and Ctrl+W closes the active one', async () => {
  // Two tabs (same fixture dir — titles identical, ids distinct).
  await page.getByRole('button', { name: 'open project' }).click()
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('tab')).toHaveCount(2)
  // The second tab became active on open.
  await expect(page.locator('.tab--active')).toHaveCount(1)

  // Jump to tab 1.
  await page.keyboard.press('Control+1')
  await expect(page.locator('.tab').first()).toHaveClass(/tab--active/)

  // Jump to tab 2.
  await page.keyboard.press('Control+2')
  await expect(page.locator('.tab').nth(1)).toHaveClass(/tab--active/)

  // Ctrl+Tab cycles forward (wraps from 2 → 1), Ctrl+Shift+Tab cycles back.
  await page.keyboard.press('Control+Tab')
  await expect(page.locator('.tab').first()).toHaveClass(/tab--active/)
  await page.keyboard.press('Control+Shift+Tab')
  await expect(page.locator('.tab').nth(1)).toHaveClass(/tab--active/)

  // Ctrl+W closes the active (second) tab.
  await page.keyboard.press('Control+w')
  await expect(page.getByTestId('tab')).toHaveCount(1)
})

test('typing a reserved-adjacent key still reaches the terminal (passthrough)', async () => {
  await page.getByRole('button', { name: 'open project' }).click()
  await page.locator('.terminal-pane .xterm').click()
  // Plain characters and Ctrl+C must go to the PTY, not the app.
  await page.keyboard.type('echo passthrough-proof')
  await page.keyboard.press('Enter')
  await expect(page.locator('.terminal-pane')).toContainText('passthrough-proof', {
    timeout: 20_000
  })
  // One tab still open — Ctrl+C did not close anything.
  await page.keyboard.press('Control+c')
  await expect(page.getByTestId('tab')).toHaveCount(1)
})

test('dragging a tab onto another reorders the strip', async () => {
  await page.getByRole('button', { name: 'open project' }).click()
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('tab')).toHaveCount(2)

  // Rename both so order is observable.
  await page.locator('.tab').first().locator('.tab__label').dblclick()
  await page.getByLabel('rename tab').fill('first')
  await page.getByLabel('rename tab').press('Enter')
  await page.locator('.tab').nth(1).locator('.tab__label').dblclick()
  await page.getByLabel('rename tab').fill('second')
  await page.getByLabel('rename tab').press('Enter')

  await page.locator('.tab', { hasText: 'second' }).dragTo(page.locator('.tab', { hasText: 'first' }))

  const titles = await page.locator('.tab .tab__label').allTextContents()
  expect(titles.map((t) => t.replace(/[●‖✓✕○]\s*/g, '').trim())).toEqual(['second', 'first'])
})
