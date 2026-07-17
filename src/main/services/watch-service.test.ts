import { describe, it, expect, vi } from 'vitest'
import { WatchService, type WatcherLike, type FsChangeEvent } from './watch-service'

class FakeWatcher implements WatcherLike {
  cb: ((event: string, path: string) => void) | null = null
  closed = false
  on(_event: 'all', cb: (event: string, path: string) => void): void {
    this.cb = cb
  }
  async close(): Promise<void> {
    this.closed = true
  }
  fire(event: string, path: string): void {
    this.cb?.(event, path)
  }
}

function setup() {
  const watchers: FakeWatcher[] = []
  const svc = new WatchService(() => {
    const w = new FakeWatcher()
    watchers.push(w)
    return w
  })
  const events: FsChangeEvent[] = []
  return { svc, watchers, events, onEvent: (e: FsChangeEvent) => events.push(e) }
}

describe('WatchService', () => {
  it('assigns distinct watch ids and relays mapped events', () => {
    const { svc, watchers, events, onEvent } = setup()
    const a = svc.watch('/p/a', onEvent)
    const b = svc.watch('/p/b', onEvent)
    expect(a.watchId).not.toBe(b.watchId)

    watchers[0]!.fire('add', '/p/a/new.txt')
    watchers[1]!.fire('change', '/p/b/x.txt')
    watchers[0]!.fire('unlinkDir', '/p/a/sub')
    watchers[0]!.fire('addDir', '/p/a/dir2')

    expect(events).toEqual([
      { watchId: a.watchId, type: 'add', path: '/p/a/new.txt' },
      { watchId: b.watchId, type: 'change', path: '/p/b/x.txt' },
      { watchId: a.watchId, type: 'unlink', path: '/p/a/sub' },
      { watchId: a.watchId, type: 'add', path: '/p/a/dir2' }
    ])
  })

  it('ignores unmapped chokidar events (ready, raw, error)', () => {
    const { svc, watchers, events, onEvent } = setup()
    svc.watch('/p', onEvent)
    watchers[0]!.fire('ready', '')
    watchers[0]!.fire('error', 'boom')
    expect(events).toEqual([])
  })

  it('unwatch closes and forgets the watcher; double-unwatch is a no-op', async () => {
    const { svc, watchers, onEvent } = setup()
    const { watchId } = svc.watch('/p', onEvent)
    expect(svc.count()).toBe(1)
    await svc.unwatch(watchId)
    expect(watchers[0]!.closed).toBe(true)
    expect(svc.count()).toBe(0)
    await expect(svc.unwatch(watchId)).resolves.toBeUndefined()
  })

  it('closeAll closes every watcher', async () => {
    const { svc, watchers, onEvent } = setup()
    svc.watch('/a', onEvent)
    svc.watch('/b', onEvent)
    await svc.closeAll()
    expect(watchers.every((w) => w.closed)).toBe(true)
    expect(svc.count()).toBe(0)
  })
})
