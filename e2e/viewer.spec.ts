import { join } from 'node:path'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { launchWeft } from './helpers'

const MAIN = join(process.cwd(), 'dist-electron', 'main', 'index.js')

let app: ElectronApplication
let page: Page
let projectDir: string

test.beforeEach(async () => {
  // Git fixture: one committed file, then modified — so "Diff vs HEAD" is real.
  projectDir = mkdtempSync(join(tmpdir(), 'weft-viewer-'))
  const git = (...args: string[]): void => {
    execFileSync('git', args, { cwd: projectDir })
  }
  writeFileSync(join(projectDir, 'story.txt'), 'line one\nline two\n')
  git('init', '-q')
  git('-c', 'user.email=lab@weft.test', '-c', 'user.name=Weft Lab', 'add', '.')
  git(
    '-c', 'user.email=lab@weft.test', '-c', 'user.name=Weft Lab',
    'commit', '-q', '-m', 'baseline'
  )
  writeFileSync(join(projectDir, 'story.txt'), 'line one\nline two CHANGED BY CLAUDE\nline three\n')

  app = await launchWeft({
      WEFT_E2E_OPEN_DIR: projectDir,
      WEFT_OPEN_PROJECT_COMMAND: 'shell'
    })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterEach(async () => {
  await app.close()
})

test('clicking a file opens the read-only Monaco viewer; Diff vs HEAD shows the change', async () => {
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('explorer-tree')).toBeVisible()

  // The status bar shows the fixture repo's git branch for the active tab.
  await expect(page.getByTestId('git-branch')).toContainText(/⎇ (master|main)/, {
    timeout: 10_000
  })

  // Open the file in the viewer.
  await page.getByText('story.txt').click()
  await expect(page.getByTestId('viewer-pane')).toBeVisible()
  // Monaco renders the file content (current, modified version).
  await expect(page.getByTestId('viewer-editor')).toContainText('CHANGED BY CLAUDE', {
    timeout: 20_000
  })

  // Switch to diff mode: side-by-side original (HEAD) vs modified.
  await page.getByTestId('viewer-diff-toggle').click()
  const editor = page.getByTestId('viewer-editor')
  await expect(editor.locator('.editor.original')).toBeVisible({ timeout: 20_000 })
  await expect(editor.locator('.editor.modified')).toBeVisible()
  await expect(editor.locator('.editor.modified')).toContainText('CHANGED BY CLAUDE')
  // The HEAD side shows the pre-change content ("line two" without the suffix).
  await expect(editor.locator('.editor.original')).toContainText('line two')

  // Close the viewer; the terminal is still there and alive.
  await page.getByRole('button', { name: 'close viewer' }).click()
  await expect(page.getByTestId('viewer-pane')).toHaveCount(0)
  await expect(page.locator('.terminal-pane .xterm')).toBeVisible()
})

test('Edit mode: type into the file, Ctrl+S writes it to disk, dirty dot clears', async () => {
  await page.getByRole('button', { name: 'open project' }).click()
  await page.getByText('story.txt').click()
  await expect(page.getByTestId('viewer-pane')).toBeVisible()

  // Enter edit mode and type at the top of the file.
  await page.getByTestId('viewer-edit-toggle').click()
  await expect(page.getByTestId('viewer-editor')).toContainText('line one', { timeout: 20_000 })
  await page.locator('.viewer__editor .monaco-editor').click()
  await page.keyboard.press('Control+Home')
  await page.keyboard.type('EDITED-BY-WEFT ')

  // Dirty indicator appears, then clears on Ctrl+S.
  await expect(page.getByTestId('viewer-dirty')).toBeVisible()
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('viewer-dirty')).toHaveCount(0, { timeout: 10_000 })

  // The bytes actually landed on disk.
  await expect
    .poll(() => readFileSync(join(projectDir, 'story.txt'), 'utf8'))
    .toContain('EDITED-BY-WEFT')
})
