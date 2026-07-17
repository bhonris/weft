import { join } from 'node:path'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

const MAIN = join(process.cwd(), 'dist-electron', 'main', 'index.js')

let app: ElectronApplication
let page: Page
let projectDir: string

test.beforeEach(async () => {
  // Fixture project the folder picker will "choose" (WEFT_E2E_OPEN_DIR seam).
  projectDir = mkdtempSync(join(tmpdir(), 'weft-e2e-'))
  writeFileSync(join(projectDir, 'hello.txt'), 'hi weft')
  mkdirSync(join(projectDir, 'sub'))
  writeFileSync(join(projectDir, 'sub', 'nested.md'), '# nested')

  app = await electron.launch({
    args: [MAIN],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      WEFT_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'weft-ud-')),
      WEFT_E2E_OPEN_DIR: projectDir,
      WEFT_OPEN_PROJECT_COMMAND: 'shell' // no real `claude` boot in E2E
    }
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterEach(async () => {
  await app.close()
})

test('clicking + opens a project: tab appears, terminal is live, explorer lists files', async () => {
  await page.getByRole('button', { name: 'open project' }).click()

  // Tab appears, titled after the fixture directory, with a status badge.
  const tab = page.getByTestId('tab')
  await expect(tab).toHaveCount(1)
  await expect(tab).toContainText(projectDir.split(/[\\/]/).pop() as string)

  // The terminal pane mounted and the xterm canvas/rows are present.
  await expect(page.getByTestId('terminal-pane')).toBeVisible()
  await expect(page.locator('.terminal-pane .xterm')).toBeVisible()

  // The explorer lists the fixture files.
  await expect(page.getByTestId('explorer-tree')).toBeVisible()
  await expect(page.getByText('hello.txt')).toBeVisible()
  await expect(page.getByText('sub')).toBeVisible()

  // Expand the subdirectory — lazy load pulls nested.md.
  await page.getByText('sub').click()
  await expect(page.getByText('nested.md')).toBeVisible()

  // Type into the real terminal and see the echo round-trip on screen.
  await page.locator('.terminal-pane .xterm').click()
  await page.keyboard.type('echo weft-ui-echo')
  await page.keyboard.press('Enter')
  await expect(page.locator('.terminal-pane')).toContainText('weft-ui-echo', {
    timeout: 20_000
  })

  // Status bar reflects one session.
  await expect(page.getByTestId('status-bar')).toContainText('1 session')
})

test('closing the tab returns to the empty state', async () => {
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('tab')).toHaveCount(1)

  const title = projectDir.split(/[\\/]/).pop() as string
  await page.getByRole('button', { name: `close ${title}` }).click()

  await expect(page.getByTestId('tab')).toHaveCount(0)
  await expect(page.getByText('Open a project to begin')).toBeVisible()
  await expect(page.getByText('No project open')).toBeVisible()
})
