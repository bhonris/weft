import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchWeft, tempDir } from './helpers'

let app: ElectronApplication
let page: Page

test.afterEach(async () => {
  await app.close()
})

test('Shift+Click on + opens a plain SHELL tab even when claude is unavailable', async () => {
  // Default command is claude and the binary is broken — a normal click would
  // show the error banner. Shift+Click must open a working shell instead.
  app = await launchWeft({
    WEFT_E2E_OPEN_DIR: tempDir('weft-shelltab-'),
    WEFT_CLAUDE_BIN: 'weft-definitely-not-a-real-binary.exe'
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  await page.getByRole('button', { name: 'open project' }).click({ modifiers: ['Shift'] })

  await expect(page.getByTestId('tab')).toHaveCount(1)
  await expect(page.getByTestId('spawn-error')).toHaveCount(0) // no claude failure
  // Badge starts unknown (shell sessions produce no hooks).
  await expect(page.locator('.tab__badge--unknown')).toBeVisible()

  // And it is a real, interactive shell.
  await page.locator('.terminal-pane .xterm').click()
  await page.keyboard.type('echo weft-shell-tab')
  await page.keyboard.press('Enter')
  await expect(page.locator('.terminal-pane')).toContainText('weft-shell-tab', {
    timeout: 20_000
  })
})

test('Ctrl+Shift+F opens in-terminal search; Enter finds; Esc returns focus to the terminal', async () => {
  app = await launchWeft({
    WEFT_E2E_OPEN_DIR: tempDir('weft-search-'),
    WEFT_OPEN_PROJECT_COMMAND: 'shell'
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  await page.getByRole('button', { name: 'open project' }).click()
  await page.locator('.terminal-pane .xterm').click()
  await page.keyboard.type('echo find-me-in-scrollback')
  await page.keyboard.press('Enter')
  await expect(page.locator('.terminal-pane')).toContainText('find-me-in-scrollback', {
    timeout: 20_000
  })

  // Open search.
  await page.keyboard.press('Control+Shift+F')
  const searchBox = page.getByTestId('terminal-search')
  await expect(searchBox).toBeVisible()

  // Type a query and find.
  await page.getByLabel('search terminal').fill('find-me-in-scrollback')
  await page.getByLabel('search terminal').press('Enter')
  // The chord must NOT have reached the shell as input.
  await expect(page.locator('.terminal-pane')).not.toContainText('^F')

  // Esc closes and focus returns to the terminal — typing lands in the PTY.
  await page.getByLabel('search terminal').press('Escape')
  await expect(searchBox).toHaveCount(0)
  await page.keyboard.type('echo after-search')
  await page.keyboard.press('Enter')
  await expect(page.locator('.terminal-pane')).toContainText('after-search', {
    timeout: 20_000
  })
})
