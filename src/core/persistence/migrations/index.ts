import { WORKSPACE_VERSION } from '../schema'
import { v0ToV1 } from './v0-to-v1'

export type Migration = (blob: Record<string, unknown>) => Record<string, unknown>

/** Ordered chain: key N migrates a version-N blob to version N+1. */
export const migrations: Record<number, Migration> = {
  0: v0ToV1
}

/**
 * Run the migration chain, upgrading `blob` from `fromVersion` to the current
 * {@link WORKSPACE_VERSION}. Throws if a required migration step is missing.
 */
export function migrate(
  blob: Record<string, unknown>,
  fromVersion: number
): Record<string, unknown> {
  let current = blob
  for (let v = fromVersion; v < WORKSPACE_VERSION; v++) {
    const step = migrations[v]
    if (!step) {
      throw new Error(`No migration registered for version ${v}`)
    }
    current = step(current)
  }
  return current
}

