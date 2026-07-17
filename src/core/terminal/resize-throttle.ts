/**
 * Leading + trailing throttle used to cap PTY resize calls at ≤ 1 per interval,
 * surviving drag-resize storms while still applying the final size.
 *
 * Time and timer scheduling are INJECTED (not referenced as globals) so this
 * module stays pure — no `Date`, no `setTimeout` — and is fully deterministic in
 * tests. The main process supplies real-timer deps (see `pty-manager`).
 */
export interface ThrottleDeps {
  now: () => number
  setTimer: (cb: () => void, ms: number) => unknown
  clearTimer: (handle: unknown) => void
}

export class Throttle<A extends unknown[]> {
  private lastRun = Number.NEGATIVE_INFINITY
  private timer: unknown = null
  private pending: A | null = null

  constructor(
    private readonly fn: (...args: A) => void,
    private readonly intervalMs: number,
    private readonly deps: ThrottleDeps
  ) {}

  /** Invoke `fn` now if the interval has elapsed, else coalesce into one trailing call. */
  call(...args: A): void {
    const now = this.deps.now()
    const elapsed = now - this.lastRun
    if (elapsed >= this.intervalMs) {
      this.lastRun = now
      this.fn(...args)
      return
    }
    // Within the window: remember the latest args, schedule a single trailing run.
    this.pending = args
    if (this.timer === null) {
      this.timer = this.deps.setTimer(() => {
        this.timer = null
        this.lastRun = this.deps.now()
        if (this.pending !== null) {
          const next = this.pending
          this.pending = null
          this.fn(...next)
        }
      }, this.intervalMs - elapsed)
    }
  }

  /** Cancel any scheduled trailing call (e.g. when the session closes). */
  dispose(): void {
    if (this.timer !== null) {
      this.deps.clearTimer(this.timer)
      this.timer = null
    }
    this.pending = null
  }
}
