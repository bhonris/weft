import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  registerSessionIpc,
  type IpcMainLike,
  type IpcEventLike
} from './register'
import { CH } from '@shared/ipc/channels'
import {
  PtyManager,
  type IPtyProcess,
  type PtyFactory,
  type PtySpawnOptions
} from '../services/pty-manager'

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
  private pid = 500
  spawn(opts: PtySpawnOptions): IPtyProcess {
    this.spawns.push(opts)
    const p = new FakePty(this.pid++)
    this.ptys.push(p)
    return p
  }
  get last(): FakePty {
    return this.ptys[this.ptys.length - 1]!
  }
}

class FakeIpcMain implements IpcMainLike {
  handlers = new Map<string, (e: IpcEventLike, ...a: unknown[]) => unknown>()
  listeners = new Map<string, (e: IpcEventLike, ...a: unknown[]) => void>()
  handle(channel: string, listener: (e: IpcEventLike, ...a: unknown[]) => unknown): void {
    this.handlers.set(channel, listener)
  }
  on(channel: string, listener: (e: IpcEventLike, ...a: unknown[]) => void): void {
    this.listeners.set(channel, listener)
  }
  invoke(channel: string, event: IpcEventLike, ...args: unknown[]): unknown {
    return this.handlers.get(channel)!(event, ...args)
  }
  fire(channel: string, event: IpcEventLike, ...args: unknown[]): void {
    this.listeners.get(channel)!(event, ...args)
  }
}

class FakeSender {
  sent: Array<{ channel: string; payload: unknown }> = []
  constructor(readonly id: number) {}
  send(channel: string, payload: unknown): void {
    this.sent.push({ channel, payload })
  }
}

function setup(pickDirectory: () => Promise<string | null> = async () => null) {
  const factory = new FakeFactory()
  const pty = new PtyManager(factory)
  const ipcMain = new FakeIpcMain()
  let n = 0
  registerSessionIpc({
    ipcMain,
    pty,
    pickDirectory,
    generateId: () => `id${++n}`,
    baseEnv: { PATH: '/usr/bin' },
    shellPath: 'bash'
  })
  const event: IpcEventLike = { sender: new FakeSender(1) }
  return { factory, pty, ipcMain, event }
}

