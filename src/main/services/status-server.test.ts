import { describe, it, expect, vi } from 'vitest'
import {
  StatusServer,
  type StatusTransport,
  type SocketLike,
  type StatusChange
} from './status-server'
import type { TabRef } from '@core/status/session-correlator'

class FakeSocket implements SocketLike {
  private dataCb: ((chunk: string) => void) | null = null
  private endCb: (() => void) | null = null
  onData(cb: (chunk: string) => void): void {
    this.dataCb = cb
  }
  onEnd(cb: () => void): void {
    this.endCb = cb
  }
  feed(chunk: string): void {
    this.dataCb?.(chunk)
  }
  close(): void {
    this.endCb?.()
  }
}

class FakeTransport implements StatusTransport {
  path = ''
  private onConnection: ((s: SocketLike) => void) | null = null
  closed = false
  async listen(path: string, onConnection: (s: SocketLike) => void): Promise<void> {
    this.path = path
    this.onConnection = onConnection
  }
  async close(): Promise<void> {
    this.closed = true
  }
  connect(): FakeSocket {
    const s = new FakeSocket()
    this.onConnection?.(s)
    return s
  }
}

const tabs: TabRef[] = [{ tabId: 't1', sessionId: 's1', cwd: 'C:/p' }]

async function setup() {
  const transport = new FakeTransport()
  const changes: StatusChange[] = []
  const drops: string[] = []
  const server = new StatusServer({
    transport,
    endpointPath: '\\\\.\\pipe\\weft-test',
    getTabs: () => tabs,
    onStatus: (c) => changes.push(c),
    onDrop: (r) => drops.push(r)
  })
  await server.start()
  return { transport, server, changes, drops }
}

describe('StatusServer', () => {
  it('binds the injected endpoint path', async () => {
    const { transport } = await setup()
    expect(transport.path).toBe('\\\\.\\pipe\\weft-test')
  })

  it('maps a permission_prompt notification to waiting for the right tab', async () => {
    const { transport, changes, server } = await setup()
    const sock = transport.connect()
    sock.feed(
      JSON.stringify({
        event: 'Notification',
        notification_type: 'permission_prompt',
        session_id: 's1',
        message: 'Allow?'
      }) + '\n'
    )
    expect(changes).toEqual([{ tabId: 't1', status: 'waiting', message: 'Allow?' }])
    expect(server.statusOf('t1')).toBe('waiting')
  })

  it('walks the full lifecycle working → waiting → done', async () => {
    const { transport, changes } = await setup()
    const sock = transport.connect()
    sock.feed(JSON.stringify({ event: 'UserPromptSubmit', session_id: 's1' }) + '\n')
    sock.feed(
      JSON.stringify({
        event: 'Notification',
        notification_type: 'agent_needs_input',
        session_id: 's1'
      }) + '\n'
    )
    sock.feed(JSON.stringify({ event: 'Stop', session_id: 's1' }) + '\n')
    expect(changes.map((c) => c.status)).toEqual(['working', 'waiting', 'done'])
  })

  it('suppresses duplicate status emissions', async () => {
    const { transport, changes } = await setup()
    const sock = transport.connect()
    const working = JSON.stringify({ event: 'UserPromptSubmit', session_id: 's1' }) + '\n'
    sock.feed(working)
    sock.feed(working)
    expect(changes).toHaveLength(1)
  })

  it('drops payloads that match no tab, without status changes', async () => {
    const { transport, changes, drops } = await setup()
    const sock = transport.connect()
    sock.feed(JSON.stringify({ event: 'Stop', session_id: 'ghost' }) + '\n')
    expect(changes).toEqual([])
    expect(drops).toEqual(['no matching tab'])
  })

  it('drops malformed lines and frames without an event', async () => {
    const { transport, drops } = await setup()
    const sock = transport.connect()
    sock.feed('garbage\n')
    sock.feed(JSON.stringify({ session_id: 's1' }) + '\n')
    expect(drops[0]).toContain('malformed line')
    expect(drops[1]).toBe('missing event field')
  })

  it('parses a frame split across chunks and flushes on socket end', async () => {
    const { transport, changes } = await setup()
    const sock = transport.connect()
    const line = JSON.stringify({ event: 'Stop', session_id: 's1' })
    sock.feed(line.slice(0, 10))
    sock.feed(line.slice(10)) // no trailing newline
    expect(changes).toEqual([])
    sock.close() // end() flushes
    expect(changes).toEqual([{ tabId: 't1', status: 'done' }])
  })

  it('forget() resets a closed tab back to unknown', async () => {
    const { transport, server } = await setup()
    const sock = transport.connect()
    sock.feed(JSON.stringify({ event: 'Stop', session_id: 's1' }) + '\n')
    expect(server.statusOf('t1')).toBe('done')
    server.forget('t1')
    expect(server.statusOf('t1')).toBe('unknown')
  })

  it('stop() closes the transport', async () => {
    const { transport, server } = await setup()
    await server.stop()
    expect(transport.closed).toBe(true)
  })
})
