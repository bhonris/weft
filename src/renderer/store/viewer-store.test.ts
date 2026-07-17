import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from './viewer-store'

beforeEach(() => {
  useViewerStore.setState({ file: null, mode: 'view' })
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
})
