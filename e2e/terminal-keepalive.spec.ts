import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test, expect } from '@playwright/test'
import { launchWeft } from './helpers'

/**
 * Regression guard for the tab-switch corruption bug: switching tabs used to
 * unmount the active `TerminalPane` and mount a fresh xterm for the newly-active
 * tab (`<TerminalPane key={activeTabId}>`), rebuilding the screen from a lossy
 * ring-buffer replay every time — which garbles a full-screen TUI like Claude.
 *
 * The fix mounts EVERY tab's terminal at once and hides the inactive ones. This
 * test asserts that structure: with two tabs open, two `.terminal-pane` elements
 * exist, exactly one is visible, switching flips which is hidden, and the typed
 * contents of a tab survive a round-trip (the xterm was never rebuilt).
 */
test('switching tabs keeps every terminal mounted and preserves its screen', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'weft-ud-'))
  const projectDir = mkdtempSync(join(tmpdir(), 'weft-proj-'))

  const app = await launchWeft({
    WEFT_USER_DATA_DIR: userDataDir,
    WEFT_E2E_OPEN_DIR: projectDir,
    WEFT_OPEN_PROJECT_COMMAND: 'shell'
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  // Two shell tabs.
  await page.getByRole('button', { name: 'open project' }).click()
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('tab')).toHaveCount(2)

  // The heart of the fix: BOTH terminals are mounted simultaneously, and exactly
  // one is on screen (the other carries the `hidden` attribute).
  await expect(page.locator('.terminal-pane')).toHaveCount(2)
  await expect(page.locator('.terminal-pane:not([hidden])')).toHaveCount(1)
  await expect(page.locator('.terminal-pane[hidden]')).toHaveCount(1)

  // Type a marker into the active terminal (tab 2, the last opened). The shell
  // echoes it, so it lands on screen without pressing Enter.
  const marker = 'WEFT_KEEPALIVE_MARKER'
  await page.locator('.terminal-pane:not([hidden]) .xterm').click()
  await page.keyboard.type(marker)
  await expect(page.locator('.terminal-pane:not([hidden])')).toContainText(marker)

  // Switch to tab 1: the marker's pane is now the hidden one.
  await page.getByTestId('tab').first().click()
  await expect(page.locator('.terminal-pane:not([hidden])')).toHaveCount(1)
  await expect(page.locator('.terminal-pane:not([hidden])')).not.toContainText(marker)

  // Switch back to tab 2: the marker is STILL there — the terminal was hidden and
  // re-shown, never disposed and rebuilt from a snapshot.
  await page.getByTestId('tab').nth(1).click()
  await expect(page.locator('.terminal-pane:not([hidden])')).toContainText(marker)

  await app.close()
})
