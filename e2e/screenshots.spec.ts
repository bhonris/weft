import { join } from 'node:path'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { test, expect, _electron as electron } from '@playwright/test'

const MAIN = join(process.cwd(), 'dist-electron', 'main', 'index.js')
const SHOTS = join(process.cwd(), 'screenshots')

/**
 * Phase 3b evidence: full-window captures of the real running app at its key
 * states, saved to screenshots/ for the Divergence Meter record.
 */
test('capture divergence-meter screenshots of the running app', async () => {
  test.setTimeout(120_000)
  mkdirSync(SHOTS, { recursive: true })

  const projectDir = mkdtempSync(join(tmpdir(), 'weft-shots-'))
  writeFileSync(join(projectDir, 'README.md'), '# demo project\n\nhello weft\n')
  mkdirSync(join(projectDir, 'src'))
  writeFileSync(join(projectDir, 'src', 'index.ts'), 'export const answer = 42\n')
  const git = (...a: string[]): void => {
    execFileSync('git', a, { cwd: projectDir })
  }
  git('init', '-q')
  git('-c', 'user.email=lab@weft.test', '-c', 'user.name=Weft', 'add', '.')
  git('-c', 'user.email=lab@weft.test', '-c', 'user.name=Weft', 'commit', '-q', '-m', 'init')
  writeFileSync(join(projectDir, 'src', 'index.ts'), 'export const answer = 43 // changed\n')

  const app = await electron.launch({
    args: [MAIN],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      WEFT_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'weft-ud-')),
      WEFT_E2E_OPEN_DIR: projectDir,
      WEFT_OPEN_PROJECT_COMMAND: 'shell'
    }
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  // 1 — empty workbench
  await page.screenshot({ path: join(SHOTS, 'dev-smoke-cycle-1-empty.png') })

  // 2 — live session + explorer
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.locator('.terminal-pane .xterm')).toBeVisible()
  await page.locator('.terminal-pane .xterm').click()
  await page.keyboard.type('echo weft divergence meter')
  await page.keyboard.press('Enter')
  await expect(page.locator('.terminal-pane')).toContainText('weft divergence meter', {
    timeout: 20_000
  })
  await page.screenshot({ path: join(SHOTS, 'dev-smoke-cycle-1-terminal.png') })

  // 3 — Monaco diff of the modified file
  await page.getByText('src').click()
  await page.getByText('index.ts').click()
  await expect(page.getByTestId('viewer-pane')).toBeVisible()
  await page.getByTestId('viewer-diff-toggle').click()
  await expect(page.locator('.editor.modified')).toContainText('43', { timeout: 20_000 })
  await page.screenshot({ path: join(SHOTS, 'dev-smoke-cycle-1-diff.png') })

  await page.getByRole('button', { name: 'close viewer' }).click()
  await page.screenshot({ path: join(SHOTS, 'dev-smoke-cycle-1-final.png'), fullPage: true })

  await app.close()
})
