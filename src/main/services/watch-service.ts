export type FsChangeType = 'add' | 'change' | 'unlink'

export interface FsChangeEvent {
  watchId: string
  type: FsChangeType
  path: string
}

/** The chokidar surface we depend on — injectable for tests. */
export interface WatcherLike {
  on(event: 'all', cb: (eventName: string, path: string) => void): void
  on(event: 'error', cb: (err: unknown) => void): void
  close(): Promise<void>
}

export type WatcherFactory = (path: string) => WatcherLike

const EVENT_MAP: Record<string, FsChangeType> = {
  add: 'add',
  addDir: 'add',
  change: 'change',
  unlink: 'unlink',
  unlinkDir: 'unlink'
}

/**
 * Tracks one filesystem watcher per explorer root and relays change events to
 * the subscriber. Directory events collapse onto the same add/change/unlink
 * vocabulary the renderer tree understands.
 */
export class WatchService {
  private readonly watchers = new Map<string, WatcherLike>()
  private counter = 0

  constructor(
    private readonly factory: WatcherFactory,
    private readonly onError: (path: string, err: unknown) => void = () => {}
  ) {}

  watch(path: string, onEvent: (e: FsChangeEvent) => void): { watchId: string } {
    const watchId = `w${++this.counter}`
    const watcher = this.factory(path)
    watcher.on('all', (eventName: string, changedPath: string) => {
      const type = EVENT_MAP[eventName]
      if (type) onEvent({ watchId, type, path: changedPath })
    })
    // An unhandled 'error' (e.g. EPERM on Windows junctions during a scan)
    // would be an uncaught exception in main — always subscribe.
    watcher.on('error', (err: unknown) => this.onError(path, err))
    this.watchers.set(watchId, watcher)
    return { watchId }
  }

  async unwatch(watchId: string): Promise<void> {
    const watcher = this.watchers.get(watchId)
    if (!watcher) return
    this.watchers.delete(watchId)
    await watcher.close()
  }

  async closeAll(): Promise<void> {
    const all = [...this.watchers.values()]
    this.watchers.clear()
    await Promise.all(all.map((w) => w.close()))
  }

  count(): number {
    return this.watchers.size
  }
}
