import { describe, it, expect } from 'vitest'
import { defaultWorkspace } from './default-workspace'
import { WORKSPACE_VERSION } from './schema'

describe('defaultWorkspace', () => {
  it('is an empty workspace at the current version', () => {
    const ws = defaultWorkspace()
    expect(ws.version).toBe(WORKSPACE_VERSION)
    expect(ws.tabs).toEqual([])
    expect(ws.tabOrder).toEqual([])
    expect(ws.explorerRoots).toEqual([])
    expect(ws.resumeEnabled).toBe(false)
    // Notifications ship on by default (the "which session needs me?" signal).
    expect(ws.notificationsEnabled).toBe(true)
    // No custom keybindings out of the box.
    expect(ws.keymapOverrides).toEqual({})
    // CLI dock defaults to the bottom edge.
    expect(ws.dock).toEqual({ position: 'bottom', size: 0.4 })
    // Text sizing ships at the historical defaults.
    expect(ws.terminalFontSize).toBe(15)
    expect(ws.editorFontSize).toBe(14)
    expect(ws.uiZoom).toBe(1)
  })

  // Regression guard: cyberpunk is the out-of-the-box default theme. A fresh
  // launch (and the corruption fallback) must open in cyberpunk.
  it('defaults the theme to cyberpunk', () => {
    expect(defaultWorkspace().theme).toBe('cyberpunk')
  })
})
