import { join } from 'node:path'
import { mkdtempSync, writeFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchWeft } from './helpers'

let app: ElectronApplication
let page: Page
let projectDir: string

test.beforeEach(async () => {
  // Git fixture: a committed baseline, then a modified file + an untracked file,
  // so the Source Control panel shows both a "Changes" and an "Untracked" group.
  // realpath the temp dir: on Windows CI `os.tmpdir()` can be an 8.3 short path
  // (e.g. RUNNER~1) while git's `--show-toplevel` returns the long canonical
  // form, so the two spellings wouldn't match the write-guard when staging.
  // (In production the OS dir picker already yields the canonical path.)
  projectDir = realpathSync(mkdtempSync(join(tmpdir(), 'weft-scm-')))
  const git = (...args: string[]): void => {
    execFileSync('git', args, { cwd: projectDir })
  }
  writeFileSync(join(projectDir, 'story.txt'), 'line one\nline two\n')
  git('init', '-q')
  git('-c', 'user.email=lab@weft.test', '-c', 'user.name=Weft Lab', 'add', '.')
  git('-c', 'user.email=lab@weft.test', '-c', 'user.name=Weft Lab', 'commit', '-q', '-m', 'baseline')
  // Now dirty the tree: modify the tracked file and add an untracked one.
  writeFileSync(join(projectDir, 'story.txt'), 'line one\nline two CHANGED\nline three\n')
  writeFileSync(join(projectDir, 'notes.md'), '# scratch\n')

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

test('Source Control panel: shows changes, stages, commits, and opens a diff', async () => {
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('explorer-tree')).toBeVisible()

  // Switch to the Source Control panel via the activity bar.
  await page.getByTestId('activity-scm').click()
  await expect(page.getByTestId('scm-panel')).toBeVisible()

  // The modified tracked file is under "Changes"; the new file is "Untracked".
  await expect(page.getByTestId('scm-group-unstaged')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('scm-row-unstaged-story.txt')).toBeVisible()
  await expect(page.getByTestId('scm-group-untracked')).toBeVisible()
  await expect(page.getByTestId('scm-row-untracked-notes.md')).toBeVisible()

  // The activity-bar badge reflects the number of changed files (2).
  await expect(page.getByTestId('activity-scm-badge')).toHaveText('2')

  // Clicking the file opens its diff in the Monaco viewer (working-tree vs index).
  await page.getByRole('button', { name: 'Open diff for story.txt' }).click()
  await expect(page.getByTestId('viewer-pane')).toBeVisible()
  await expect(page.getByTestId('viewer-editor').locator('.editor.original')).toBeVisible({
    timeout: 20_000
  })

  // Stage the modified file → it moves into "Staged Changes".
  await page.getByRole('button', { name: 'Stage story.txt' }).click()
  await expect(page.getByTestId('scm-group-staged')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('scm-row-staged-story.txt')).toBeVisible()

  // Commit the staged change → the staged group disappears.
  await page.getByTestId('scm-commit-msg').fill('test: modify story')
  await page.getByTestId('scm-commit').click()
  await expect(page.getByTestId('scm-group-staged')).toHaveCount(0, { timeout: 10_000 })
  // story.txt is committed and gone from the change list; notes.md is still untracked.
  await expect(page.getByTestId('scm-row-unstaged-story.txt')).toHaveCount(0)
  await expect(page.getByTestId('scm-row-untracked-notes.md')).toBeVisible()
})
