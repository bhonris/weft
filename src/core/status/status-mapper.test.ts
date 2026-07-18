import { describe, it, expect } from 'vitest'
import { mapHookToStatus } from './status-mapper'
import type { HookPayload } from '@shared/status/hook-events'

const base: HookPayload = { event: 'UserPromptSubmit', session_id: 's1' }

describe('mapHookToStatus', () => {
  it('maps UserPromptSubmit to working', () => {
    expect(mapHookToStatus({ ...base, event: 'UserPromptSubmit' })).toEqual({
      status: 'working'
    })
  })

  it('maps PostToolUse to working', () => {
    // Regression: answering a permission prompt fires no UserPromptSubmit, so
    // PostToolUse is what clears `waiting` back to `working` when the approved
    // tool runs. Without it the tab stays amber until the next Stop.
    expect(mapHookToStatus({ ...base, event: 'PostToolUse' })).toEqual({
      status: 'working'
    })
  })

  it('maps Stop to done', () => {
    expect(mapHookToStatus({ ...base, event: 'Stop' })).toEqual({
      status: 'done'
    })
  })

  it('maps StopFailure to error', () => {
    expect(mapHookToStatus({ ...base, event: 'StopFailure' })).toEqual({
      status: 'error'
    })
  })

  it.each(['agent_needs_input', 'permission_prompt', 'idle_prompt', 'elicitation_dialog'] as const)(
    'maps Notification %s to waiting',
    (notification_type) => {
      expect(
        mapHookToStatus({ ...base, event: 'Notification', notification_type })
      ).toEqual({ status: 'waiting' })
    }
  )

  it('maps Notification agent_completed to done', () => {
    expect(
      mapHookToStatus({ ...base, event: 'Notification', notification_type: 'agent_completed' })
    ).toEqual({ status: 'done' })
  })

  it('includes the message on waiting notifications when present', () => {
    expect(
      mapHookToStatus({
          ...base,
          event: 'Notification',
          notification_type: 'permission_prompt',
          message: 'Allow edit to foo.ts?'
        })
    ).toEqual({ status: 'waiting', message: 'Allow edit to foo.ts?' })
  })

  it('leaves status unchanged for auth_success', () => {
    expect(
      mapHookToStatus({ ...base, event: 'Notification', notification_type: 'auth_success' })
    ).toEqual({ status: null })
  })

  it('leaves status unchanged for a Notification with no type', () => {
    expect(mapHookToStatus({ ...base, event: 'Notification' })).toEqual({
      status: null
    })
  })

  it('leaves status unchanged for SessionStart/SessionEnd', () => {
    expect(mapHookToStatus({ ...base, event: 'SessionStart' })).toEqual({
      status: null
    })
    expect(mapHookToStatus({ ...base, event: 'SessionEnd' })).toEqual({
      status: null
    })
  })

  it('leaves status unchanged for an unrecognized event (default branch)', () => {
    // Cast an unknown event shape to exercise the defensive default case.
    const unknown = { event: 'MysteryEvent', session_id: 's1' } as unknown as HookPayload
    expect(mapHookToStatus(unknown)).toEqual({ status: null })
  })

  it('omits message on a done notification with no message', () => {
    expect(
      mapHookToStatus({ ...base, event: 'Notification', notification_type: 'agent_completed' })
    ).toEqual({ status: 'done' })
  })
})
