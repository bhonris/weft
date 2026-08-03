import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from './viewer-store'
import { emptyOpenFiles } from '@core/workspace/open-files'

beforeEach(() => {
  useViewerStore.setState({
    byProject: {},
    projectId: null,
    openFiles: emptyOpenFiles,
    file: null,
    mode: 'view',
    editing: false,
    preview: false,
    saveTick: 0,
    reveal: null
  })
})

describe('useViewerStore', () => {
  it('opens a file in view mode', () => {
    useViewerStore.getState().openFile('/p/a.txt', 'a.txt')
    const s = useViewerStore.getState()
    expect(s.file).toEqual({ path: '/p/a.txt', name: 'a.txt' })
    expect(s.mode).toBe('view')
  })

  it('openGitDiff opens the file in diff mode with the git side stamped', () => {
    useViewerStore.getState().openGitDiff('/p/a.txt', 'a.txt', 'unstaged')
    const s = useViewerStore.getState()
    expect(s.file).toEqual({ path: '/p/a.txt', name: 'a.txt', git: 'unstaged' })
    expect(s.mode).toBe('diff')
    expect(s.editing).toBe(false)
  })

  it('re-opening a git-diff tab from the explorer clears the git side', () => {
    const s = useViewerStore.getState()
    s.openGitDiff('/p/a.txt', 'a.txt', 'staged')
    expect(useViewerStore.getState().file?.git).toBe('staged')
    // A plain open of the same path strips the git side so a subsequent diff
    // toggle compares vs HEAD rather than the staged/unstaged blob.
    s.openFile('/p/a.txt', 'a.txt')
    expect(useViewerStore.getState().file?.git).toBeUndefined()
  })

  it('openFileAt opens the file and sets a reveal target for the position', () => {
    useViewerStore.getState().openFileAt('/p/a.ts', 'a.ts', 42, 7)
    const s = useViewerStore.getState()
    expect(s.file).toEqual({ path: '/p/a.ts', name: 'a.ts' })
    expect(s.reveal).toEqual({ path: '/p/a.ts', line: 42, column: 7, tick: 1 })
  })

  it('openFileAt defaults the column to 1 when omitted', () => {
    useViewerStore.getState().openFileAt('/p/a.ts', 'a.ts', 10)
    expect(useViewerStore.getState().reveal).toEqual({
      path: '/p/a.ts',
      line: 10,
      column: 1,
      tick: 1
    })
  })

  it('openFileAt without a line opens the file and leaves reveal untouched', () => {
    useViewerStore.getState().openFileAt('/p/a.ts', 'a.ts')
    const s = useViewerStore.getState()
    expect(s.file).toEqual({ path: '/p/a.ts', name: 'a.ts' })
    expect(s.reveal).toBeNull()
  })

  it('openFileAt increments the reveal tick on repeat jumps', () => {
    const s = useViewerStore.getState()
    s.openFileAt('/p/a.ts', 'a.ts', 1)
    s.openFileAt('/p/a.ts', 'a.ts', 5)
    expect(useViewerStore.getState().reveal).toMatchObject({ line: 5, tick: 2 })
  })

  it('opening a DIFFERENT file after a git diff resets mode to view', () => {
    const s = useViewerStore.getState()
    s.openGitDiff('/p/a.txt', 'a.txt', 'staged')
    s.openFile('/p/b.txt', 'b.txt')
    expect(useViewerStore.getState().mode).toBe('view')
    expect(useViewerStore.getState().file?.git).toBeUndefined()
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

  it('close is a no-op when nothing is open', () => {
    useViewerStore.getState().close()
    expect(useViewerStore.getState().file).toBeNull()
    expect(useViewerStore.getState().openFiles.files).toHaveLength(0)
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

  describe('markdown preview toggle', () => {
    it('setPreview flips the preview flag', () => {
      const s = useViewerStore.getState()
      s.openFile('/p/readme.md', 'readme.md')
      expect(useViewerStore.getState().preview).toBe(false) // raw by default
      useViewerStore.getState().setPreview(true)
      expect(useViewerStore.getState().preview).toBe(true)
      useViewerStore.getState().setPreview(false)
      expect(useViewerStore.getState().preview).toBe(false)
    })

    it('switching to a different file resets preview to raw source', () => {
      const s = useViewerStore.getState()
      s.openFile('/p/a.md', 'a.md')
      s.setPreview(true)
      s.openFile('/p/b.md', 'b.md')
      expect(useViewerStore.getState().preview).toBe(false)
    })

    it('entering edit mode or diff turns the preview off', () => {
      const s = useViewerStore.getState()
      s.openFile('/p/a.md', 'a.md')
      s.setPreview(true)
      s.setEditing(true)
      expect(useViewerStore.getState().preview).toBe(false)

      useViewerStore.getState().setPreview(true)
      useViewerStore.getState().setMode('diff')
      expect(useViewerStore.getState().preview).toBe(false)
    })

    it('re-selecting the active file keeps the preview open', () => {
      const s = useViewerStore.getState()
      s.openFile('/p/a.md', 'a.md')
      s.setPreview(true)
      useViewerStore.getState().openFile('/p/a.md', 'a.md')
      expect(useViewerStore.getState().preview).toBe(true)
    })

    it('switching project resets preview', () => {
      const s = useViewerStore.getState()
      s.setProject('t1')
      s.openFile('/proj1/a.md', 'a.md')
      s.setPreview(true)
      useViewerStore.getState().setProject('t2')
      expect(useViewerStore.getState().preview).toBe(false)
    })
  })

  describe('per-project scoping (regression: files were global)', () => {
    it('keeps a separate file set per project and swaps on setProject', () => {
      const s = useViewerStore.getState()
      s.setProject('t1')
      s.openFile('/proj1/a.txt', 'a.txt')
      expect(useViewerStore.getState().file?.path).toBe('/proj1/a.txt')

      // Switch to another project: its (empty) set shows, NOT project 1's file.
      useViewerStore.getState().setProject('t2')
      expect(useViewerStore.getState().file).toBeNull()
      expect(useViewerStore.getState().openFiles.files).toHaveLength(0)

      useViewerStore.getState().openFile('/proj2/z.txt', 'z.txt')
      expect(useViewerStore.getState().file?.path).toBe('/proj2/z.txt')

      // Switching back restores project 1's file (still open, not lost).
      useViewerStore.getState().setProject('t1')
      expect(useViewerStore.getState().file?.path).toBe('/proj1/a.txt')
    })

    it('setProject(null) clears the visible editor but preserves each set', () => {
      const s = useViewerStore.getState()
      s.setProject('t1')
      s.openFile('/proj1/a.txt', 'a.txt')
      useViewerStore.getState().setProject(null)
      expect(useViewerStore.getState().file).toBeNull()
      useViewerStore.getState().setProject('t1')
      expect(useViewerStore.getState().file?.path).toBe('/proj1/a.txt')
    })

    it('re-selecting the current project is a no-op (keeps edit mode)', () => {
      const s = useViewerStore.getState()
      s.setProject('t1')
      s.openFile('/proj1/a.txt', 'a.txt')
      s.setEditing(true)
      useViewerStore.getState().setProject('t1')
      expect(useViewerStore.getState().editing).toBe(true)
    })

    it('dropProject discards a closed project and clears it if it was showing', () => {
      const s = useViewerStore.getState()
      s.setProject('t1')
      s.openFile('/proj1/a.txt', 'a.txt')
      useViewerStore.getState().dropProject('t1')
      expect(useViewerStore.getState().file).toBeNull()
      // Re-selecting the dropped project starts empty (files were forgotten).
      useViewerStore.getState().setProject('t1')
      expect(useViewerStore.getState().openFiles.files).toHaveLength(0)
    })

    it('dropping a non-showing project leaves the active editor untouched', () => {
      const s = useViewerStore.getState()
      s.setProject('t1')
      s.openFile('/proj1/a.txt', 'a.txt')
      s.setProject('t2')
      s.openFile('/proj2/z.txt', 'z.txt')
      // Close project 1 while project 2 is showing.
      useViewerStore.getState().dropProject('t1')
      expect(useViewerStore.getState().file?.path).toBe('/proj2/z.txt')
    })
  })
})
