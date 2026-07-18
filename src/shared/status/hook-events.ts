/**
 * Claude Code hook event shapes that Weft's status server consumes.
 * These mirror the payloads Claude Code writes to a hook command's stdin.
 * Matcher strings (event names, notification_type) are treated as config,
 * not hardcoded truth, because Claude Code's set may expand over time.
 */

export type HookEventName =
  | 'UserPromptSubmit'
  | 'PostToolUse'
  | 'Stop'
  | 'StopFailure'
  | 'Notification'
  | 'SessionStart'
  | 'SessionEnd'

export type NotificationType =
  | 'agent_needs_input'
  | 'agent_completed'
  | 'permission_prompt'
  | 'idle_prompt'
  | 'elicitation_dialog'
  | 'auth_success'

/** A single hook payload forwarded from a Claude Code session to Weft. */
export interface HookPayload {
  event: HookEventName
  /** Pinned via `claude --session-id <uuid>`; the primary correlation key. */
  session_id?: string
  cwd?: string
  transcript_path?: string
  /** Present only for `Notification` events. */
  notification_type?: NotificationType
  /** Human-readable text, present on some `Notification` events. */
  message?: string
  /** Redundant correlation key from the `CLAUDE_IDE_TAB` env var. */
  tabId?: string
}

/** The lifecycle state of a Claude session, surfaced on its tab badge. */
export type SessionStatus = 'working' | 'waiting' | 'done' | 'error' | 'unknown'
