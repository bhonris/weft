import { join } from 'node:path'

/**
 * Generates the tiny relay that Claude Code hooks execute: it reads the hook's
 * stdin JSON, tags it with the event name (argv) and `CLAUDE_IDE_TAB` (env),
 * and writes one NDJSON line to Weft's status endpoint (from the
 * `WEFT_STATUS_ENDPOINT` env var the PTY inherits).
 *
 * The relay runs on Electron's own binary via `ELECTRON_RUN_AS_NODE=1`, so it
 * works on machines with no system Node. The env var is set INSIDE the wrapper
 * (not in the session env) so user programs in the terminal are unaffected.
 * All content is generated at runtime into an app-owned dir — no personal
 * config is ever touched (spec §9).
 */

export function forwarderScriptSource(): string {
  return `'use strict'
const net = require('net')
const event = process.argv[2] || 'Unknown'
const endpoint = process.env.WEFT_STATUS_ENDPOINT
if (!endpoint) process.exit(0)
let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (d) => { input += d })
process.stdin.on('end', () => {
  let payload = {}
  try { payload = JSON.parse(input) } catch (_e) { payload = {} }
  payload.event = event
  if (process.env.CLAUDE_IDE_TAB) payload.tabId = process.env.CLAUDE_IDE_TAB
  const sock = net.connect(endpoint, () => {
    sock.end(JSON.stringify(payload) + '\\n')
  })
  sock.on('error', () => process.exit(0))
  sock.on('close', () => process.exit(0))
})
// Never wedge the hook pipeline: hard exit worst-case.
setTimeout(() => process.exit(0), 5000)
`
}

export function windowsWrapperSource(electronExe: string, scriptPath: string): string {
  return `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"${electronExe}" "${scriptPath}" %*\r\n`
}

export function posixWrapperSource(electronExe: string, scriptPath: string): string {
  return `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec "${electronExe}" "${scriptPath}" "$@"\n`
}

export interface ForwarderFsLike {
  mkdir(path: string, opts: { recursive: true }): Promise<unknown>
  writeFile(path: string, content: string, opts?: { mode?: number }): Promise<void>
}

export interface WriteForwarderDeps {
  fs: ForwarderFsLike
  /** App-owned directory (e.g. `<userData>/hooks`). */
  dir: string
  electronExe: string
  platform: NodeJS.Platform | string
}

/** Write the relay + platform wrapper; returns the wrapper to use as the hook command. */
export async function writeForwarder(deps: WriteForwarderDeps): Promise<{ wrapperPath: string }> {
  await deps.fs.mkdir(deps.dir, { recursive: true })
  const scriptPath = join(deps.dir, 'forward.cjs')
  await deps.fs.writeFile(scriptPath, forwarderScriptSource())
  if (deps.platform === 'win32') {
    const wrapperPath = join(deps.dir, 'forward.cmd')
    await deps.fs.writeFile(wrapperPath, windowsWrapperSource(deps.electronExe, scriptPath))
    return { wrapperPath }
  }
  const wrapperPath = join(deps.dir, 'forward.sh')
  await deps.fs.writeFile(wrapperPath, posixWrapperSource(deps.electronExe, scriptPath), {
    mode: 0o755
  })
  return { wrapperPath }
}
