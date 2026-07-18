import { join } from 'node:path'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchWeft } from './helpers'

/**
 * Expansion 6 — the mouseless proof. This spec drives a full journey using the
 * KEYBOARD ONLY: it never calls .click() / mouse APIs. If any step needed the
 * mouse, the keyboard-only experience would be incomplete and this would fail.
 */

let app: ElectronApplication
let page: Page
let projectDir: string

test.beforeEach(async () => {
  projectDir = mkdtempSync(join(tmpdir(), 'weft-kbd-'))
  writeFileSync(join(projectDir, 'hello.txt'), 'hi weft')
  mkdirSync(join(projectDir, 'sub'))
  writeFileSync(join(projectDir, 'sub', 'nested.md'), '# nested')

  app = await launchWeft({
    WEFT_E2E_OPEN_DIR: projectDir,
    WEFT_OPEN_PROJECT_COMMAND: 'shell' // no real `claude` boot in E2E
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  // Wait until the shell has mounted (and its window keydown listener is
  // attached) before sending any chord — domcontentloaded can precede React.
  await expect(page.getByTestId('status-bar')).toBeVisible()
})

test.afterEach(async () => {
  await app.close()
})

test('a complete session is driven with the keyboard only (no mouse)', async () => {
  // 1) Open a tab from the command palette — no clicking the + button.
  await page.keyboard.press('Control+Shift+P')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.keyboard.type('new shell tab')
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('tab')).toHaveCount(1)
  await expect(page.getByTestId('terminal-pane')).toBeVisible()
  await expect(page.getByTestId('explorer-tree')).toBeVisible()
  await expect(page.getByText('hello.txt')).toBeVisible()

  // 2) Focus the explorer and open hello.txt with arrows + Enter.
  //    'sub' (a directory) sorts first, so ArrowDown lands on hello.txt.
  await page.keyboard.press('Control+Shift+E')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('viewer-pane')).toBeVisible()
  await expect(page.getByTestId('viewer-pane')).toContainText('hello.txt')

  // 3) Focus the terminal and type — normal keys reach the PTY (echo appears).
  await page.keyboard.press('Control+`')
  await page.keyboard.type('echo weft-kbd-journey')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('terminal-host')).toContainText('weft-kbd-journey', {
    timeout: 20_000
  })

  // 4) A terminal-bound chord (Ctrl+C) reaches the PTY, not an app shortcut:
  //    the tab is not closed and the terminal stays interactive.
  await page.keyboard.press('Control+C')
  await page.keyboard.type('echo still-alive')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('terminal-host')).toContainText('still-alive', { timeout: 20_000 })
  await expect(page.getByTestId('tab')).toHaveCount(1)

  // 5) Cycle the theme from the palette; <html data-theme> changes.
  const before = await page.evaluate(() => document.documentElement.dataset['theme'])
  await page.keyboard.press('Control+Shift+P')
  await page.keyboard.type('cycle theme')
  await page.keyboard.press('Enter')
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset['theme']))
    .not.toBe(before)

  // 6) The in-app cheat-sheet opens on Ctrl+? and is the COMPLETE reference:
  //    commands, palette-only actions, and region-local keys (explorer/terminal).
  await page.keyboard.press('Control+Shift+/')
  const help = page.getByTestId('keyboard-help')
  await expect(help).toBeVisible()
  await expect(help).toContainText('Command Palette')
  await expect(help).toContainText('Explorer')
  await expect(help).toContainText('Expand folder / step in')
  await expect(help).toContainText('Terminal')
  await page.screenshot({ path: 'screenshots/keyboard-help-overlay.png' })
  await page.keyboard.press('Escape')
  await expect(help).toBeHidden()
})

test('keyboard focus shows a visible focus ring', async () => {
  await page.keyboard.press('Control+Shift+P')
  await page.keyboard.type('new shell tab')
  await page.keyboard.press('Enter')
  await expect(page.getByText('hello.txt')).toBeVisible()

  // Move keyboard focus onto an explorer node; :focus-visible must render a ring.
  await page.keyboard.press('Control+Shift+E')
  await page.keyboard.press('ArrowDown')
  const outlineWidth = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    return el ? getComputedStyle(el).outlineWidth : '0px'
  })
  expect(outlineWidth).not.toBe('0px')
})
