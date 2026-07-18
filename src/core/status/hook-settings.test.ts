import { describe, it, expect } from 'vitest'
import { buildHookSettings, buildHookSettingsJson, REPORTED_EVENTS } from './hook-settings'

describe('buildHookSettings', () => {
  it('registers every reporting event with the forwarder command', () => {
    const settings = buildHookSettings({ forwarderCommand: '"C:\\hooks\\forward.cmd"' })
    const hooks = settings['hooks'] as Record<string, unknown>
    expect(Object.keys(hooks).sort()).toEqual([...REPORTED_EVENTS].sort())
    expect(hooks['Stop']).toEqual([
      {
        hooks: [{ type: 'command', command: '"C:\\hooks\\forward.cmd" Stop' }]
      }
    ])
  })

  it('produces valid JSON for --settings', () => {
    const json = buildHookSettingsJson({ forwarderCommand: '"/x/forward.sh"' })
    const parsed = JSON.parse(json) as {
      hooks: Record<string, Array<{ hooks: Array<{ type: string; command: string }> }>>
    }
    expect(Object.keys(parsed.hooks)).toHaveLength(REPORTED_EVENTS.length)
    expect(parsed.hooks['UserPromptSubmit']![0]!.hooks[0]!.command).toBe(
      '"/x/forward.sh" UserPromptSubmit'
    )
  })
})
