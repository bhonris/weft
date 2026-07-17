/**
 * A bounded buffer of a session's recent raw PTY output.
 *
 * Bounded by total characters (not lines): a fullscreen TUI like `claude` emits
 * escape sequences rather than newline-delimited lines, so the recovery strategy
 * is to **replay the recent raw bytes verbatim** into a fresh xterm — the
 * terminal re-interprets the escape codes and redraws. This is what lets a
 * session survive a renderer reload / HMR / crash (spec §4.7).
 */
export class OutputRingBuffer {
  private chunks: string[] = []
  private total = 0

  constructor(private readonly maxChars = 200_000) {
    if (maxChars <= 0) throw new Error('maxChars must be positive')
  }

  push(data: string): void {
    if (data.length === 0) return
    this.chunks.push(data)
    this.total += data.length
    this.trim()
  }

  private trim(): void {
    while (this.total > this.maxChars && this.chunks.length > 1) {
      const dropped = this.chunks.shift() as string
      this.total -= dropped.length
    }
    // A single chunk larger than the cap: keep only its tail.
    if (this.total > this.maxChars && this.chunks.length === 1) {
      const only = this.chunks[0] as string
      const tail = only.slice(only.length - this.maxChars)
      this.chunks[0] = tail
      this.total = tail.length
    }
  }

  /** The buffered output, ready to be written into a freshly mounted terminal. */
  snapshot(): string {
    return this.chunks.join('')
  }

  get length(): number {
    return this.total
  }

  clear(): void {
    this.chunks = []
    this.total = 0
  }
}
