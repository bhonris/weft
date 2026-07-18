import { join } from 'node:path'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { launchWeft } from './helpers'

const MAIN = join(process.cwd(), 'dist-electron', 'main', 'index.js')

function launch(userDataDir: string, projectDir: string): Promise<ElectronApplication> {
  return launchWeft({
      WEFT_USER_DATA_DIR: userDataDir,
      WEFT_E2E_OPEN_DIR: projectDir,
      WEFT_OPEN_PROJECT_COMMAND: 'shell'
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
  // Deterministic: wait until the workspace blob actually landed on disk
  // (electron-store writes <userData>/config.json) instead of sleeping.
  const configPath = join(userDataDir, 'config.json')
  await expect
    .poll(
      () => {
        try {
          return readFileSync(configPath, 'utf8').includes(projectName)
        } catch {
          return false
        }
      },
      { timeout: 10_000 }
    )
    .toBe(true)
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

test('multi-tab order, renamed titles, and the theme override all survive a restart', async () => {
  test.setTimeout(90_000)
  const userDataDir = mkdtempSync(join(tmpdir(), 'weft-ud-'))
  const projectDir = mkdtempSync(join(tmpdir(), 'weft-proj-'))

  // ── Run 1: two tabs, rename both, switch to dark theme. ───────────────────
  const app1 = await launch(userDataDir, projectDir)
  const page1 = await app1.firstWindow()
  await page1.waitForLoadState('domcontentloaded')

  await page1.getByRole('button', { name: 'open project' }).click()
  await page1.getByRole('button', { name: 'open project' }).click()
  await expect(page1.getByTestId('tab')).toHaveCount(2)

  await page1.locator('.tab').first().locator('.tab__label').dblclick()
  await page1.getByLabel('rename tab').fill('alpha-project')
  await page1.getByLabel('rename tab').press('Enter')
  await page1.locator('.tab').nth(1).locator('.tab__label').dblclick()
  await page1.getByLabel('rename tab').fill('beta-project')
  await page1.getByLabel('rename tab').press('Enter')

  // cyberpunk (default) → system → light → dark
  await page1.getByRole('button', { name: /^theme:/ }).click()
  await page1.getByRole('button', { name: /^theme:/ }).click()
  await page1.getByRole('button', { name: /^theme:/ }).click()
  await expect(page1.getByRole('button', { name: /^theme:/ })).toContainText('dark')

  // Enable conversation resume (v0.2.0 daily-driver toggle).
  await page1.getByRole('button', { name: /^resume:/ }).click()
  await expect(page1.getByRole('button', { name: /^resume:/ })).toContainText('on')

  const configPath = join(userDataDir, 'config.json')
  await expect
    .poll(
      () => {
        try {
          const cfg = readFileSync(configPath, 'utf8')
          return cfg.includes('alpha-project') && cfg.includes('beta-project') && cfg.includes('"dark"')
        } catch {
          return false
        }
      },
      { timeout: 10_000 }
    )
    .toBe(true)
  await app1.close()

  // ── Run 2: both tabs back, in order, titles kept, theme dark. ─────────────
  const app2 = await launch(userDataDir, projectDir)
  const page2 = await app2.firstWindow()
  await page2.waitForLoadState('domcontentloaded')

  await expect(page2.getByTestId('tab')).toHaveCount(2)
  const titles = await page2.locator('.tab .tab__label').allTextContents()
  expect(titles.map((t) => t.replace(/[●‖✓✕○]\s*/g, '').trim())).toEqual([
    'alpha-project',
    'beta-project'
  ])
  await expect
    .poll(() => page2.evaluate(() => document.documentElement.dataset['theme']))
    .toBe('dark')
  // The resume opt-in survived the restart too.
  await expect(page2.getByRole('button', { name: /^resume:/ })).toContainText('on')

  await app2.close()
})
