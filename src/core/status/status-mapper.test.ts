import { describe, it, expect } from 'vitest'
import { mapHookToStatus } from './status-mapper'
import type { HookPayload } from '@shared/status/hook-events'

const base: HookPayload = { event: 'UserPromptSubmit', session_id: 's1' }

describe('mapHookToStatus', () => {
  it('maps UserPromptSubmit to working', () => {
    expect(mapHookToStatus({ ...base, event: 'UserPromptSubmit' }, 'unknown')).toEqual({
      status: 'working'
    })
  })

  it('maps Stop to done', () => {
    expect(mapHookToStatus({ ...base, event: 'Stop' }, 'working')).toEqual({
      status: 'done'
    })
  })

  it('maps StopFailure to error', () => {
    expect(mapHookToStatus({ ...base, event: 'StopFailure' }, 'working')).toEqual({
      status: 'error'
    })
  })

  it.each(['agent_needs_input', 'permission_prompt', 'idle_prompt', 'elicitation_dialog'] as const)(
    'maps Notification %s to waiting',
    (notification_type) => {
      expect(
        mapHookToStatus({ ...base, event: 'Notification', notification_type }, 'working')
      ).toEqual({ status: 'waiting' })
    }
  )

  it('maps Notification agent_completed to done', () => {
    expect(
      mapHookToStatus(
        { ...base, event: 'Notification', notification_type: 'agent_completed' },
        'working'
      )
    ).toEqual({ status: 'done' })
  })

  it('includes the message on waiting notifications when present', () => {
    expect(
      mapHookToStatus(
        {
          ...base,
          event: 'Notification',
          notification_type: 'permission_prompt',
          message: 'Allow edit to foo.ts?'
        },
        'working'
      )
    ).toEqual({ status: 'waiting', message: 'Allow edit to foo.ts?' })
  })

  it('leaves status unchanged for auth_success', () => {
    expect(
      mapHookToStatus(
        { ...base, event: 'Notification', notification_type: 'auth_success' },
        'working'
      )
    ).toEqual({ status: null })
  })

  it('leaves status unchanged for a Notification with no type', () => {
    expect(mapHookToStatus({ ...base, event: 'Notification' }, 'working')).toEqual({
      status: null
    })
  })

  it('leaves status unchanged for SessionStart/SessionEnd', () => {
    expect(mapHookToStatus({ ...base, event: 'SessionStart' }, 'working')).toEqual({
      status: null
    })
    expect(mapHookToStatus({ ...base, event: 'SessionEnd' }, 'done')).toEqual({
      status: null
    })
  })
})
