import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { test, expect, _electron as electron } from '@playwright/test'
import { launchEnv, tempDir } from './helpers'

const PACKAGED_EXE = join(process.cwd(), 'release', 'win-unpacked', 'Weft.exe')

/**
 * Drives the PACKAGED app (electron-builder output), not the dev build —
 * catches asar/unpack/native-module packaging mistakes that dist-electron
 * tests cannot. Skipped when no unpacked build exists (run `pnpm package:dir`).
 */
test('the packaged Weft.exe launches and runs a live shell session', async () => {
  test.skip(!existsSync(PACKAGED_EXE), 'no unpacked build — run pnpm package:dir first')
  test.setTimeout(90_000)

  const app = await electron.launch({
    executablePath: PACKAGED_EXE,
    env: launchEnv({
      WEFT_E2E_OPEN_DIR: tempDir('weft-packaged-'),
      WEFT_OPEN_PROJECT_COMMAND: 'shell'
    })
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  await expect(page.getByTestId('tab-strip')).toBeVisible()
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.locator('.terminal-pane .xterm')).toBeVisible()

  // The packaged node-pty (asarUnpacked, ConPTY dlls) must actually spawn.
  await page.locator('.terminal-pane .xterm').click()
  await page.keyboard.type('echo packaged-weft-works')
  await page.keyboard.press('Enter')
  await expect(page.locator('.terminal-pane')).toContainText('packaged-weft-works', {
    timeout: 25_000
  })

  await app.close()
})
