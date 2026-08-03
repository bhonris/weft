import { join } from 'node:path'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect } from '@playwright/test'
import { launchWeft } from './helpers'

/**
 * Terminal file links: a path printed in the terminal becomes a Ctrl+Click link
 * that opens the file in the viewer (VS Code behaviour). Uses a `shell` session
 * and `echo` so a bare `README.md` lands on its own output row at column 0,
 * giving a deterministic cell to click. This exercises the whole adapter path —
 * link provider → parseFileLinks → resolveClickedPath → pathExists → openFileAt —
 * which is deliberately not unit-tested (DOM/xterm-bound).
 */
test('Ctrl+Click on a printed path opens the file in the viewer', async () => {
  test.setTimeout(120_000)

  const projectDir = mkdtempSync(join(tmpdir(), 'weft-links-'))
  writeFileSync(join(projectDir, 'README.md'), '# hello from a terminal link\n')

  const app = await launchWeft({
    WEFT_E2E_OPEN_DIR: projectDir,
    WEFT_OPEN_PROJECT_COMMAND: 'shell'
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  await page.getByRole('button', { name: 'open project' }).click()
  const xterm = page.locator('.terminal-pane .xterm')
  await expect(xterm).toBeVisible()
  await xterm.click()

  // Print the path on its own line, then wait for the echoed output row.
  await page.keyboard.type('echo README.md')
  await page.keyboard.press('Enter')
  await expect(page.locator('.terminal-pane')).toContainText('README.md', { timeout: 20_000 })

  // Locate the OUTPUT row (exactly "README.md", not the "echo README.md" command
  // row) and compute a click point a few cells into the token (col 0 start).
  let point: { x: number; y: number } | null = null
  await expect(async () => {
    point = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.xterm-rows > div'))
      for (const row of rows) {
        if ((row.textContent ?? '').trim() === 'README.md') {
          const r = row.getBoundingClientRect()
          return { x: Math.round(r.left + 20), y: Math.round(r.top + r.height / 2) }
        }
      }
      return null
    })
    expect(point).not.toBeNull()
  }).toPass({ timeout: 20_000 })
  point = point!

  // Hold Ctrl, hover so the link provider resolves (existence check is async),
  // then Ctrl+Click to activate.
  await page.keyboard.down('Control')
  await page.mouse.move(point.x, point.y)
  await page.waitForTimeout(500)
  await page.mouse.click(point.x, point.y)
  await page.keyboard.up('Control')

  // The viewer opened README.md.
  await expect(page.getByTestId('viewer-pane')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('viewer-tabs')).toContainText('README.md')

  await app.close()
})
