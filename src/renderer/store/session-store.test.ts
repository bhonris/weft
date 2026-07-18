import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from './session-store'

beforeEach(() => {
  useSessionStore.setState({ tabs: [], activeTabId: null })
})

describe('useSessionStore', () => {
  it('adds a tab and makes it active with a default status', () => {
    useSessionStore.getState().addTab({ tabId: 't1', title: 'proj', cwd: 'C:/a' })
    const s = useSessionStore.getState()
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0]).toMatchObject({ tabId: 't1', title: 'proj', status: 'unknown' })
    expect(s.activeTabId).toBe('t1')
  })

  it('ignores a duplicate tabId', () => {
    const { addTab } = useSessionStore.getState()
    addTab({ tabId: 't1', title: 'a', cwd: 'C:/a' })
    addTab({ tabId: 't1', title: 'again', cwd: 'C:/a' })
    expect(useSessionStore.getState().tabs).toHaveLength(1)
  })

  it('removes a tab and reactivates the last remaining one', () => {
    const { addTab, removeTab } = useSessionStore.getState()
    addTab({ tabId: 't1', title: 'a', cwd: 'C:/a' })
    addTab({ tabId: 't2', title: 'b', cwd: 'C:/b' })
    removeTab('t2') // active was t2 → falls back to t1
    const s = useSessionStore.getState()
    expect(s.tabs.map((t) => t.tabId)).toEqual(['t1'])
    expect(s.activeTabId).toBe('t1')
  })

  it('keeps the active tab when a non-active tab is removed', () => {
    const { addTab, removeTab, setActive } = useSessionStore.getState()
    addTab({ tabId: 't1', title: 'a', cwd: 'C:/a' })
    addTab({ tabId: 't2', title: 'b', cwd: 'C:/b' })
    setActive('t1')
    removeTab('t2')
    expect(useSessionStore.getState().activeTabId).toBe('t1')
  })

  it('sets activeTabId to null when the last tab is removed', () => {
    const { addTab, removeTab } = useSessionStore.getState()
    addTab({ tabId: 't1', title: 'a', cwd: 'C:/a' })
    removeTab('t1')
    expect(useSessionStore.getState().activeTabId).toBeNull()
  })

  it('updates status and title', () => {
    const { addTab, setStatus, rename } = useSessionStore.getState()
    addTab({ tabId: 't1', title: 'a', cwd: 'C:/a' })
    setStatus('t1', 'waiting')
    rename('t1', 'renamed')
    const tab = useSessionStore.getState().tabs[0]!
    expect(tab.status).toBe('waiting')
    expect(tab.title).toBe('renamed')
  })

  it('setActive switches the active tab', () => {
    const { addTab, setActive } = useSessionStore.getState()
    addTab({ tabId: 't1', title: 'a', cwd: 'C:/a' })
    addTab({ tabId: 't2', title: 'b', cwd: 'C:/b' })
    setActive('t1')
    expect(useSessionStore.getState().activeTabId).toBe('t1')
  })

  it('moveTab reorders by inserting at the target position', () => {
    const { addTab, moveTab } = useSessionStore.getState()
    addTab({ tabId: 'a', title: 'a', cwd: 'C:/a' })
    addTab({ tabId: 'b', title: 'b', cwd: 'C:/b' })
    addTab({ tabId: 'c', title: 'c', cwd: 'C:/c' })

    moveTab('c', 'a') // drag c onto a → c takes a's slot
    expect(useSessionStore.getState().tabs.map((t) => t.tabId)).toEqual(['c', 'a', 'b'])

    moveTab('c', 'b') // drag c onto b
    expect(useSessionStore.getState().tabs.map((t) => t.tabId)).toEqual(['a', 'c', 'b'])
  })

  it('moveTab is a no-op for self-drops and unknown ids', () => {
    const { addTab, moveTab } = useSessionStore.getState()
    addTab({ tabId: 'a', title: 'a', cwd: 'C:/a' })
    addTab({ tabId: 'b', title: 'b', cwd: 'C:/b' })
    moveTab('a', 'a')
    moveTab('ghost', 'a')
    moveTab('a', 'ghost')
    expect(useSessionStore.getState().tabs.map((t) => t.tabId)).toEqual(['a', 'b'])
  })

  it('moveActiveTab reorders the active tab and clamps at the ends', () => {
    const { addTab, setActive, moveActiveTab } = useSessionStore.getState()
    addTab({ tabId: 'a', title: 'a', cwd: 'C:/a' })
    addTab({ tabId: 'b', title: 'b', cwd: 'C:/b' })
    addTab({ tabId: 'c', title: 'c', cwd: 'C:/c' })

    setActive('b')
    moveActiveTab(-1) // b left
    expect(useSessionStore.getState().tabs.map((t) => t.tabId)).toEqual(['b', 'a', 'c'])
    moveActiveTab(1) // b right (back to middle)
    expect(useSessionStore.getState().tabs.map((t) => t.tabId)).toEqual(['a', 'b', 'c'])

    setActive('a')
    moveActiveTab(-1) // already first → clamp, no change
    expect(useSessionStore.getState().tabs.map((t) => t.tabId)).toEqual(['a', 'b', 'c'])

    setActive('c')
    moveActiveTab(1) // already last → clamp, no change
    expect(useSessionStore.getState().tabs.map((t) => t.tabId)).toEqual(['a', 'b', 'c'])
  })

  it('moveActiveTab is a no-op with no active tab', () => {
    useSessionStore.getState().moveActiveTab(1)
    expect(useSessionStore.getState().tabs).toEqual([])
  })

  it('cycleTab wraps in both directions', () => {
    const { addTab, setActive, cycleTab } = useSessionStore.getState()
    addTab({ tabId: 'a', title: 'a', cwd: 'C:/a' })
    addTab({ tabId: 'b', title: 'b', cwd: 'C:/b' })
    addTab({ tabId: 'c', title: 'c', cwd: 'C:/c' })
    setActive('c')

    cycleTab(1) // wraps to first
    expect(useSessionStore.getState().activeTabId).toBe('a')
    cycleTab(-1) // wraps back to last
    expect(useSessionStore.getState().activeTabId).toBe('c')
  })

  it('cycleTab with no tabs is a no-op', () => {
    useSessionStore.getState().cycleTab(1)
    expect(useSessionStore.getState().activeTabId).toBeNull()
  })

  it('setTheme updates the theme choice', () => {
    useSessionStore.getState().setTheme('dark')
    expect(useSessionStore.getState().theme).toBe('dark')
    useSessionStore.getState().setTheme('cyberpunk')
    expect(useSessionStore.getState().theme).toBe('cyberpunk')
    useSessionStore.getState().setTheme('system')
    expect(useSessionStore.getState().theme).toBe('system')
  })
})
