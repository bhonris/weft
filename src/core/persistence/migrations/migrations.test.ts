import { describe, it, expect } from 'vitest'
import { migrate, migrations } from './index'
import { v0ToV1 } from './v0-to-v1'

describe('migrate', () => {
  it('returns the same blob when already current', () => {
    const blob = { version: 2, tabs: [] }
    expect(migrate(blob, 2)).toBe(blob)
  })

  it('runs the v0->v1 step for a legacy blob', () => {
    const out = migrate({ theme: 'dark' }, 0)
    expect(out['version']).toBe(2) // full chain: v0 -> v1 -> v2
    expect(out['resumeEnabled']).toBe(false)
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
      theme: 'system'
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
