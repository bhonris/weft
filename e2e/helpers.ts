import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { _electron as electron, type ElectronApplication } from '@playwright/test'

export const MAIN = join(process.cwd(), 'dist-electron', 'main', 'index.js')

/**
 * Environment for launching the app under test: inherits the host env but
 * STRIPS every `WEFT_*` variable first, so a developer's shell configuration
 * can never change test behavior. Pass only the seams the test needs.
 */
export function launchEnv(overrides: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !key.startsWith('WEFT_')) env[key] = value
  }
  return {
    ...env,
    NODE_ENV: 'production',
    WEFT_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'weft-ud-')),
    ...overrides
  }
}

export const tempDir = (prefix: string): string => mkdtempSync(join(tmpdir(), prefix))

/** Launch the built app with a clean, WEFT_*-stripped environment. */
export function launchWeft(overrides: Record<string, string> = {}): Promise<ElectronApplication> {
  return electron.launch({ args: [MAIN], env: launchEnv(overrides) })
}
