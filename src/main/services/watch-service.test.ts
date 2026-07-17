import { describe, it, expect, vi } from 'vitest'
import { WatchService, type WatcherLike, type FsChangeEvent } from './watch-service'

class FakeWatcher implements WatcherLike {
  cb: ((event: string, path: string) => void) | null = null
  errCb: ((err: unknown) => void) | null = null
  closed = false
  on(event: 'all' | 'error', cb: unknown): void {
    if (event === 'all') this.cb = cb as (event: string, path: string) => void
    else this.errCb = cb as (err: unknown) => void
  }
  async close(): Promise<void> {
    this.closed = true
  }
  fire(event: string, path: string): void {
    this.cb?.(event, path)
  }
  fail(err: unknown): void {
    this.errCb?.(err)
  }
}

function setup() {
  const watchers: FakeWatcher[] = []
  const errors: Array<{ path: string; err: unknown }> = []
  const svc = new WatchService(
    () => {
      const w = new FakeWatcher()
      watchers.push(w)
      return w
    },
    (path, err) => errors.push({ path, err })
  )
  const events: FsChangeEvent[] = []
  return { svc, watchers, events, errors, onEvent: (e: FsChangeEvent) => events.push(e) }
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

  it('ignores unmapped chokidar events (ready, raw)', () => {
    const { svc, watchers, events, onEvent } = setup()
    svc.watch('/p', onEvent)
    watchers[0]!.fire('ready', '')
    expect(events).toEqual([])
  })

  it('routes watcher errors to the error handler instead of throwing', () => {
    const { svc, watchers, errors, onEvent } = setup()
    svc.watch('C:/junction', onEvent)
    expect(() => watchers[0]!.fail(new Error('EPERM: operation not permitted'))).not.toThrow()
    expect(errors).toHaveLength(1)
    expect(errors[0]!.path).toBe('C:/junction')
  })

  it('a service constructed without an error handler still survives errors', () => {
    const w = new FakeWatcher()
    const svc = new WatchService(() => w)
    svc.watch('/p', () => {})
    expect(() => w.fail(new Error('boom'))).not.toThrow()
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
