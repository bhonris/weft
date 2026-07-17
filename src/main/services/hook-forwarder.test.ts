import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import {
  forwarderScriptSource,
  windowsWrapperSource,
  posixWrapperSource,
  writeForwarder,
  type ForwarderFsLike
} from './hook-forwarder'

class FakeFs implements ForwarderFsLike {
  dirs: string[] = []
  files = new Map<string, { content: string; mode?: number }>()
  async mkdir(path: string): Promise<void> {
    this.dirs.push(path)
  }
  async writeFile(path: string, content: string, opts?: { mode?: number }): Promise<void> {
    const entry: { content: string; mode?: number } = { content }
    if (opts?.mode !== undefined) entry.mode = opts.mode
    this.files.set(path, entry)
  }
}

describe('forwarder sources', () => {
  it('the relay script forwards stdin JSON tagged with event + tabId to the endpoint', () => {
    const src = forwarderScriptSource()
    expect(src).toContain("require('net')")
    expect(src).toContain('WEFT_STATUS_ENDPOINT')
    expect(src).toContain('CLAUDE_IDE_TAB')
    expect(src).toContain("payload.event = event")
    // Hard timeout so a dead endpoint can never wedge Claude's hook pipeline.
    expect(src).toContain('setTimeout(() => process.exit(0), 5000)')
  })

  it('the Windows wrapper sets ELECTRON_RUN_AS_NODE inside the wrapper only', () => {
    const src = windowsWrapperSource('C:\\app\\weft.exe', 'C:\\hooks\\forward.cjs')
    expect(src).toContain('set ELECTRON_RUN_AS_NODE=1')
    expect(src).toContain('"C:\\app\\weft.exe" "C:\\hooks\\forward.cjs" %*')
  })

  it('the POSIX wrapper execs with the env var scoped to the command', () => {
    const src = posixWrapperSource('/app/weft', '/hooks/forward.cjs')
    expect(src).toContain('#!/bin/sh')
    expect(src).toContain('ELECTRON_RUN_AS_NODE=1 exec "/app/weft" "/hooks/forward.cjs" "$@"')
  })
})

describe('writeForwarder', () => {
  it('writes relay + .cmd wrapper on Windows', async () => {
    const fs = new FakeFs()
    const { wrapperPath } = await writeForwarder({
      fs,
      dir: 'C:\\ud\\hooks',
      electronExe: 'C:\\app\\weft.exe',
      platform: 'win32'
    })
    expect(wrapperPath).toBe(join('C:\\ud\\hooks', 'forward.cmd'))
    expect(fs.files.has(join('C:\\ud\\hooks', 'forward.cjs'))).toBe(true)
    expect(fs.files.get(wrapperPath)!.content).toContain('ELECTRON_RUN_AS_NODE=1')
  })

  it('writes relay + executable .sh wrapper on POSIX', async () => {
    const fs = new FakeFs()
    const { wrapperPath } = await writeForwarder({
      fs,
      dir: '/ud/hooks',
      electronExe: '/app/weft',
      platform: 'linux'
    })
    expect(wrapperPath).toBe(join('/ud/hooks', 'forward.sh'))
    expect(fs.files.get(wrapperPath)!.mode).toBe(0o755)
  })
})
