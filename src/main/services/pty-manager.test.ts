import { describe, it, expect, vi } from 'vitest'
import {
  PtyManager,
  type IPtyProcess,
  type PtyFactory,
  type PtySpawnOptions
} from './pty-manager'
import { GRACEFUL_CLOSE_TIMEOUT_MS } from '@core/terminal/graceful-close'

class FakePty implements IPtyProcess {
  private dataCbs: Array<(d: string) => void> = []
  private exitCbs: Array<(e: { exitCode: number }) => void> = []
  writes: string[] = []
  resizes: Array<[number, number]> = []
  killed = false

  constructor(readonly pid: number) {}

  onData(cb: (d: string) => void): void {
    this.dataCbs.push(cb)
  }
  onExit(cb: (e: { exitCode: number }) => void): void {
    this.exitCbs.push(cb)
  }
  write(d: string): void {
    this.writes.push(d)
  }
  resize(c: number, r: number): void {
    this.resizes.push([c, r])
  }
  kill(): void {
    this.killed = true
  }

  // test drivers
  emit(d: string): void {
    for (const cb of this.dataCbs) cb(d)
  }
  exit(code: number): void {
    for (const cb of this.exitCbs) cb({ exitCode: code })
  }
}

class FakeFactory implements PtyFactory {
  spawns: PtySpawnOptions[] = []
  ptys: FakePty[] = []
  private nextPid = 1000

  spawn(opts: PtySpawnOptions): IPtyProcess {
    this.spawns.push(opts)
    const pty = new FakePty(this.nextPid++)
    this.ptys.push(pty)
    return pty
  }

  get last(): FakePty {
    return this.ptys[this.ptys.length - 1]!
  }
}

const spec = (over: Partial<Parameters<PtyManager['create']>[0]> = {}) => ({
  tabId: 't1',
  sessionId: 's1',
  file: 'claude',
  cwd: 'C:/proj',
  ...over
})

