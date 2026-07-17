import { createRequire } from 'node:module'
import type { IPtyProcess, PtyFactory, PtySpawnOptions } from './pty-manager'

/**
 * Production {@link PtyFactory} backed by node-pty (ConPTY on Windows).
 *
 * node-pty is a native module and is **lazily required** — unit tests inject a
 * fake factory and never load it, and an environment where the native binary
 * has not been rebuilt for Electron's ABI fails only when a session is actually
 * spawned, not at import time. This adapter is exercised by manual/E2E runs, not
 * the unit-coverage gate.
 */
type NodePty = typeof import('node-pty')

const requireCjs = createRequire(import.meta.url)

export class NodePtyFactory implements PtyFactory {
  private mod: NodePty | null = null

  private load(): NodePty {
    this.mod ??= requireCjs('node-pty') as NodePty
    return this.mod
  }

  spawn(opts: PtySpawnOptions): IPtyProcess {
    const proc = this.load().spawn(opts.file, opts.args, {
      name: 'xterm-color',
      cwd: opts.cwd,
      env: opts.env,
      cols: opts.cols,
      rows: opts.rows
    })
    return {
      get pid(): number {
        return proc.pid
      },
      onData: (cb) => {
        proc.onData(cb)
      },
      onExit: (cb) => {
        proc.onExit(({ exitCode }) => cb({ exitCode }))
      },
      write: (data) => proc.write(data),
      resize: (cols, rows) => proc.resize(cols, rows),
      kill: () => proc.kill()
    }
  }
}
