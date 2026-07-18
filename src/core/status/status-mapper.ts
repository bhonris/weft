import type {
  HookPayload,
  NotificationType,
  SessionStatus
} from '@shared/status/hook-events'

/** notification_type values that mean "the session is blocked waiting on you". */
const WAITING_NOTIFICATIONS: ReadonlySet<NotificationType> = new Set([
  'agent_needs_input',
  'permission_prompt',
  'idle_prompt',
  'elicitation_dialog'
])

export interface StatusUpdate {
  /** The next status, or null to leave the current status unchanged. */
  status: SessionStatus | null
  /** Optional human-readable detail (e.g. the notification message). */
  message?: string
}

/**
 * Pure mapping from a hook payload to the next status. This is the heart of
 * Weft's differentiation: hook-driven, not output-scraped. Deduplication
 * against the prior status is the StatusServer's job, not the mapper's.
 *
 * Returns `status: null` when the event carries no status meaning (e.g.
 * `auth_success`, `SessionStart`), so the caller leaves the badge untouched.
 */
export function mapHookToStatus(payload: HookPayload): StatusUpdate {
  switch (payload.event) {
    case 'UserPromptSubmit':
      return { status: 'working' }

    // Answering a permission prompt (approve a tool) is NOT a prompt
    // submission, so it fires no UserPromptSubmit — the tab would otherwise
    // stay `waiting` (amber) until the next Stop. PostToolUse fires once the
    // approved tool runs, i.e. the moment the agent resumes, so it's the
    // signal that clears `waiting` back to `working`.
    case 'PostToolUse':
      return { status: 'working' }

    case 'Stop':
      return { status: 'done' }

    case 'StopFailure':
      return { status: 'error' }

    case 'Notification':
      return mapNotification(payload)

    case 'SessionStart':
    case 'SessionEnd':
      return { status: null }

    default:
      return { status: null }
  }
}

function mapNotification(payload: HookPayload): StatusUpdate {
  const type = payload.notification_type
  if (type === undefined) {
    return { status: null }
  }
  if (type === 'agent_completed') {
    return { status: 'done', ...withMessage(payload) }
  }
  if (WAITING_NOTIFICATIONS.has(type)) {
    return { status: 'waiting', ...withMessage(payload) }
  }
  // auth_success and any future informational notifications: no status change.
  return { status: null }
}

function withMessage(payload: HookPayload): { message?: string } {
  return payload.message !== undefined ? { message: payload.message } : {}
}
