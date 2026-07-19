import { join } from 'node:path'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { launchWeft } from './helpers'

/**
 * Expansion 7 — the remappable-keybindings journey. Opens the editor, rebinds a
 * command to a new chord, confirms the new chord actually invokes it, that a
 * reserved terminal chord is refused, and that the rebind survives a restart.
 */

function launch(userDataDir: string, projectDir: string): Promise<ElectronApplication> {
  return launchWeft({
    WEFT_USER_DATA_DIR: userDataDir,
    WEFT_E2E_OPEN_DIR: projectDir,
    WEFT_OPEN_PROJECT_COMMAND: 'shell'
  })
}

test('rebind a command, invoke the new chord, and reject a reserved chord', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'weft-ud-'))
  const projectDir = mkdtempSync(join(tmpdir(), 'weft-kb-'))
  writeFileSync(join(projectDir, 'a.txt'), 'hi')

  const app = await launch(userDataDir, projectDir)
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByTestId('status-bar')).toBeVisible()

  // Open a tab so "New Tab" has an observable effect later.
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('tab')).toHaveCount(1)

  // Open the keybindings editor via the palette.
  await page.keyboard.press('Control+Shift+P')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.keyboard.type('edit keybindings')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('keybindings-editor')).toBeVisible()

  // "New Tab" is the first (active) row; rebind it to Ctrl+Shift+Y.
  const newTabRow = page.getByRole('option').filter({ hasText: 'New Tab' })
  await expect(newTabRow).toContainText('T') // default Ctrl+T
  await page.keyboard.press('Enter') // capture
  await page.keyboard.press('Control+Shift+Y')
  await expect(newTabRow).toContainText('Y') // now Ctrl+Shift+Y

  // A reserved terminal chord (Ctrl+C) is refused with a clear message.
  await page.keyboard.press('Enter') // capture New Tab again
  await page.keyboard.press('Control+c')
  await expect(page.getByRole('status')).toContainText(/reserved/i)

  // Close the editor; the new chord now opens a tab (2nd tab appears).
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('keybindings-editor')).toBeHidden()
  await page.keyboard.press('Control+Shift+Y')
  await expect(page.getByTestId('tab')).toHaveCount(2)

  // The override landed on disk.
  const configPath = join(userDataDir, 'config.json')
  await expect
    .poll(
      () => {
        try {
          return readFileSync(configPath, 'utf8').includes('ctrl+shift+y')
        } catch {
          return false
        }
      },
      { timeout: 10_000 }
    )
    .toBe(true)

  await app.close()
})

test('a remapped terminal-search chord opens search inside the terminal', async () => {
  // Regression for the Cycle-7 review must-fix: xterm's key handler must resolve
  // against the EFFECTIVE keymap, not the defaults — or a remapped terminal-search
  // chord never opens the search bar in-terminal.
  const userDataDir = mkdtempSync(join(tmpdir(), 'weft-ud-'))
  const projectDir = mkdtempSync(join(tmpdir(), 'weft-kb3-'))
  writeFileSync(join(projectDir, 'a.txt'), 'hi')

  const app = await launch(userDataDir, projectDir)
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByTestId('status-bar')).toBeVisible()
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('terminal-pane')).toBeVisible()

  // Rebind "Search in Terminal" to Ctrl+Shift+K (click the row to start capture).
  await page.keyboard.press('Control+Shift+P')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.keyboard.type('edit keybindings')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('keybindings-editor')).toBeVisible()
  await page.getByRole('option', { name: /Search in Terminal/ }).click()
  await page.keyboard.press('Control+Shift+K')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('keybindings-editor')).toBeHidden()

  // Focus the terminal and press the NEW chord — the in-terminal search opens.
  await page.keyboard.press('Control+`')
  await page.keyboard.press('Control+Shift+K')
  await expect(page.getByTestId('terminal-search')).toBeVisible()

  await app.close()
})

test('a rebind survives an app restart', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'weft-ud-'))
  const projectDir = mkdtempSync(join(tmpdir(), 'weft-kb2-'))
  writeFileSync(join(projectDir, 'a.txt'), 'hi')

  // ── Run 1: rebind New Tab → Ctrl+Shift+Y, let it persist. ──
  const app1 = await launch(userDataDir, projectDir)
  const page1 = await app1.firstWindow()
  await page1.waitForLoadState('domcontentloaded')
  await expect(page1.getByTestId('status-bar')).toBeVisible()

  await page1.keyboard.press('Control+Shift+P')
  await expect(page1.getByTestId('command-palette')).toBeVisible()
  await page1.keyboard.type('edit keybindings')
  await page1.keyboard.press('Enter')
  await expect(page1.getByTestId('keybindings-editor')).toBeVisible()
  await page1.keyboard.press('Enter') // capture New Tab (active row 0)
  await page1.keyboard.press('Control+Shift+Y')

  const configPath = join(userDataDir, 'config.json')
  await expect
    .poll(
      () => {
        try {
          return readFileSync(configPath, 'utf8').includes('ctrl+shift+y')
        } catch {
          return false
        }
      },
      { timeout: 10_000 }
    )
    .toBe(true)
  await app1.close()

  // ── Run 2, same userData: the editor shows the persisted rebind. ──
  const app2 = await launch(userDataDir, projectDir)
  const page2 = await app2.firstWindow()
  await page2.waitForLoadState('domcontentloaded')
  await expect(page2.getByTestId('status-bar')).toBeVisible()

  await page2.keyboard.press('Control+Shift+P')
  await expect(page2.getByTestId('command-palette')).toBeVisible()
  await page2.keyboard.type('edit keybindings')
  await page2.keyboard.press('Enter')
  await expect(page2.getByTestId('keybindings-editor')).toBeVisible()

  const newTabRow = page2.getByRole('option').filter({ hasText: 'New Tab' })
  await expect(newTabRow).toContainText('Y') // rebind restored from disk

  await app2.close()
})
