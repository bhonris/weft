import { createServer, type Server } from 'node:net'
import type { StatusTransport, SocketLike } from '../services/status-server'

/**
 * Named-pipe (Windows) / Unix-domain-socket (POSIX) transport for the status
 * server. `node:net` binds a PIPE PATH here, never a TCP port — asserting the
 * spec's no-network guarantee. Excluded from the unit gate (thin I/O adapter);
 * exercised end-to-end by the Playwright-Electron status test.
 */
export class NetTransport implements StatusTransport {
  private server: Server | null = null

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
        resolve()
      })
    })
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve()
      this.server.close(() => resolve())
      this.server = null
    })
  }
}
