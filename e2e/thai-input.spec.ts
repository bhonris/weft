import { join } from 'node:path'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect } from '@playwright/test'
import { launchWeft } from './helpers'

const SHOTS = join(process.cwd(), 'screenshots')

/**
 * Manual verification for the Thai-tofu fix: type Thai into a live terminal
 * (the user's exact scenario) and prove (a) the characters reach the xterm DOM
 * intact — confirming the UTF-8 path is clean — and (b) the terminal's computed
 * font-family now carries a Thai-capable fallback. The screenshot lets a human
 * confirm the glyphs render rather than showing as boxes.
 */
test('typed Thai renders in the terminal with a Thai-capable font', async () => {
  test.setTimeout(120_000)
  mkdirSync(SHOTS, { recursive: true })

  const projectDir = mkdtempSync(join(tmpdir(), 'weft-thai-'))
  writeFileSync(join(projectDir, 'README.md'), '# thai demo\n')

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

  const THAI = 'สวัสดีครับ ทดสอบภาษาไทย'
  await page.keyboard.type(THAI)

  // (a) the exact Thai codepoints made it into the rendered terminal rows —
  // proves the byte path is UTF-8-clean end to end.
  await expect(page.locator('.terminal-pane')).toContainText('สวัสดีครับ', {
    timeout: 20_000
  })

  // (b) the fix is actually applied: the xterm rows use the new font stack,
  // which must include a Thai-capable family.
  const fontFamily = await page
    .locator('.terminal-pane .xterm-rows')
    .evaluate((el) => getComputedStyle(el).fontFamily)
  console.log('terminal font-family:', fontFamily)
  expect(fontFamily.toLowerCase()).toMatch(/chakra petch|leelawadee|tahoma|noto sans thai/)

  await page.screenshot({ path: join(SHOTS, 'thai-input.png') })
  await app.close()
})
