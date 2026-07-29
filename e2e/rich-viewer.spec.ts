import { join } from 'node:path'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchWeft } from './helpers'

let app: ElectronApplication
let page: Page
let projectDir: string

// A 1×1 red PNG — enough to prove the weft-file:// protocol streamed real bytes
// end-to-end (main → Chromium decode → non-zero naturalWidth).
const RED_DOT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

test.beforeEach(async () => {
  projectDir = mkdtempSync(join(tmpdir(), 'weft-rich-'))
  writeFileSync(join(projectDir, 'pixel.png'), RED_DOT_PNG)
  writeFileSync(join(projectDir, 'table.csv'), 'Name,Age\nAda,36\nAlan,41\n')
  writeFileSync(join(projectDir, 'bundle.zip'), Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))

  app = await launchWeft({
    WEFT_E2E_OPEN_DIR: projectDir,
    WEFT_OPEN_PROJECT_COMMAND: 'shell'
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('explorer-tree')).toBeVisible()
})

test.afterEach(async () => {
  await app.close()
})

test('an image renders via the weft-file protocol (real bytes decoded)', async () => {
  await page.getByText('pixel.png').click()
  await expect(page.getByTestId('viewer-image')).toBeVisible()

  const img = page.locator('.viewer__image')
  await expect(img).toBeVisible()
  // The protocol actually served decodable bytes: the image completed loading.
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), {
      timeout: 15_000
    })
    .toBeGreaterThan(0)
})

test('a CSV renders as a table', async () => {
  await page.getByText('table.csv').click()
  const tableView = page.getByTestId('viewer-table')
  await expect(tableView).toBeVisible({ timeout: 15_000 })
  await expect(tableView.getByRole('columnheader', { name: 'Name' })).toBeVisible()
  await expect(tableView.getByText('Ada')).toBeVisible()
  await expect(tableView.getByText('Alan')).toBeVisible()
})

test('an unsupported binary shows the placeholder, not garbage bytes', async () => {
  await page.getByText('bundle.zip').click()
  const placeholder = page.getByTestId('viewer-unsupported')
  await expect(placeholder).toBeVisible()
  await expect(placeholder).toContainText('No in-app preview')
  await expect(placeholder.getByText('Open with default app')).toBeVisible()
  // No Monaco editor is mounted for a binary file.
  await expect(page.getByTestId('viewer-editor')).toHaveCount(0)
})
