/**
 * Graceful-shutdown policy for a PTY-backed command. Pure: it only describes
 * WHAT to send and HOW LONG to wait — the main-process `PtyManager` executes the
 * plan against a real pseudo-terminal and falls back to a hard kill.
 *
 * Why this exists: closing a tab used to `kill()` the process outright. For an
 * interactive Claude Code session that's an abrupt teardown — Claude never gets
 * to flush its transcript or run its SessionEnd hook, which can leave the
 * conversation in a rougher state to resume. Asking it to exit on its own first
 * gives it that chance; the hard kill is only a backstop.
 */

/** Ctrl-C (interrupt / SIGINT) as a raw control byte. */
const CTRL_C = '\x03'

/** One step of a shutdown sequence: bytes to write, then pause `pauseMs` before the next. */
export interface CloseStep {
  data: string
  pauseMs: number
}

/**
 * The key sequence that asks an interactive command to exit on its own.
 *
 * - `claude`: two Ctrl-C presses. The first interrupts any in-flight turn (and
 *   clears a non-empty prompt); the second exits Claude Code. This lets Claude
 *   finalize its transcript and run its SessionEnd hook, keeping the
 *   conversation cleanly resumable.
 * - anything else (a plain shell): no sequence — it is simply killed.
 */
export function gracefulCloseSequence(command: string): CloseStep[] {
  if (command === 'claude') {
    return [
      { data: CTRL_C, pauseMs: 120 },
      { data: CTRL_C, pauseMs: 0 }
    ]
  }
  return []
}

/**
 * How long to wait for a graceful exit (after the sequence is sent) before
 * hard-killing the process anyway. Bounded so a closed tab always tears down
 * promptly even if the command ignores the sequence.
 */
export const GRACEFUL_CLOSE_TIMEOUT_MS = 1500
