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
    expect(res).toEqual({ tabId: 'id1', cwd: 'C:/Users/me/my-app', title: 'my-app' })
    expect(c.factory.spawns[0]).toMatchObject({ file: 'claude', cwd: 'C:/Users/me/my-app' })
  })

  it('openProject returns null when the picker is cancelled', async () => {
    const c = setup(async () => null)
    const res = await c.ipcMain.invoke(CH.openProject, c.event)
    expect(res).toBeNull()
    expect(c.factory.spawns).toHaveLength(0)
  })
})