describe('registerSessionIpc', () => {
  let ctx: ReturnType<typeof setup>
  beforeEach(() => {
    ctx = setup()
  })

  it('createSession spawns claude with a pinned session id and tab env', () => {
    const res = ctx.ipcMain.invoke(CH.createSession, ctx.event, {
      cwd: 'C:/proj',
      command: 'claude'
    })
    expect(res).toEqual({ tabId: 'id1' })
    expect(ctx.factory.spawns[0]).toMatchObject({
      file: 'claude',
      args: ['--session-id', 'id2'],
      cwd: 'C:/proj'
    })
    expect(ctx.factory.spawns[0]!.env).toMatchObject({
      PATH: '/usr/bin',
      CLAUDE_IDE_TAB: 'id1'
    })
  })

  it('createSession spawns a shell when command is shell', () => {
    ctx.ipcMain.invoke(CH.createSession, ctx.event, {
      cwd: 'C:/proj',
      command: 'shell',
      args: ['-l']
    })
    expect(ctx.factory.spawns[0]).toMatchObject({ file: 'bash', args: ['-l'] })
  })

  it('write and resize delegate to the PTY, and are ignored for unknown tabs', () => {
    ctx.ipcMain.invoke(CH.createSession, ctx.event, { cwd: 'C:/p', command: 'claude' })
    ctx.ipcMain.fire(CH.writeToSession, ctx.event, 'id1', 'ls\n')
    ctx.ipcMain.fire(CH.resizeSession, ctx.event, 'id1', 100, 40)
    expect(ctx.factory.last.writes).toEqual(['ls\n'])
    expect(ctx.factory.last.resizes).toEqual([[100, 40]])

    // Unknown tab → no throw, no effect
    expect(() => ctx.ipcMain.fire(CH.writeToSession, ctx.event, 'ghost', 'x')).not.toThrow()
    expect(() => ctx.ipcMain.fire(CH.resizeSession, ctx.event, 'ghost', 1, 1)).not.toThrow()
  })

  it('attachSession replays the snapshot and forwards live data to the sender', () => {
    ctx.ipcMain.invoke(CH.createSession, ctx.event, { cwd: 'C:/p', command: 'claude' })
    ctx.factory.last.emit('before\n') // buffered before attach

    const res = ctx.ipcMain.invoke(CH.attachSession, ctx.event, 'id1') as { snapshot: string }
    expect(res.snapshot).toBe('before\n')

    ctx.factory.last.emit('live\n')
    const sender = ctx.event.sender as FakeSender
    expect(sender.sent).toContainEqual({
      channel: CH.sessionData,
      payload: { tabId: 'id1', data: 'live\n' }
    })
  })

  it('forwards exit to the sender', () => {
    ctx.ipcMain.invoke(CH.createSession, ctx.event, { cwd: 'C:/p', command: 'claude' })
    ctx.ipcMain.invoke(CH.attachSession, ctx.event, 'id1')
    ctx.factory.last.exit(0)
    const sender = ctx.event.sender as FakeSender
    expect(sender.sent).toContainEqual({
      channel: CH.sessionExit,
      payload: { tabId: 'id1', exitCode: 0 }
    })
  })

  it('detachSession stops forwarding but leaves the PTY running', () => {
    ctx.ipcMain.invoke(CH.createSession, ctx.event, { cwd: 'C:/p', command: 'claude' })
    ctx.ipcMain.invoke(CH.attachSession, ctx.event, 'id1')
    ctx.ipcMain.invoke(CH.detachSession, ctx.event, 'id1')

    const before = (ctx.event.sender as FakeSender).sent.length
    ctx.factory.last.emit('after-detach\n')
    expect((ctx.event.sender as FakeSender).sent.length).toBe(before)
    expect(ctx.factory.last.killed).toBe(false)
    expect(ctx.pty.has('id1')).toBe(true)
  })

  it('re-attaching the same (sender, tab) detaches the old listeners — exactly one subscription', () => {
    ctx.ipcMain.invoke(CH.createSession, ctx.event, { cwd: 'C:/p', command: 'claude' })
    ctx.ipcMain.invoke(CH.attachSession, ctx.event, 'id1')
    // Simulate a reload that never ran React cleanup: attach again, same sender.
    ctx.ipcMain.invoke(CH.attachSession, ctx.event, 'id1')

    expect(ctx.pty.dataListenerCount('id1')).toBe(1)
    ctx.factory.last.emit('once\n')
    const sender = ctx.event.sender as FakeSender
    const dataMessages = sender.sent.filter((m) => m.channel === CH.sessionData)
    expect(dataMessages).toHaveLength(1) // not doubled
  })

  it('attachSession reports exit state for already-dead sessions', () => {
    ctx.ipcMain.invoke(CH.createSession, ctx.event, { cwd: 'C:/p', command: 'claude' })
    ctx.factory.last.exit(3)
    const res = ctx.ipcMain.invoke(CH.attachSession, ctx.event, 'id1') as {
      exited: boolean
      exitCode: number | null
    }
    expect(res.exited).toBe(true)
    expect(res.exitCode).toBe(3)
  })

  it('listSessions returns live session identities', () => {
    ctx.ipcMain.invoke(CH.createSession, ctx.event, { cwd: 'C:/p', command: 'claude' })
    const res = ctx.ipcMain.invoke(CH.listSessions, ctx.event) as unknown[]
    expect(res).toEqual([{ tabId: 'id1', cwd: 'C:/p', command: 'claude', exited: false }])
  })

  it('drops malformed write/resize args instead of throwing (boundary validation)', () => {
    ctx.ipcMain.invoke(CH.createSession, ctx.event, { cwd: 'C:/p', command: 'claude' })
    expect(() => {
      ctx.ipcMain.fire(CH.writeToSession, ctx.event, 'id1', 12345 as unknown as string)
      ctx.ipcMain.fire(CH.writeToSession, ctx.event, null, 'x')
      ctx.ipcMain.fire(CH.resizeSession, ctx.event, 'id1', Number.NaN, 24)
      ctx.ipcMain.fire(CH.resizeSession, ctx.event, 'id1', 0, 24)
      ctx.ipcMain.fire(CH.resizeSession, ctx.event, 'id1', -5, 24)
      ctx.ipcMain.fire(CH.resizeSession, ctx.event, 'id1', 80.5, 24)
      ctx.ipcMain.fire(CH.resizeSession, ctx.event, 'id1', 999999, 24)
    }).not.toThrow()
    expect(ctx.factory.last.writes).toEqual([])
    expect(ctx.factory.last.resizes).toEqual([])
  })

  it('rejects malformed createSession options', () => {
    expect(() =>
      ctx.ipcMain.invoke(CH.createSession, ctx.event, { cwd: '', command: 'claude' })
    ).toThrow(/invalid/)
    expect(() =>
      ctx.ipcMain.invoke(CH.createSession, ctx.event, { cwd: 'C:/p', command: 'rm -rf' })
    ).toThrow(/invalid/)
    expect(() =>
      ctx.ipcMain.invoke(CH.createSession, ctx.event, {
        cwd: 'C:/p',
        command: 'claude',
        args: ['ok', 42]
      })
    ).toThrow(/invalid/)
    expect(() => ctx.ipcMain.invoke(CH.createSession, ctx.event, null)).toThrow(/invalid/)
    expect(ctx.factory.spawns).toHaveLength(0)
  })

  it('auto-detaches when the sender webContents has been destroyed', () => {
    ctx.ipcMain.invoke(CH.createSession, ctx.event, { cwd: 'C:/p', command: 'claude' })

    let destroyed = false
    const sender = new FakeSender(7) as FakeSender & { isDestroyed: () => boolean }
    sender.isDestroyed = () => destroyed
    const event: IpcEventLike = { sender }

    ctx.ipcMain.invoke(CH.attachSession, event, 'id1')
    expect(ctx.pty.dataListenerCount('id1')).toBe(1)

    destroyed = true // window closed without unmounting (tear-off close)
    ctx.factory.last.emit('data-after-destroy\n')

    // The guarded send removed the dead attachment instead of throwing.
    expect(ctx.pty.dataListenerCount('id1')).toBe(0)
    expect(sender.sent).toEqual([])
  })

  it('auto-detaches when sending to the sender throws', () => {
    ctx.ipcMain.invoke(CH.createSession, ctx.event, { cwd: 'C:/p', command: 'claude' })
    const sender = new FakeSender(8)
    sender.send = () => {
      throw new Error('Object has been destroyed')
    }
    ctx.ipcMain.invoke(CH.attachSession, { sender }, 'id1')

    expect(() => ctx.factory.last.emit('boom\n')).not.toThrow()
    expect(ctx.pty.dataListenerCount('id1')).toBe(0)
  })

  it('detachSession is a no-op for an unknown attachment', () => {
    expect(() => ctx.ipcMain.invoke(CH.detachSession, ctx.event, 'ghost')).not.toThrow()
  })

  it('closeSession terminates and deregisters the session', () => {
    ctx.ipcMain.invoke(CH.createSession, ctx.event, { cwd: 'C:/p', command: 'claude' })
    ctx.ipcMain.invoke(CH.closeSession, ctx.event, 'id1')
    expect(ctx.factory.last.killed).toBe(true)
    expect(ctx.pty.has('id1')).toBe(false)
  })

  it('openProject creates a session for the chosen directory', async () => {
    const c = setup(async () => 'C:/Users/me/my-app')
    const res = await c.ipcMain.invoke(CH.openProject, c.event)
    expect(res).toEqual({
      tabId: 'id1',
      cwd: 'C:/Users/me/my-app',
      title: 'my-app',
      command: 'claude'
    })
    expect(c.factory.spawns[0]).toMatchObject({ file: 'claude', cwd: 'C:/Users/me/my-app' })
  })

  it('injects --settings hooks and the status endpoint for claude sessions only', () => {
    const factory = new FakeFactory()
    const pty = new PtyManager(factory)
    const ipcMain = new FakeIpcMain()
    let n = 0
    registerSessionIpc({
      ipcMain,
      pty,
      pickDirectory: async () => null,
      generateId: () => `id${++n}`,
      baseEnv: {},
      shellPath: 'bash',
      hooks: { endpoint: '\\\\.\\pipe\\weft-x', settingsJson: '{"hooks":{}}' }
    })
    const event: IpcEventLike = { sender: new FakeSender(9) }

    ipcMain.invoke(CH.createSession, event, { cwd: 'C:/p', command: 'claude' })
    expect(factory.spawns[0]!.args).toEqual(['--session-id', 'id2', '--settings', '{"hooks":{}}'])
    expect(factory.spawns[0]!.env['WEFT_STATUS_ENDPOINT']).toBe('\\\\.\\pipe\\weft-x')

    ipcMain.invoke(CH.createSession, event, { cwd: 'C:/p', command: 'shell' })
    expect(factory.spawns[1]!.args).toEqual([])
    // Shell sessions still get the endpoint env (harmless; enables future use).
    expect(factory.spawns[1]!.env['WEFT_STATUS_ENDPOINT']).toBe('\\\\.\\pipe\\weft-x')
  })

  it('openProject honors a per-call command override (shell tab via Shift+Click)', async () => {
    const factory = new FakeFactory()
    const pty = new PtyManager(factory)
    const ipcMain = new FakeIpcMain()
    let n = 0
    registerSessionIpc({
      ipcMain,
      pty,
      pickDirectory: async () => '/tmp/x',
      generateId: () => `id${++n}`,
      baseEnv: {},
      shellPath: 'bash',
      defaultCommand: 'claude'
    })
    const res = await ipcMain.invoke(
      CH.openProject,
      { sender: { id: 1, send: () => {} } },
      'shell'
    )
    expect(factory.spawns[0]).toMatchObject({ file: 'bash' })
    expect(res).toMatchObject({ command: 'shell' })
  })

  it('openProject honors an injected default command', async () => {
    const factory = new FakeFactory()
    const pty = new PtyManager(factory)
    const ipcMain = new FakeIpcMain()
    let n = 0
    registerSessionIpc({
      ipcMain,
      pty,
      pickDirectory: async () => '/tmp/x',
      generateId: () => `id${++n}`,
      baseEnv: {},
      shellPath: 'bash',
      defaultCommand: 'shell'
    })
    await ipcMain.invoke(CH.openProject, { sender: { id: 1, send: () => {} } })
    expect(factory.spawns[0]).toMatchObject({ file: 'bash' })
  })

  it('openProject returns an error result (not a rejection) when spawn fails', async () => {
    const failingFactory: PtyFactory = {
      spawn: () => {
        throw new Error('spawn claude ENOENT')
      }
    }
    const pty = new PtyManager(failingFactory)
    const ipcMain = new FakeIpcMain()
    registerSessionIpc({
      ipcMain,
      pty,
      pickDirectory: async () => 'C:/proj/app',
      generateId: () => 'x',
      baseEnv: {},
      claudePath: 'claude'
    })
    const res = await ipcMain.invoke(CH.openProject, { sender: new FakeSender(1) })
    expect(res).toEqual({
      error: 'spawn claude ENOENT',
      cwd: 'C:/proj/app',
      title: 'app',
      command: 'claude'
    })
  })

  it('spawns the injected claude binary path', () => {
    const factory = new FakeFactory()
    const pty = new PtyManager(factory)
    const ipcMain = new FakeIpcMain()
    registerSessionIpc({
      ipcMain,
      pty,
      pickDirectory: async () => null,
      generateId: () => 'y',
      baseEnv: {},
      claudePath: 'C:/custom/claude.exe'
    })
    ipcMain.invoke(CH.createSession, { sender: new FakeSender(1) }, { cwd: 'C:/p', command: 'claude' })
    expect(factory.spawns[0]!.file).toBe('C:/custom/claude.exe')
  })

  it('openProject returns null when the picker is cancelled', async () => {
    const c = setup(async () => null)
    const res = await c.ipcMain.invoke(CH.openProject, c.event)
    expect(res).toBeNull()
    expect(c.factory.spawns).toHaveLength(0)
  })
})
