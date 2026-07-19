import { describe, it, expect } from 'vitest'
import { migrate, migrations } from './index'
import { v0ToV1 } from './v0-to-v1'
import { v2ToV3 } from './v2-to-v3'
import { v3ToV4 } from './v3-to-v4'

describe('migrate', () => {
  it('returns the same blob when already current', () => {
    const blob = { version: 4, tabs: [] }
    expect(migrate(blob, 4)).toBe(blob)
  })

  it('runs the full chain for a legacy blob', () => {
    const out = migrate({ theme: 'dark' }, 0)
    expect(out['version']).toBe(4) // full chain: v0 -> v1 -> v2 -> v3 -> v4
    expect(out['resumeEnabled']).toBe(false)
    expect(out['notificationsEnabled']).toBe(true)
    expect(out['keymapOverrides']).toEqual({})
  })

  it('throws when a migration step is missing', () => {
    // Temporarily remove a step to force the gap.
    const saved = migrations[0]
    delete migrations[0]
    try {
      expect(() => migrate({}, 0)).toThrow(/No migration registered for version 0/)
    } finally {
      migrations[0] = saved!
    }
  })
})

describe('v0ToV1', () => {
  it('fills defaults for an empty legacy blob', () => {
    expect(v0ToV1({})).toEqual({
      version: 1,
      tabs: [],
      tabOrder: [],
      explorerRoots: [],
      // A legacy blob with no theme falls back to the app default (cyberpunk).
      theme: 'cyberpunk'
    })
  })

  it('preserves and completes partial tabs', () => {
    const out = v0ToV1({
      tabs: [{ tabId: 't1', title: 'proj', cwd: 'C:/a', command: 'shell' }]
    })
    expect(out['tabs']).toEqual([
      {
        tabId: 't1',
        sessionId: 't1',
        title: 'proj',
        cwd: 'C:/a',
        command: 'shell',
        windowId: 'main'
      }
    ])
    expect(out['tabOrder']).toEqual(['t1'])
  })

  it('derives a deterministic id when tabId is missing', () => {
    const out = v0ToV1({ tabs: [{ cwd: 'C:/my project' }] }) as {
      tabs: Array<{ tabId: string; command: string }>
    }
    expect(out.tabs[0]!.tabId).toBe('legacy-C-my-project')
    expect(out.tabs[0]!.command).toBe('claude')
  })

  it('keeps a valid theme and explicit tabOrder/explorerRoots', () => {
    const out = v0ToV1({
      theme: 'light',
      tabOrder: ['a', 1, 'b'],
      explorerRoots: ['C:/root', 2]
    })
    expect(out['theme']).toBe('light')
    expect(out['tabOrder']).toEqual(['a', 'b'])
    expect(out['explorerRoots']).toEqual(['C:/root'])
  })

  it('handles null entries in the tabs array', () => {
    const out = v0ToV1({ tabs: [null] }) as { tabs: Array<{ title: string }> }
    expect(out.tabs[0]!.title).toBe('session')
  })
})

describe('v2ToV3', () => {
  it('adds notificationsEnabled (on) and bumps the version, preserving other fields', () => {
    expect(v2ToV3({ version: 2, resumeEnabled: true, theme: 'dark' })).toEqual({
      version: 3,
      resumeEnabled: true,
      theme: 'dark',
      notificationsEnabled: true
    })
  })
})

describe('v3ToV4', () => {
  it('adds empty keymapOverrides and bumps the version, preserving other fields', () => {
    expect(v3ToV4({ version: 3, notificationsEnabled: true, theme: 'dark' })).toEqual({
      version: 4,
      notificationsEnabled: true,
      theme: 'dark',
      keymapOverrides: {}
    })
  })
})
