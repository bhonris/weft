import { join } from 'node:path'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'

const MAIN = join(process.cwd(), 'dist-electron', 'main', 'index.js')

function launch(userDataDir: string, projectDir: string): Promise<ElectronApplication> {
  return electron.launch({
    args: [MAIN],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      WEFT_USER_DATA_DIR: userDataDir,
      WEFT_E2E_OPEN_DIR: projectDir,
      WEFT_OPEN_PROJECT_COMMAND: 'shell'
    }
  })
}

test('the workspace survives an app restart: tabs and cwds are restored', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'weft-ud-'))
  const projectDir = mkdtempSync(join(tmpdir(), 'weft-proj-'))
  writeFileSync(join(projectDir, 'marker.txt'), 'restore me')
  const projectName = projectDir.split(/[\\/]/).pop() as string

  // ── First run: open a project, let the workspace save, quit. ──────────────
  const app1 = await launch(userDataDir, projectDir)
  const page1 = await app1.firstWindow()
  await page1.waitForLoadState('domcontentloaded')

  await page1.getByRole('button', { name: 'open project' }).click()
  await expect(page1.getByTestId('tab')).toHaveCount(1)
  await expect(page1.getByTestId('tab')).toContainText(projectName)
  // Give the window a distinctive size so bounds restore is observable.
  await app1.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]!.setBounds({ x: 80, y: 80, width: 977, height: 653 })
  })
  // The save is debounce-free (fires on tab change); still, give IPC a beat.
  await page1.waitForTimeout(500)
  await app1.close()

  // ── Second run, same userData: the tab must come back on its own. ─────────
  const app2 = await launch(userDataDir, projectDir)
  const page2 = await app2.firstWindow()
  await page2.waitForLoadState('domcontentloaded')

  await expect(page2.getByTestId('tab')).toHaveCount(1)
  await expect(page2.getByTestId('tab')).toContainText(projectName)
  // The restored session is a live terminal, not just a label.
  await expect(page2.locator('.terminal-pane .xterm')).toBeVisible()
  // And the explorer shows the restored project's files.
  await expect(page2.getByText('marker.txt')).toBeVisible()

  // Window geometry survived the restart too (AC 15).
  const bounds = await app2.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.getBounds()
  )
  // Windows rounds window sizes to DPI-scale multiples; assert within 8px.
  expect(Math.abs(bounds.width - 977)).toBeLessThanOrEqual(8)
  expect(Math.abs(bounds.height - 653)).toBeLessThanOrEqual(8)

  await app2.close()
})
