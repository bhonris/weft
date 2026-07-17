/**
 * Reassembles newline-delimited JSON (NDJSON) from arbitrary byte-chunk
 * boundaries. A hook payload may arrive split across several socket chunks, or
 * several payloads may arrive in one chunk — this parser handles both. Pure:
 * feed it strings, get parsed objects; invalid JSON lines are surfaced to an
 * error callback (the caller logs and drops them, per spec §4.4).
 */
export class FrameParser {
  private buffer = ''

  constructor(
    private readonly onFrame: (frame: Record<string, unknown>) => void,
    private readonly onError: (line: string) => void = () => {}
  ) {}

  push(chunk: string): void {
    this.buffer += chunk
    let idx = this.buffer.indexOf('\n')
    while (idx !== -1) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, '').trim()
      this.buffer = this.buffer.slice(idx + 1)
      if (line.length > 0) this.parse(line)
      idx = this.buffer.indexOf('\n')
    }
  }

  /** Flush a trailing unterminated line (e.g. socket closed without newline). */
  end(): void {
    const line = this.buffer.trim()
    this.buffer = ''
    if (line.length > 0) this.parse(line)
  }

  private parse(line: string): void {
    try {
      const value: unknown = JSON.parse(line)
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        this.onFrame(value as Record<string, unknown>)
      } else {
        this.onError(line)
      }
    } catch {
      this.onError(line)
    }
  }
}