describe('PtyManager — lifecycle', () => {
  it('spawns a PTY with defaults and records it', () => {
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory)
    const { tabId, pid } = mgr.create(spec({ args: ['--session-id', 's1'], env: { CLAUDE_IDE_TAB: 't1' } }))

    expect(tabId).toBe('t1')
    expect(pid).toBe(1000)
    expect(mgr.has('t1')).toBe(true)
    expect(mgr.pidOf('t1')).toBe(1000)
    expect(factory.spawns[0]).toMatchObject({
      file: 'claude',
      args: ['--session-id', 's1'],
      cwd: 'C:/proj',
      env: { CLAUDE_IDE_TAB: 't1' },
      cols: 80,
      rows: 24
    })
  })

  it('rejects a duplicate tab', () => {
    const mgr = new PtyManager(new FakeFactory())
    mgr.create(spec())
    expect(() => mgr.create(spec())).toThrow(/already has a session/)
  })

  it('write delegates to the PTY', () => {
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory)
    mgr.create(spec())
    mgr.write('t1', 'ls\n')
    expect(factory.last.writes).toEqual(['ls\n'])
  })

  it('close kills the PTY and deregisters the tab', () => {
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory)
    mgr.create(spec()) // shell (no graceful sequence) → killed immediately
    mgr.close('t1')
    expect(factory.last.killed).toBe(true)
    expect(mgr.has('t1')).toBe(false)
    expect(mgr.pidOf('t1')).toBeUndefined()
  })

  // Deterministic timer harness for the graceful-close path.
  const makeTimers = () => {
    let now = 0
    let id = 1
    const timers: Array<{ id: number; cb: () => void; at: number }> = []
    const deps = {
      now: () => now,
      setTimer: (cb: () => void, ms: number) => {
        const t = { id: id++, cb, at: now + ms }
        timers.push(t)
        return t.id
      },
      clearTimer: (h: unknown) => {
        const i = timers.findIndex((t) => t.id === h)
        if (i >= 0) timers.splice(i, 1)
      }
    }
    const advance = (ms: number): void => {
      now += ms
      // Fire all due timers in time order (a fired cb may clear others).
      for (;;) {
        const next = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at)[0]
        if (!next) break
        timers.splice(timers.indexOf(next), 1)
        next.cb()
      }
    }
    return { deps, advance }
  }

  it('close on a claude session sends Ctrl-C twice, hard-killing only after the grace window', () => {
    const { deps, advance } = makeTimers()
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory, { throttleDeps: deps })
    mgr.create(spec({ command: 'claude' }))

    mgr.close('t1')
    // The tab stops receiving output at once, but the process is NOT yet killed.
    expect(factory.last.killed).toBe(false)

    advance(0) // first Ctrl-C (queued at delay 0)
    expect(factory.last.writes).toEqual(['\x03'])
    advance(200) // second Ctrl-C (queued 120ms later)
    expect(factory.last.writes).toEqual(['\x03', '\x03'])
    expect(factory.last.killed).toBe(false)

    // Still alive after the grace window → hard kill + deregister.
    advance(GRACEFUL_CLOSE_TIMEOUT_MS)
    expect(factory.last.killed).toBe(true)
    expect(mgr.has('t1')).toBe(false)
  })

  it('close on a claude session that exits gracefully never hard-kills', () => {
    const { deps, advance } = makeTimers()
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory, { throttleDeps: deps })
    mgr.create(spec({ command: 'claude' }))

    mgr.close('t1')
    advance(200) // both Ctrl-C presses delivered

    // Claude honors the sequence and exits on its own before the backstop fires.
    factory.last.exit(0)
    expect(mgr.has('t1')).toBe(false)

    // The fallback timer was cancelled, so no redundant hard kill lands.
    advance(GRACEFUL_CLOSE_TIMEOUT_MS)
    expect(factory.last.killed).toBe(false)
  })

  it('close on an already-exited claude session deregisters without a kill', () => {
    const { deps, advance } = makeTimers()
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory, { throttleDeps: deps })
    mgr.create(spec({ command: 'claude' }))
    factory.last.exit(0) // process already dead

    mgr.close('t1')
    expect(mgr.has('t1')).toBe(false)
    expect(factory.last.killed).toBe(false) // nothing to kill
    advance(GRACEFUL_CLOSE_TIMEOUT_MS)
    expect(factory.last.writes).toEqual([]) // no shutdown sequence sent
  })

  it('close on an unknown tab is a no-op', () => {
    const mgr = new PtyManager(new FakeFactory())
    expect(() => mgr.close('ghost')).not.toThrow()
  })

  it('throws for operations on an unknown tab', () => {
    const mgr = new PtyManager(new FakeFactory())
    expect(() => mgr.write('ghost', 'x')).toThrow(/no session/)
    expect(() => mgr.resize('ghost', 1, 1)).toThrow(/no session/)
    expect(() => mgr.attach('ghost', () => {})).toThrow(/no session/)
    expect(() => mgr.snapshot('ghost')).toThrow(/no session/)
    expect(() => mgr.isExited('ghost')).toThrow(/no session/)
  })

  it('write and resize on an exited session are safe no-ops', () => {
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory)
    mgr.create(spec())
    factory.last.exit(1)

    expect(() => mgr.write('t1', 'ghost input')).not.toThrow()
    expect(() => mgr.resize('t1', 100, 40)).not.toThrow()
    expect(factory.last.writes).toEqual([])
    expect(factory.last.resizes).toEqual([])
  })

  it('a trailing throttled resize after exit is swallowed (timer-callback guard)', () => {
    let t = 0
    const timers: Array<{ cb: () => void; at: number }> = []
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory, {
      resizeIntervalMs: 50,
      throttleDeps: {
        now: () => t,
        setTimer: (cb, ms) => {
          timers.push({ cb, at: t + ms })
          return timers.length
        },
        clearTimer: () => {}
      }
    })
    mgr.create(spec())
    mgr.resize('t1', 80, 24) // leading fire
    mgr.resize('t1', 90, 30) // trailing scheduled
    factory.last.exit(1) // dies before the trailing fires
    t = 100
    expect(() => timers.forEach((x) => x.cb())).not.toThrow()
    expect(factory.last.resizes).toEqual([[80, 24]]) // trailing suppressed
  })

  it('listSessions reports identity and exit state', () => {
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory)
    mgr.create(spec({ command: 'claude' }))
    mgr.create(spec({ tabId: 't2', sessionId: 's2', command: 'shell' }))
    factory.ptys[1]!.exit(0)

    expect(mgr.listSessions()).toEqual([
      { tabId: 't1', sessionId: 's1', cwd: 'C:/proj', command: 'claude', exited: false },
      { tabId: 't2', sessionId: 's2', cwd: 'C:/proj', command: 'shell', exited: true }
    ])
  })

  it('attach on an exited session reports exited + exitCode', () => {
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory)
    mgr.create(spec())
    factory.last.emit('final output\n')
    factory.last.exit(7)

    const handle = mgr.attach('t1', () => {})
    expect(handle.snapshot).toBe('final output\n')
    expect(handle.exited).toBe(true)
    expect(handle.exitCode).toBe(7)
  })

  it('tracks exit and fans it out to listeners', () => {
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory)
    mgr.create(spec())
    const onExit = vi.fn()
    mgr.attach('t1', () => {}, onExit)

    factory.last.exit(137)

    expect(onExit).toHaveBeenCalledWith({ exitCode: 137 })
    expect(mgr.isExited('t1')).toBe(true)
  })
})

