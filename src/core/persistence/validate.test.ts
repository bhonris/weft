import { describe, it, expect } from 'vitest'
import { loadWorkspace } from './validate'
import { defaultWorkspace } from './default-workspace'
import { migrations } from './migrations'

const validV1 = {
  version: 7,
  resumeEnabled: false,
  notificationsEnabled: true,
  keymapOverrides: {},
  dock: { position: 'bottom', size: 0.4 },
  activePanel: 'explorer',
  terminalFontSize: 13,
  editorFontSize: 14,
  uiZoom: 1,
  tabs: [
    {
      tabId: 't1',
      sessionId: 's1',
      title: 'proj-a',
      cwd: 'C:/a',
      command: 'claude',
      windowId: 'main'
    }
  ],
  tabOrder: ['t1'],
  explorerRoots: ['C:/a'],
  theme: 'dark'
}

describe('loadWorkspace', () => {
  it('returns a fresh default for null/undefined', () => {
    const r = loadWorkspace(null)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.state).toEqual(defaultWorkspace())
      expect(r.value.migrated).toBe(false)
    }
  })

  it('errors on a non-object blob', () => {
    expect(loadWorkspace('nope').ok).toBe(false)
    expect(loadWorkspace([1, 2, 3]).ok).toBe(false)
  })

  it('accepts a valid current-version blob without migrating', () => {
    const r = loadWorkspace(validV1)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.state.theme).toBe('dark')
      expect(r.value.fromVersion).toBe(7)
      expect(r.value.migrated).toBe(false)
    }
  })

  it('migrates a legacy v0 blob and flags migrated', () => {
    const r = loadWorkspace({ theme: 'light', tabs: [] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.state.version).toBe(7)
      expect(r.value.state.theme).toBe('light')
      expect(r.value.state.resumeEnabled).toBe(false)
      expect(r.value.state.notificationsEnabled).toBe(true)
      expect(r.value.state.keymapOverrides).toEqual({})
      expect(r.value.state.dock).toEqual({ position: 'bottom', size: 0.4 })
      expect(r.value.fromVersion).toBe(0)
      expect(r.value.migrated).toBe(true)
    }
  })

  it('errors when the migrated shape is still invalid', () => {
    const r = loadWorkspace({ version: 2, tabs: 'not-an-array' })
    expect(r.ok).toBe(false)
  })

  it('preserves populated keymapOverrides (incl. the unbound sentinel) through load', () => {
    const overrides = { 'ctrl+shift+g': 'general.commandPalette', 'ctrl+shift+p': '' }
    const r = loadWorkspace({ ...validV1, keymapOverrides: overrides })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.state.keymapOverrides).toEqual(overrides)
  })

  it('accepts the cyberpunk theme', () => {
    const r = loadWorkspace({ ...validV1, theme: 'cyberpunk' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.state.theme).toBe('cyberpunk')
  })

  it('migrates a legacy blob that already names the cyberpunk theme', () => {
    const r = loadWorkspace({ theme: 'cyberpunk', tabs: [] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.state.theme).toBe('cyberpunk')
      expect(r.value.migrated).toBe(true)
    }
  })

  it('errors when the migrated theme is invalid', () => {
    const r = loadWorkspace({ version: 2, resumeEnabled: false, tabs: [], tabOrder: [], explorerRoots: [], theme: 'x' })
    expect(r.ok).toBe(false)
  })

  it('surfaces an Error thrown by a migration step', () => {
    const saved = migrations[0]
    migrations[0] = () => {
      throw new Error('bad step')
    }
    try {
      const r = loadWorkspace({ version: 0, tabs: [] })
      expect(r).toEqual({ ok: false, error: 'bad step' })
    } finally {
      migrations[0] = saved!
    }
  })

  it('surfaces a non-Error thrown by a migration step', () => {
    const saved = migrations[0]
    migrations[0] = () => {
      throw 'raw string failure'
    }
    try {
      const r = loadWorkspace({ version: 0, tabs: [] })
      expect(r).toEqual({ ok: false, error: 'migration failed' })
    } finally {
      migrations[0] = saved!
    }
  })
})
