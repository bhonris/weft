import { describe, it, expect, vi } from 'vitest'
import { WorkspaceStore, type KeyValueStore } from './workspace-store'
import { defaultWorkspace } from '@core/persistence/default-workspace'

class FakeStore implements KeyValueStore {
  data = new Map<string, unknown>()
  get(key: string): unknown {
    return this.data.get(key)
  }
  set(key: string, value: unknown): void {
    this.data.set(key, value)
  }
}

describe('WorkspaceStore', () => {
  it('returns a default workspace on first load (empty store)', () => {
    const store = new FakeStore()
    const ws = new WorkspaceStore({ store })
    expect(ws.load()).toEqual(defaultWorkspace())
  })

  it('loads a previously saved workspace round-trip', () => {
    const store = new FakeStore()
    const ws = new WorkspaceStore({ store })
    const state = { ...defaultWorkspace(), theme: 'dark' as const, explorerRoots: ['C:/a'] }
    ws.save(state)
    expect(ws.load()).toEqual(state)
  })

  it('backs up and persists the upgraded blob when migrating', () => {
    const store = new FakeStore()
    const legacy = { theme: 'light', tabs: [] }
    store.set('workspace', legacy)
    const backup = vi.fn()
    const ws = new WorkspaceStore({ store, backup })

    const loaded = ws.load()

    expect(backup).toHaveBeenCalledWith(legacy)
    expect(loaded.version).toBe(3)
    // The store now holds the upgraded shape, so a second load needs no migration.
    backup.mockClear()
    ws.load()
    expect(backup).not.toHaveBeenCalled()
  })

  it('migrates without throwing when no backup fn is provided', () => {
    const store = new FakeStore()
    store.set('workspace', { theme: 'dark', tabs: [] })
    const ws = new WorkspaceStore({ store })
    expect(ws.load().version).toBe(3)
  })

  it('falls back to defaults when a corrupt blob has no onWarn fn', () => {
    const store = new FakeStore()
    store.set('workspace', 42)
    const ws = new WorkspaceStore({ store })
    expect(ws.load()).toEqual(defaultWorkspace())
  })

  it('falls back to defaults, warns, and BACKS UP the corrupt blob', () => {
    const store = new FakeStore()
    store.set('workspace', 'garbage')
    const onWarn = vi.fn()
    const backup = vi.fn()
    const ws = new WorkspaceStore({ store, onWarn, backup })

    expect(ws.load()).toEqual(defaultWorkspace())
    expect(onWarn).toHaveBeenCalledOnce()
    expect(backup).toHaveBeenCalledWith('garbage') // recoverable, not silently lost
  })

  it('rejects an invalid save instead of persisting a blob that breaks next launch', () => {
    const store = new FakeStore()
    const onWarn = vi.fn()
    const ws = new WorkspaceStore({ store, onWarn })

    ws.save({ version: 1, tabs: 'nope' } as never)
    expect(store.data.has('workspace')).toBe(false)
    expect(onWarn).toHaveBeenCalledOnce()

    // A valid save still goes through afterwards.
    ws.save(defaultWorkspace())
    expect(store.data.get('workspace')).toEqual(defaultWorkspace())
  })
})