describe('PtyManager — buffering & attach/detach (session resilience §4.7)', () => {
  it('buffers output and fans it to attached listeners', () => {
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory)
    mgr.create(spec())
    const received: string[] = []
    mgr.attach('t1', (d) => received.push(d))

    factory.last.emit('line1\n')
    factory.last.emit('line2\n')

    expect(received).toEqual(['line1\n', 'line2\n'])
    expect(mgr.snapshot('t1')).toBe('line1\nline2\n')
  })

  it('attach replays the buffered snapshot for a late (re-mounted) view', () => {
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory)
    mgr.create(spec())
    factory.last.emit('earlier output\n') // happened before the view mounted

    const handle = mgr.attach('t1', () => {})
    expect(handle.snapshot).toBe('earlier output\n')
  })

  it('a renderer reload (detach + re-attach) keeps the same PID and replays history', () => {
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory)
    mgr.create(spec())
    const pidBefore = mgr.pidOf('t1')

    // First mount
    const first = mgr.attach('t1', () => {})
    factory.last.emit('hello\n')
    expect(mgr.dataListenerCount('t1')).toBe(1)

    // Reload: old view detaches, new view attaches
    first.detach()
    expect(mgr.dataListenerCount('t1')).toBe(0)

    const second = mgr.attach('t1', () => {})
    expect(mgr.dataListenerCount('t1')).toBe(1) // exactly one — no leak
    expect(second.snapshot).toBe('hello\n') // history recovered
    expect(mgr.pidOf('t1')).toBe(pidBefore) // NOT respawned
    expect(factory.ptys).toHaveLength(1) // only ever spawned once
  })

  it('detach does NOT kill the PTY (only close does)', () => {
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory)
    mgr.create(spec())
    const handle = mgr.attach('t1', () => {})
    handle.detach()
    expect(factory.last.killed).toBe(false)
    expect(mgr.has('t1')).toBe(true)
  })

  it('detach removes both data and exit listeners it added', () => {
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory)
    mgr.create(spec())
    const onData = vi.fn()
    const onExit = vi.fn()
    const handle = mgr.attach('t1', onData, onExit)
    handle.detach()

    factory.last.emit('x')
    factory.last.exit(0)
    expect(onData).not.toHaveBeenCalled()
    expect(onExit).not.toHaveBeenCalled()
  })

  it('lists live tab ids', () => {
    const mgr = new PtyManager(new FakeFactory())
    mgr.create(spec({ tabId: 'a', sessionId: 'a' }))
    mgr.create(spec({ tabId: 'b', sessionId: 'b' }))
    expect(mgr.tabIds().sort()).toEqual(['a', 'b'])
  })
})

describe('PtyManager — resize throttling', () => {
  it('throttles resize through the injected clock', () => {
    let t = 0
    const timers: Array<{ id: number; cb: () => void; at: number }> = []
    let nextId = 1
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory, {
      resizeIntervalMs: 50,
      throttleDeps: {
        now: () => t,
        setTimer: (cb, ms) => {
          const id = nextId++
          timers.push({ id, cb, at: t + ms })
          return id
        },
        clearTimer: (h) => {
          const i = timers.findIndex((x) => x.id === h)
          if (i >= 0) timers.splice(i, 1)
        }
      }
    })
    const advance = (ms: number): void => {
      t += ms
      for (const timer of [...timers]) {
        if (timer.at <= t) {
          timers.splice(timers.indexOf(timer), 1)
          timer.cb()
        }
      }
    }

    mgr.create(spec())
    mgr.resize('t1', 80, 24) // immediate
    advance(10)
    mgr.resize('t1', 90, 30) // coalesced
    advance(10)
    mgr.resize('t1', 100, 40) // coalesced (latest)
    advance(30) // trailing fires at t=50

    expect(factory.last.resizes).toEqual([
      [80, 24],
      [100, 40]
    ])
  })

  it('uses real timers when no throttleDeps are injected', () => {
    vi.useFakeTimers()
    try {
      const factory = new FakeFactory()
      const mgr = new PtyManager(factory, { resizeIntervalMs: 50 })
      mgr.create(spec())
      mgr.resize('t1', 80, 24) // immediate (leading)
      mgr.resize('t1', 100, 40) // scheduled via real setTimeout
      expect(factory.last.resizes).toEqual([[80, 24]])
      vi.advanceTimersByTime(50)
      expect(factory.last.resizes).toEqual([
        [80, 24],
        [100, 40]
      ])
      // Real clearTimer path: the window is still "hot" after the trailing
      // fire, so these coalesce into a pending call — cancelled by close().
      mgr.resize('t1', 120, 50)
      mgr.resize('t1', 130, 55)
      mgr.close('t1')
      vi.advanceTimersByTime(100)
      expect(factory.last.resizes).toHaveLength(2) // pending call never fired
    } finally {
      vi.useRealTimers()
    }
  })

  it('close disposes the resize throttle timer', () => {
    let t = 0
    const timers: Array<{ id: number; cb: () => void; at: number }> = []
    const factory = new FakeFactory()
    const mgr = new PtyManager(factory, {
      resizeIntervalMs: 50,
      throttleDeps: {
        now: () => t,
        setTimer: (cb, ms) => {
          timers.push({ id: 1, cb, at: t + ms })
          return 1
        },
        clearTimer: () => {
          timers.length = 0
        }
      }
    })
    mgr.create(spec())
    mgr.resize('t1', 80, 24) // immediate
    mgr.resize('t1', 90, 30) // schedules a trailing timer
    mgr.close('t1')
    expect(timers).toHaveLength(0) // disposed on close
  })
})
