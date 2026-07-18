/**
 * Build the inline `--settings` JSON that registers Weft's observation-only
 * reporting hooks on a spawned `claude` session. Session-only: `--settings`
 * MERGES with the user's ~/.claude/settings.json and never touches it.
 *
 * Each hook runs the forwarder script (a Weft-generated wrapper that relaunches
 * Electron as Node) which reads the hook's stdin JSON, tags it with the event
 * name, and writes one NDJSON line to Weft's named-pipe/UDS status endpoint.
 * Pure: the forwarder command is injected.
 */

// PostToolUse is reported so that resuming after a permission prompt (which
// fires no UserPromptSubmit) flips the tab from `waiting` back to `working`.
export const REPORTED_EVENTS = ['UserPromptSubmit', 'PostToolUse', 'Stop', 'StopFailure', 'Notification'] as const

export interface HookSettingsInput {
  /** Absolute path (already quoted-safe) of the forwarder wrapper to execute. */
  forwarderCommand: string
}

/** The object shape Claude Code expects under `hooks`. */
export function buildHookSettings(input: HookSettingsInput): Record<string, unknown> {
  const hooks: Record<string, unknown> = {}
  for (const event of REPORTED_EVENTS) {
    hooks[event] = [
      {
        hooks: [
          {
            type: 'command',
            command: `${input.forwarderCommand} ${event}`
          }
        ]
      }
    ]
  }
  return { hooks }
}

/** The exact string passed to `claude --settings '<json>'`. */
export function buildHookSettingsJson(input: HookSettingsInput): string {
  return JSON.stringify(buildHookSettings(input))
}
