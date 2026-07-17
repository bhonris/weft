import { createServer, type Server } from 'node:net'
import { chmodSync, unlinkSync } from 'node:fs'
import type { StatusTransport, SocketLike } from '../services/status-server'

const isPipePath = (p: string): boolean => p.startsWith('\\\\.\\pipe\\')

/**
 * Named-pipe (Windows) / Unix-domain-socket (POSIX) transport for the status
 * server. `node:net` binds a PIPE PATH here, never a TCP port — asserting the
 * spec's no-network guarantee. Excluded from the unit gate (thin I/O adapter);
 * exercised end-to-end by the Playwright-Electron status test.
 */
export class NetTransport implements StatusTransport {
  private server: Server | null = null
  private socketPath: string | null = null

  listen(path: string, onConnection: (socket: SocketLike) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createServer((socket) => {
        socket.setEncoding('utf8')
        onConnection({
          onData: (cb) => socket.on('data', (chunk) => cb(chunk as unknown as string)),
          onEnd: (cb) => socket.on('end', cb)
        })
      })
      server.on('error', reject)
      server.listen(path, () => {
        this.server = server
        this.socketPath = path
        // POSIX UDS files default to the umask — restrict to the owning user
        // (a /tmp fallback dir would otherwise be connectable cross-user).
        if (!isPipePath(path)) {
          try {
            chmodSync(path, 0o600)
          } catch {
            /* best effort — Windows pipe paths land here on some node builds */
          }
        }
        resolve()
      })
    })
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve()
      const path = this.socketPath
      this.server.close(() => {
        // Stale UDS files otherwise accumulate across crashes/restarts.
        if (path && !isPipePath(path)) {
          try {
            unlinkSync(path)
          } catch {
            /* already gone */
          }
        }
        resolve()
      })
      this.server = null
      this.socketPath = null
    })
  }
}
