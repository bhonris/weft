import type { WorkspaceState } from '@shared/ipc/api-contract'
import { type Result, ok, err } from '@shared/result'
import { workspaceStateSchema } from './schema'
import { migrate } from './migrations'
import { defaultWorkspace } from './default-workspace'

export interface LoadedWorkspace {
  state: WorkspaceState
  /** The version the raw blob was stored at, before migration. */
  fromVersion: number
  /** True when the migration chain changed the shape. */
  migrated: boolean
}

function readVersion(blob: Record<string, unknown>): number {
  const v = blob['version']
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0
}

/**
 * Parse a raw persisted value into a validated {@link WorkspaceState}, running
 * the migration chain as needed. A nullish blob yields a fresh default; a
 * present-but-invalid blob is an error the caller can fall back from.
 */
export function loadWorkspace(raw: unknown): Result<LoadedWorkspace, string> {
  if (raw === null || raw === undefined) {
    return ok({ state: defaultWorkspace(), fromVersion: WORKSPACE_VERSION_FOR_DEFAULT, migrated: false })
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return err('workspace blob is not an object')
  }

  const blob = raw as Record<string, unknown>
  const fromVersion = readVersion(blob)

  let migratedBlob: Record<string, unknown>
  try {
    migratedBlob = migrate(blob, fromVersion)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'migration failed')
  }

  const parsed = workspaceStateSchema.safeParse(migratedBlob)
  if (!parsed.success) {
    return err(`invalid workspace shape: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
  }

  return ok({
    state: parsed.data,
    fromVersion,
    migrated: migratedBlob !== blob
  })
}

// The default state is already at the current version, so no migration applies.
const WORKSPACE_VERSION_FOR_DEFAULT = defaultWorkspace().version
