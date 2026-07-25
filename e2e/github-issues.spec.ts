import { join } from 'node:path'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { launchWeft } from './helpers'

// The Issues panel's network + auth paths are exhaustively unit-tested (77 cases
// across core/services/ipc/store). These E2E cases cover only what needs the real
// app wired end-to-end and stay fully offline: the temp project below is NOT a git
// repo, so `getIssues` resolves `repo: null` and the panel shows its "not a GitHub
// repository" empty state — no api.github.com call is ever made.

function launch(userDataDir: string, projectDir: string): Promise<ElectronApplication> {
  return launchWeft({
    WEFT_USER_DATA_DIR: userDataDir,
    WEFT_E2E_OPEN_DIR: projectDir,
    WEFT_OPEN_PROJECT_COMMAND: 'shell'
  })
}

test('the GitHub Issues tab appears and shows the not-a-repo empty state', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'weft-ud-'))
  const projectDir = mkdtempSync(join(tmpdir(), 'weft-gh-'))
  // A file so the explorer renders its tree (an empty folder shows a placeholder);
  // the dir is deliberately NOT a git repo, so the Issues panel stays not-a-repo.
  writeFileSync(join(projectDir, 'readme.txt'), 'weft')

  const app = await launch(userDataDir, projectDir)
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('explorer-tree')).toBeVisible()

  // A third activity-bar tab labeled "GitHub Issues" exists (AC 1). Explorer is
  // the default, so Issues starts unselected.
  const issuesTab = page.getByTestId('activity-issues')
  await expect(issuesTab).toHaveAttribute('aria-label', 'GitHub Issues')
  await expect(issuesTab).toHaveAttribute('aria-selected', 'false')

  // Selecting it reveals the panel; a plain temp dir is not a git repo, so the
  // panel degrades to a clear empty state rather than erroring (AC 3).
  await issuesTab.click()
  await expect(issuesTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('issues-panel')).toBeVisible()
  const notRepo = page.getByTestId('issues-not-repo')
  await expect(notRepo).toBeVisible()
  await expect(notRepo).toContainText('Not a GitHub repository')
  // No repo header, no auth banner, no issue list in this state.
  await expect(page.getByTestId('issues-repo')).toHaveCount(0)
  await expect(page.getByTestId('issues-list')).toHaveCount(0)

  await app.close()
})

test('the active Issues panel choice survives an app restart', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'weft-ud-'))
  const projectDir = mkdtempSync(join(tmpdir(), 'weft-gh-'))
  writeFileSync(join(projectDir, 'readme.txt'), 'weft')

  // ── Run 1: open a project, switch the sidebar to GitHub Issues. ───────────
  const app1 = await launch(userDataDir, projectDir)
  const page1 = await app1.firstWindow()
  await page1.waitForLoadState('domcontentloaded')
  await page1.getByRole('button', { name: 'open project' }).click()
  await expect(page1.getByTestId('explorer-tree')).toBeVisible()

  await page1.getByTestId('activity-issues').click()
  await expect(page1.getByTestId('issues-panel')).toBeVisible()

  // Wait until the choice actually lands in the workspace blob on disk (AC 1).
  const configPath = join(userDataDir, 'config.json')
  await expect
    .poll(
      () => {
        try {
          return /"activePanel":\s*"issues"/.test(readFileSync(configPath, 'utf8'))
        } catch {
          return false
        }
      },
      { timeout: 10_000 }
    )
    .toBe(true)
  await app1.close()

  // ── Run 2: same userData → the Issues panel is active on its own. ─────────
  const app2 = await launch(userDataDir, projectDir)
  const page2 = await app2.firstWindow()
  await page2.waitForLoadState('domcontentloaded')

  await expect(page2.getByTestId('activity-issues')).toHaveAttribute('aria-selected', 'true')
  await expect(page2.getByTestId('issues-panel')).toBeVisible()

  await app2.close()
})
