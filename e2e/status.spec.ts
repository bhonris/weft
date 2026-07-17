import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { connect } from 'node:net'
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

const MAIN = join(process.cwd(), 'dist-electron', 'main', 'index.js')

let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  app = await electron.launch({
    args: [MAIN],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      WEFT_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'weft-ud-')),
      WEFT_E2E_OPEN_DIR: mkdtempSync(join(tmpdir(), 'weft-status-')),
      WEFT_OPEN_PROJECT_COMMAND: 'shell'
    }
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterEach(async () => {
  await app.close()
})

/** Send one NDJSON hook payload to the app's real named-pipe/UDS endpoint. */
function sendHookPayload(endpoint: string, payload: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = connect(endpoint, () => {
      sock.end(JSON.stringify(payload) + '\n', () => resolve())
    })
    sock.on('error', reject)
  })
}

test('hook payloads over the named pipe drive the tab badge: waiting → working → done', async () => {
  // Open a project (shell session) through the real UI.
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('tab')).toHaveCount(1)

  // Main-process introspection: endpoint + the tab's pinned session identity.
  const endpoint: string = await app.evaluate(() => {
    const g = globalThis as unknown as { __weft: { statusEndpoint: string } }
    return g.__weft.statusEndpoint
  })
  const ref = await app.evaluate(() => {
    const g = globalThis as unknown as {
      __weft: { tabRefs: () => Array<{ tabId: string; sessionId: string; cwd: string }> }
    }
    return g.__weft.tabRefs()[0]
  })
  expect(endpoint).toContain('weft-status-')
  expect(ref).toBeTruthy()

  // The endpoint must be a pipe/UDS path, never a TCP host:port.
  expect(endpoint).not.toMatch(/^\d+$|:\d+$/)

  // permission_prompt → waiting badge (the "needs you" signal).
  await sendHookPayload(endpoint, {
    event: 'Notification',
    notification_type: 'permission_prompt',
    session_id: ref!.sessionId,
    message: 'Allow tool?'
  })
  await expect(page.locator('.tab__badge--waiting')).toBeVisible()

  // UserPromptSubmit → working.
  await sendHookPayload(endpoint, { event: 'UserPromptSubmit', session_id: ref!.sessionId })
  await expect(page.locator('.tab__badge--working')).toBeVisible()

  // Stop → done.
  await sendHookPayload(endpoint, { event: 'Stop', session_id: ref!.sessionId })
  await expect(page.locator('.tab__badge--done')).toBeVisible()
})

test('a payload with an unknown session id changes nothing', async () => {
  await page.getByRole('button', { name: 'open project' }).click()
  await expect(page.getByTestId('tab')).toHaveCount(1)

  const endpoint: string = await app.evaluate(() => {
    const g = globalThis as unknown as { __weft: { statusEndpoint: string } }
    return g.__weft.statusEndpoint
  })

  await sendHookPayload(endpoint, {
    event: 'Notification',
    notification_type: 'permission_prompt',
    session_id: 'not-a-real-session'
  })

  // Badge stays at the spawn default (unknown) — no waiting badge appears.
  await expect(page.locator('.tab__badge--waiting')).toHaveCount(0)
  await expect(page.locator('.tab__badge--unknown')).toBeVisible()
})
