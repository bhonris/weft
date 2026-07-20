import { defineConfig } from '@playwright/test'

/**
 * Playwright config for Weft's Electron E2E suite.
 *
 * These tests launch the REAL built Electron app (main + preload + renderer +
 * node-pty) via Playwright's `_electron` driver — the only way to verify the
 * IPC/PTY/reload behaviour that the MCP browser cannot reach. Run with
 * `pnpm test:e2e` (which builds first).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  // Real-Electron + node-pty tests are green locally but occasionally race the
  // OS on the slow, headless CI runner (focus/PTY-redraw timing). Retry only on
  // CI so a single timing flake doesn't red the whole job; keep 0 locally so a
  // genuine local failure is never hidden.
  retries: process.env['CI'] ? 2 : 0,
  // On CI also emit the HTML report so failures are downloadable as an artifact.
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : [['list']],
  forbidOnly: !!process.env['CI']
})
