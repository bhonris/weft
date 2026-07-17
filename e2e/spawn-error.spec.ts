import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect, _electron as electron } from '@playwright/test'
import { launchWeft } from './helpers'

const MAIN = join(process.cwd(), 'dist-electron', 'main', 'index.js')

test('a missing claude binary shows an actionable error with Retry — no crash', async () => {
  const app = await launchWeft({
      WEFT_E2E_OPEN_DIR: mkdtempSync(join(tmpdir(), 'weft-noclaude-')),
      // Default command (claude), but pointed at a binary that cannot exist.
      WEFT_CLAUDE_BIN: 'weft-definitely-not-a-real-binary.exe'
    })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  await page.getByRole('button', { name: 'open project' }).click()

  // The actionable error state appears; the app did not crash and no tab opened.
  const banner = page.getByTestId('spawn-error')
  await expect(banner).toBeVisible()
  await expect(banner).toContainText('is the `claude` CLI installed')
  await expect(banner.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(page.getByTestId('tab')).toHaveCount(0)

  // Retry with the binary still missing keeps the banner (and still no crash).
  await banner.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByTestId('spawn-error')).toBeVisible()
  await expect(page.getByTestId('tab')).toHaveCount(0)

  // The banner can be dismissed and the app remains usable.
  await page.getByRole('button', { name: 'dismiss error' }).click()
  await expect(page.getByTestId('spawn-error')).toHaveCount(0)
  await expect(page.getByTestId('tab-strip')).toBeVisible()

  await app.close()
})

test('the theme toggle cycles system → light → dark and applies to the document', async () => {
  const app = await launchWeft({
      WEFT_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'weft-ud-'))
    })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  const themeAttr = (): Promise<string | undefined> =>
    page.evaluate(() => document.documentElement.dataset['theme'])

  await expect.poll(themeAttr).toBe('system')

  await page.getByRole('button', { name: /^theme:/ }).click()
  await expect.poll(themeAttr).toBe('light')
  // Light vars actually applied.
  const bgLight = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  )
  expect(bgLight).toBe('#ffffff')

  await page.getByRole('button', { name: /^theme:/ }).click()
  await expect.poll(themeAttr).toBe('dark')

  await app.close()
})
