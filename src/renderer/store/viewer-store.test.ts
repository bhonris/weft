import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from './viewer-store'
import { emptyOpenFiles } from '@core/workspace/open-files'

beforeEach(() => {
  useViewerStore.setState({
    openFiles: emptyOpenFiles,
    file: null,
    mode: 'view',
    editing: false,
    saveTick: 0
  })
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

  it('opens multiple files as tabs and switches between them', () => {
    const s = useViewerStore.getState()
    s.openFile('/p/a.txt', 'a.txt')
    s.openFile('/p/b.txt', 'b.txt')
    expect(useViewerStore.getState().openFiles.files.map((f) => f.path)).toEqual([
      '/p/a.txt',
      '/p/b.txt'
    ])
    expect(useViewerStore.getState().file?.path).toBe('/p/b.txt') // newest active
    useViewerStore.getState().setActiveFile(0)
    expect(useViewerStore.getState().file?.path).toBe('/p/a.txt')
  })

  it('re-opening an already-open file re-activates its tab (no duplicate)', () => {
    const s = useViewerStore.getState()
    s.openFile('/p/a.txt', 'a.txt')
    s.openFile('/p/b.txt', 'b.txt')
    useViewerStore.getState().openFile('/p/a.txt', 'a.txt')
    expect(useViewerStore.getState().openFiles.files).toHaveLength(2)
    expect(useViewerStore.getState().file?.path).toBe('/p/a.txt')
  })

  it('re-opening the ACTIVE file keeps edit mode (does not reload/lose edits)', () => {
    const s = useViewerStore.getState()
    s.openFile('/p/a.txt', 'a.txt')
    s.setEditing(true)
    // Re-open the file that's already active — must NOT drop editing.
    useViewerStore.getState().openFile('/p/a.txt', 'a.txt')
    expect(useViewerStore.getState().editing).toBe(true)
    // setActiveFile onto the same index is likewise a no-reset.
    useViewerStore.getState().setActiveFile(0)
    expect(useViewerStore.getState().editing).toBe(true)
  })

  it('switching to a DIFFERENT tab resets to view mode', () => {
    const s = useViewerStore.getState()
    s.openFile('/p/a.txt', 'a.txt')
    s.openFile('/p/b.txt', 'b.txt')
    s.setMode('diff')
    s.setActiveFile(0) // switch to a.txt
    expect(useViewerStore.getState().mode).toBe('view')
    expect(useViewerStore.getState().editing).toBe(false)
  })

  it('closeFile drops a tab and activates the neighbour; last close clears', () => {
    const s = useViewerStore.getState()
    s.openFile('/p/a.txt', 'a.txt')
    s.openFile('/p/b.txt', 'b.txt')
    useViewerStore.getState().closeFile('/p/b.txt')
    expect(useViewerStore.getState().file?.path).toBe('/p/a.txt')
    useViewerStore.getState().closeFile('/p/a.txt')
    expect(useViewerStore.getState().file).toBeNull()
  })
})
