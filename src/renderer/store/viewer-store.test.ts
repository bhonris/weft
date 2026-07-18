import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from './viewer-store'

beforeEach(() => {
  useViewerStore.setState({ file: null, mode: 'view', editing: false, saveTick: 0 })
})

describe('useViewerStore', () => {
  it('opens a file in view mode', () => {
    useViewerStore.getState().openFile('/p/a.txt', 'a.txt')
    const s = useViewerStore.getState()
    expect(s.file).toEqual({ path: '/p/a.txt', name: 'a.txt' })
    expect(s.mode).toBe('view')
  })

  it('opening a new file resets diff mode back to view', () => {
    const s = useViewerStore.getState()
    s.openFile('/p/a.txt', 'a.txt')
    s.setMode('diff')
    expect(useViewerStore.getState().mode).toBe('diff')
    useViewerStore.getState().openFile('/p/b.txt', 'b.txt')
    expect(useViewerStore.getState().mode).toBe('view')
  })

  it('close clears the open file', () => {
    useViewerStore.getState().openFile('/p/a.txt', 'a.txt')
    useViewerStore.getState().close()
    expect(useViewerStore.getState().file).toBeNull()
  })

  it('setEditing(true) implies view mode; switching to diff drops editing', () => {
    const s = useViewerStore.getState()
    s.openFile('/p/a.txt', 'a.txt')
    s.setMode('diff')
    s.setEditing(true)
    expect(useViewerStore.getState().mode).toBe('view')
    expect(useViewerStore.getState().editing).toBe(true)

    useViewerStore.getState().setMode('diff')
    expect(useViewerStore.getState().editing).toBe(false)
  })

  it('opening a file and closing it resets editing', () => {
    const s = useViewerStore.getState()
    s.openFile('/p/a.txt', 'a.txt')
    s.setEditing(true)
    s.openFile('/p/b.txt', 'b.txt')
    expect(useViewerStore.getState().editing).toBe(false)
    useViewerStore.getState().setEditing(true)
    useViewerStore.getState().close()
    expect(useViewerStore.getState().editing).toBe(false)
  })

  it('requestSave bumps saveTick monotonically', () => {
    const before = useViewerStore.getState().saveTick
    useViewerStore.getState().requestSave()
    useViewerStore.getState().requestSave()
    expect(useViewerStore.getState().saveTick).toBe(before + 2)
  })
})
