import { join } from 'node:path'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { launchWeft } from './helpers'

/**
 * Expansion 8 — the in-project workspace journey. Open two files as tabs, confirm
 * the CLI stays visible in the dock beside the editor, switch/close tabs, move
 * the dock, resize it, and confirm the dock placement survives a restart.
 */

function launch(userDataDir: string, projectDir: string): Promise<ElectronApplication> {
  return launchWeft({
    WEFT_USER_DATA_DIR: userDataDir,
    WEFT_E2E_OPEN_DIR: projectDir,
    WEFT_OPEN_PROJECT_COMMAND: 'shell'
  })
}

test('file tabs + always-present CLI dock, moveable and persistent', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'weft-ud-'))
  const projectDir = mkdtempSync(join(tmpdir(), 'weft-ws-'))
  writeFileSync(join(projectDir, 'a.txt'), 'file a')
  writeFileSync(join(projectDir, 'b.txt'), 'file b')

  const app = await launch(userDataDir, projectDir)
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByTestId('status-bar')).toBeVisible()

  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('terminal-pane')).toBeVisible()

  // Open two files → two editor tabs, and the CLI stays visible in the dock.
  await page.getByText('a.txt').click()
  await page.getByText('b.txt').click()
  await expect(page.getByRole('tab')).toHaveCount(2)
  await expect(page.getByTestId('viewer-pane')).toBeVisible()
  await expect(page.getByTestId('terminal-pane')).toBeVisible() // both at once = split
  await expect(page.getByTestId('terminal-host')).toHaveAttribute('data-split', 'on')

  // Switch back to the first tab.
  await page.getByRole('tab', { name: 'a.txt' }).click()
  await expect(page.getByRole('tab', { name: 'a.txt' })).toHaveAttribute('aria-selected', 'true')

  // Move the CLI dock to the right edge (palette command) and resize via the
  // divider's keyboard control.
  await page.keyboard.press('Control+Shift+P')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.keyboard.type('move cli dock')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('terminal-host')).toHaveAttribute('data-dock', 'right')
  await page.getByTestId('dock-divider').focus()
  await page.keyboard.press('ArrowDown') // grow the CLI a notch (exercises resize)

  // The dock placement landed on disk.
  const configPath = join(userDataDir, 'config.json')
  await expect
    .poll(
      () => {
        try {
          return /"position":\s*"right"/.test(readFileSync(configPath, 'utf8'))
        } catch {
          return false
        }
      },
      { timeout: 10_000 }
    )
    .toBe(true)

  // Close both tabs → the editor area disappears and the CLI fills the area.
  await page.getByRole('button', { name: 'close a.txt' }).click()
  await page.getByRole('button', { name: 'close b.txt' }).click()
  await expect(page.getByTestId('viewer-pane')).toBeHidden()
  await expect(page.getByTestId('terminal-pane')).toBeVisible()
  await expect(page.getByTestId('terminal-host')).toHaveAttribute('data-split', 'off')

  await app.close()

  // Restart, same userData: the dock is still on the right.
  const app2 = await launch(userDataDir, projectDir)
  const page2 = await app2.firstWindow()
  await page2.waitForLoadState('domcontentloaded')
  await expect(page2.getByTestId('terminal-host')).toHaveAttribute('data-dock', 'right')
  await app2.close()
})
