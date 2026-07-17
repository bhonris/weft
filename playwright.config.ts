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
  reporter: [['list']],
  forbidOnly: !!process.env['CI']
})
