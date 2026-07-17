import type { WorkspaceState } from '@shared/ipc/api-contract'
import { loadWorkspace } from '@core/persistence/validate'
import { defaultWorkspace } from '@core/persistence/default-workspace'
import { workspaceStateSchema } from '@core/persistence/schema'

const WORKSPACE_KEY = 'workspace'

/** Minimal key/value surface — satisfied by electron-store, and by a fake in tests. */
export interface KeyValueStore {
  get(key: string): unknown
  set(key: string, value: unknown): void
}

/** Writes a backup of the pre-migration blob before it is upgraded/overwritten. */
export type BackupFn = (blob: unknown) => void

export interface WorkspaceStoreDeps {
  store: KeyValueStore
  /** Defaults to a no-op; production passes a fs writer for `config.bak`. */
  backup?: BackupFn
  /** Optional logger for corruption fallbacks. */
  onWarn?: (message: string) => void
}

/**
 * Thin adapter over the persistence store. All shape/migration logic lives in
 * `@core/persistence`; this class only does I/O, backup, and fallback.
 */
export class WorkspaceStore {
  private readonly store: KeyValueStore
  private readonly backup: BackupFn
  private readonly onWarn: (message: string) => void

  constructor(deps: WorkspaceStoreDeps) {
    this.store = deps.store
    this.backup = deps.backup ?? (() => {})
    this.onWarn = deps.onWarn ?? (() => {})
  }

  load(): WorkspaceState {
    const raw = this.store.get(WORKSPACE_KEY)
    const result = loadWorkspace(raw)

    if (!result.ok) {
      // Preserve the corrupt blob before falling back — silent data loss is
      // worse than a bad file (the user can hand-recover from config.bak).
      this.backup(raw)
      this.onWarn(`workspace load failed (${result.error}); using defaults (backup written)`)
      return defaultWorkspace()
    }

    // If migration changed the shape, back up the original blob first, then
    // persist the upgraded version so the next load is already current.
    if (result.value.migrated) {
      this.backup(raw)
      this.store.set(WORKSPACE_KEY, result.value.state)
    }

    return result.value.state
  }

  save(state: WorkspaceState): void {
    // The renderer is semi-trusted: never persist a blob that would fail
    // validation on the next launch (silent workspace loss).
    const parsed = workspaceStateSchema.safeParse(state)
    if (!parsed.success) {
      this.onWarn(`rejected invalid workspace save: ${parsed.error.issues[0]?.message ?? '?'}`)
      return
    }
    this.store.set(WORKSPACE_KEY, parsed.data)
  }
}
