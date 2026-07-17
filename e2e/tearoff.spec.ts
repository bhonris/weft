import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect, _electron as electron } from '@playwright/test'
import { launchWeft } from './helpers'

const MAIN = join(process.cwd(), 'dist-electron', 'main', 'index.js')

test('tear-off moves the tab to its own window with the SAME PTY, and re-docks on close', async () => {
  // Boots two shells and round-trips three echoes — needs more than the default.
  test.setTimeout(120_000)
  const app = await launchWeft({
      WEFT_E2E_OPEN_DIR: mkdtempSync(join(tmpdir(), 'weft-tear-')),
      WEFT_OPEN_PROJECT_COMMAND: 'shell'
    })
  const main = await app.firstWindow()
  await main.waitForLoadState('domcontentloaded')

  // Open a session and leave a distinctive marker in its scrollback.
  await main.getByRole('button', { name: 'open project' }).click()
  await main.locator('.terminal-pane .xterm').click()
  await main.keyboard.type('echo tearoff-marker')
  await main.keyboard.press('Enter')
  await expect(main.locator('.terminal-pane')).toContainText('tearoff-marker', {
    timeout: 20_000
  })

  const before = await app.evaluate(() => {
    const g = globalThis as unknown as {
      __weft: {
        tabRefs: () => Array<{ tabId: string }>
        pidOf: (id: string) => number | undefined
      }
    }
    const tabId = g.__weft.tabRefs()[0]!.tabId
    return { tabId, pid: g.__weft.pidOf(tabId) }
  })
  expect(before.pid).toBeGreaterThan(0)

  // Tear off: the tab leaves the main strip and a second window appears.
  await main.getByRole('button', { name: /tear off/ }).click()
  await expect(main.getByTestId('tab')).toHaveCount(0)

  await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBe(2)
  const tear = app.windows().find((w) => w.url().includes('tearoff='))!
  expect(tear).toBeTruthy()
  await tear.waitForLoadState('domcontentloaded')

  // The torn-off window re-attached to the same session: scrollback replayed…
  await expect(tear.getByTestId('tearoff-shell')).toBeVisible()
  await expect(tear.locator('.terminal-pane')).toContainText('tearoff-marker', {
    timeout: 20_000
  })
  // …and it is still interactive.
  await tear.locator('.terminal-pane .xterm').click()
  await tear.keyboard.type('echo still-alive-torn-off')
  await tear.keyboard.press('Enter')
  await expect(tear.locator('.terminal-pane')).toContainText('still-alive-torn-off', {
    timeout: 20_000
  })

  // Same PTY process — tear-off never respawned the session.
  const after = await app.evaluate((_electronMod, tabId) => {
    const g = globalThis as unknown as { __weft: { pidOf: (id: string) => number | undefined } }
    return g.__weft.pidOf(tabId)
  }, before.tabId)
  expect(after).toBe(before.pid)

  // Closing the torn-off window re-docks the tab into the main strip.
  await tear.close()
  await expect(main.getByTestId('tab')).toHaveCount(1)
  // Still the same live session: the replayed buffer carries both markers.
  await expect(main.locator('.terminal-pane')).toContainText('still-alive-torn-off', {
    timeout: 20_000
  })

  await app.close()
})
