import { execSync } from 'node:child_process'
import { test, expect } from '@playwright/test'
import { launchWeft, tempDir } from './helpers'

/**
 * THE test that was missing for 33 leaps: spawn the REAL `claude` binary
 * through the real UI. Every other spec deliberately substitutes a shell or a
 * fake binary (right call for determinism/cost) — but that must never again
 * mean the actual claude spawn path ships unexercised. This boots claude far
 * enough to prove ConPTY spawn + TUI output; it sends NO prompt (no tokens).
 *
 * Skips on machines without claude (e.g. CI) — locally it must run.
 */
function claudeOnPath(): boolean {
  try {
    execSync('where claude', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

test('the real claude CLI spawns in a tab: no error banner, TUI output arrives', async () => {
  test.skip(!claudeOnPath(), 'claude CLI not installed on this machine')
  test.setTimeout(120_000)

  const app = await launchWeft({
    WEFT_E2E_OPEN_DIR: tempDir('weft-realclaude-')
    // NOTE: no WEFT_OPEN_PROJECT_COMMAND and no WEFT_CLAUDE_BIN — this is the
    // untouched production path: default command 'claude', resolved binary.
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  await page.getByRole('button', { name: 'open project' }).click()

  // The spawn must succeed: a tab, no error banner.
  await expect(page.getByTestId('tab')).toHaveCount(1)
  await expect(page.getByTestId('spawn-error')).toHaveCount(0)

  // And the real claude process must produce terminal output (its TUI draws
  // *something* — banner, trust prompt, or prompt box — within the timeout).
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const pane = document.querySelector('.terminal-pane')
          return (pane?.textContent ?? '').trim().length
        }),
      { timeout: 60_000 }
    )
    .toBeGreaterThan(20)

  // Still no error banner after boot, and closing the tab kills it cleanly.
  await expect(page.getByTestId('spawn-error')).toHaveCount(0)
  await page.getByRole('button', { name: /^close / }).click()
  await expect(page.getByTestId('tab')).toHaveCount(0)

  await app.close()
})
