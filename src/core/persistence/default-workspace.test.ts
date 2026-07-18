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
  })

  // Regression guard: cyberpunk is the out-of-the-box default theme. A fresh
  // launch (and the corruption fallback) must open in cyberpunk.
  it('defaults the theme to cyberpunk', () => {
    expect(defaultWorkspace().theme).toBe('cyberpunk')
  })
})
