import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { NetTransport } from '../platform/net-transport'
import { FrameParser } from '@core/pipe/frame-parser'
import { forwarderScriptSource } from './hook-forwarder'
import { statusEndpointPath } from '@core/pipe/pipe-name'

/**
 * REAL end-to-end relay test: writes the actual forward.cjs to disk, runs it
 * in a real Node process with hook-style stdin, and asserts the payload
 * arrives — tagged with event + tabId — over a REAL named pipe / UDS served
 * by the production NetTransport. This is the exact path Claude Code hooks
 * take in production (modulo the .cmd/.sh wrapper, which only sets env).
 */

const transport = new NetTransport()

afterEach(async () => {
  await transport.close()
})

function runRelay(
  scriptPath: string,
  endpoint: string,
  eventName: string,
  stdin: string,
  extraEnv: Record<string, string> = {}
): Promise<number> {
  return new Promise((resolve, reject) => {
    // Build a deterministic child env. `CLAUDE_IDE_TAB` is deleted from the
    // inherited env so the ambient value present when this suite runs INSIDE a
    // live Claude Code session can't leak into cases that don't set it (a test
    // that wants a tabId supplies it via `extraEnv`, applied last).
    const env: NodeJS.ProcessEnv = { ...process.env, WEFT_STATUS_ENDPOINT: endpoint }
    delete env['CLAUDE_IDE_TAB']
    const child = spawn(process.execPath, [scriptPath, eventName], {
      env: { ...env, ...extraEnv },
      stdio: ['pipe', 'ignore', 'ignore']
    })
    child.on('error', reject)
    child.on('exit', (code) => resolve(code ?? -1))
    child.stdin.write(stdin)
    child.stdin.end()
  })
}

describe('forward.cjs relay (integration, real pipe + real process)', () => {
  it('forwards hook stdin JSON tagged with event and CLAUDE_IDE_TAB', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'weft-fwd-'))
    const scriptPath = join(dir, 'forward.cjs')
    writeFileSync(scriptPath, forwarderScriptSource())
    const endpoint = statusEndpointPath(process.platform, `test${process.pid}`, tmpdir())

    const frames: Record<string, unknown>[] = []
    let resolveFrame: () => void
    const gotFrame = new Promise<void>((res) => {
      resolveFrame = res
    })
    await transport.listen(endpoint, (socket) => {
      const parser = new FrameParser((f) => {
        frames.push(f)
        resolveFrame()
      })
      socket.onData((chunk) => parser.push(chunk))
      socket.onEnd(() => parser.end())
    })

    const exitCode = await runRelay(
      scriptPath,
      endpoint,
      'Notification',
      JSON.stringify({ session_id: 's-real', notification_type: 'permission_prompt' }),
      { CLAUDE_IDE_TAB: 'tab-real' }
    )
    await gotFrame

    expect(exitCode).toBe(0)
    expect(frames).toEqual([
      {
        session_id: 's-real',
        notification_type: 'permission_prompt',
        event: 'Notification',
        tabId: 'tab-real'
      }
    ])
  }, 20_000)

  it('survives non-object stdin (null) without crashing the hook', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'weft-fwd-'))
    const scriptPath = join(dir, 'forward.cjs')
    writeFileSync(scriptPath, forwarderScriptSource())
    const endpoint = statusEndpointPath(process.platform, `testn${process.pid}`, tmpdir())

    const frames: Record<string, unknown>[] = []
    let resolveFrame: () => void
    const gotFrame = new Promise<void>((res) => {
      resolveFrame = res
    })
    await transport.listen(endpoint, (socket) => {
      const parser = new FrameParser((f) => {
        frames.push(f)
        resolveFrame()
      })
      socket.onData((chunk) => parser.push(chunk))
      socket.onEnd(() => parser.end())
    })

    const exitCode = await runRelay(scriptPath, endpoint, 'Stop', 'null')
    await gotFrame

    expect(exitCode).toBe(0) // a failing hook would surface inside Claude Code
    expect(frames).toEqual([{ event: 'Stop' }])
  }, 20_000)

  it('exits cleanly when the endpoint is unreachable (never wedges the hook)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'weft-fwd-'))
    const scriptPath = join(dir, 'forward.cjs')
    writeFileSync(scriptPath, forwarderScriptSource())
    const dead = statusEndpointPath(process.platform, `dead${process.pid}`, tmpdir())

    const exitCode = await runRelay(scriptPath, dead, 'Stop', '{}')
    expect(exitCode).toBe(0)
  }, 20_000)
})
