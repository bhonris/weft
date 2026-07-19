import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { Explorer } from './Explorer'
import { useViewerStore } from '../store/viewer-store'
import { emptyOpenFiles } from '@core/workspace/open-files'
import type { DirEntry } from '@shared/ipc/api-contract'

const listDir = vi.fn<(path: string) => Promise<DirEntry[]>>()
const openWithDefault = vi.fn(async () => {})

const watchDir = vi.fn(async () => ({ watchId: 'w1' }))
const unwatchDir = vi.fn(async () => {})
let fsChangeCb: ((e: { watchId: string; type: string; path: string }) => void) | null = null
const onFsChange = vi.fn((cb: (e: { watchId: string; type: string; path: string }) => void) => {
  fsChangeCb = cb
  return () => {
    fsChangeCb = null
  }
})

beforeEach(() => {
  listDir.mockReset()
  openWithDefault.mockClear()
  watchDir.mockClear()
  unwatchDir.mockClear()
  onFsChange.mockClear()
  fsChangeCb = null
  useViewerStore.setState({ openFiles: emptyOpenFiles, file: null, mode: 'view' })
  Object.defineProperty(window, 'api', {
    value: { listDir, openWithDefault, watchDir, unwatchDir, onFsChange },
    configurable: true
  })
})

afterEach(cleanup)

const entry = (name: string, kind: DirEntry['kind'], base = '/p'): DirEntry => ({
  name,
  path: `${base}/${name}`,
  kind
})

describe('Explorer', () => {
  it('shows a placeholder when no project is open', () => {
    render(<Explorer root={null} />)
    expect(screen.getByText('No project open')).toBeDefined()
    expect(listDir).not.toHaveBeenCalled()
  })

  it('lists the root directory', async () => {
    listDir.mockResolvedValueOnce([entry('src', 'dir'), entry('README.md', 'file')])
    render(<Explorer root="/p" />)
    await waitFor(() => expect(screen.getByText('src')).toBeDefined())
    expect(screen.getByText('README.md')).toBeDefined()
    expect(listDir).toHaveBeenCalledWith('/p')
  })

  it('lazily loads and toggles a directory on click', async () => {
    listDir.mockResolvedValueOnce([entry('src', 'dir')])
    listDir.mockResolvedValue([entry('index.ts', 'file', '/p/src')])
    render(<Explorer root="/p" />)
    await waitFor(() => screen.getByText('src'))

    fireEvent.click(screen.getByText('src'))
    await waitFor(() => expect(screen.getByText('index.ts')).toBeDefined())
    expect(listDir).toHaveBeenCalledWith('/p/src')

    // Collapse hides children; re-expand refetches so the tree stays current.
    fireEvent.click(screen.getByText('src'))
    expect(screen.queryByText('index.ts')).toBeNull()
    fireEvent.click(screen.getByText('src'))
    await waitFor(() => expect(screen.getByText('index.ts')).toBeDefined())
  })

  it('an fs change event refreshes the root listing', async () => {
    listDir.mockResolvedValueOnce([entry('a.txt', 'file')])
    render(<Explorer root="/p" />)
    await waitFor(() => screen.getByText('a.txt'))
    await waitFor(() => expect(watchDir).toHaveBeenCalledWith('/p'))

    listDir.mockResolvedValueOnce([entry('a.txt', 'file'), entry('b.txt', 'file')])
    fsChangeCb?.({ watchId: 'w1', type: 'add', path: '/p/b.txt' })
    await waitFor(() => expect(screen.getByText('b.txt')).toBeDefined())
  })

  it('ignores fs events from other watches', async () => {
    listDir.mockResolvedValueOnce([entry('a.txt', 'file')])
    render(<Explorer root="/p" />)
    await waitFor(() => screen.getByText('a.txt'))
    await waitFor(() => expect(watchDir).toHaveBeenCalled())

    fsChangeCb?.({ watchId: 'other', type: 'add', path: '/q/x.txt' })
    expect(listDir).toHaveBeenCalledTimes(1)
  })

  it('single click opens a file in the in-app viewer', async () => {
    listDir.mockResolvedValueOnce([entry('notes.txt', 'file')])
    render(<Explorer root="/p" />)
    await waitFor(() => screen.getByText('notes.txt'))
    fireEvent.click(screen.getByText('notes.txt'))
    expect(useViewerStore.getState().file).toEqual({ path: '/p/notes.txt', name: 'notes.txt' })
    expect(openWithDefault).not.toHaveBeenCalled()
  })

  it('double click opens a file with the OS default handler', async () => {
    listDir.mockResolvedValueOnce([entry('notes.txt', 'file')])
    render(<Explorer root="/p" />)
    await waitFor(() => screen.getByText('notes.txt'))
    fireEvent.doubleClick(screen.getByText('notes.txt'))
    await waitFor(() => expect(openWithDefault).toHaveBeenCalledWith('/p/notes.txt'))
  })

  it('shows an error state when the root cannot be read', async () => {
    listDir.mockRejectedValueOnce(new Error('EPERM'))
    render(<Explorer root="/locked" />)
    await waitFor(() => expect(screen.getByText(/Cannot read folder: EPERM/)).toBeDefined())
  })

  it('ArrowDown/ArrowUp move the roving selection (keyboard nav)', async () => {
    listDir.mockResolvedValueOnce([entry('src', 'dir'), entry('README.md', 'file')])
    render(<Explorer root="/p" />)
    await waitFor(() => screen.getByText('src'))
    const tree = screen.getByTestId('explorer-tree')

    const liOf = (text: string): HTMLElement | null => screen.getByText(text).closest('li')
    // First node selected by default.
    expect(liOf('src')?.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(tree, { key: 'ArrowDown' })
    expect(liOf('README.md')?.getAttribute('aria-selected')).toBe('true')
    expect(liOf('src')?.getAttribute('aria-selected')).toBe('false')
    // Roving tabindex: exactly one node is a tab stop.
    expect(screen.getByText('README.md').getAttribute('tabindex')).toBe('0')
    expect(screen.getByText('src').getAttribute('tabindex')).toBe('-1')

    fireEvent.keyDown(tree, { key: 'ArrowUp' })
    expect(liOf('src')?.getAttribute('aria-selected')).toBe('true')
  })

  it('ArrowRight expands a directory and ArrowLeft collapses it', async () => {
    listDir.mockResolvedValueOnce([entry('src', 'dir')])
    listDir.mockResolvedValue([entry('index.ts', 'file', '/p/src')])
    render(<Explorer root="/p" />)
    await waitFor(() => screen.getByText('src'))
    const tree = screen.getByTestId('explorer-tree')

    fireEvent.keyDown(tree, { key: 'ArrowRight' }) // expand
    await waitFor(() => expect(screen.getByText('index.ts')).toBeDefined())
    expect(screen.getByText('src').closest('li')?.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(tree, { key: 'ArrowLeft' }) // collapse
    expect(screen.queryByText('index.ts')).toBeNull()
    expect(screen.getByText('src').closest('li')?.getAttribute('aria-expanded')).toBe('false')
  })

  it('Home/End jump to the first/last visible node', async () => {
    listDir.mockResolvedValueOnce([
      entry('src', 'dir'),
      entry('README.md', 'file'),
      entry('LICENSE', 'file')
    ])
    render(<Explorer root="/p" />)
    await waitFor(() => screen.getByText('LICENSE'))
    const tree = screen.getByTestId('explorer-tree')
    const liOf = (t: string): HTMLElement | null => screen.getByText(t).closest('li')

    fireEvent.keyDown(tree, { key: 'End' })
    expect(liOf('LICENSE')?.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tree, { key: 'Home' })
    expect(liOf('src')?.getAttribute('aria-selected')).toBe('true')
  })

  it('ArrowLeft on a child moves selection to its parent (not collapse)', async () => {
    listDir.mockResolvedValueOnce([entry('src', 'dir')])
    listDir.mockResolvedValue([entry('index.ts', 'file', '/p/src')])
    render(<Explorer root="/p" />)
    await waitFor(() => screen.getByText('src'))
    const tree = screen.getByTestId('explorer-tree')

    fireEvent.keyDown(tree, { key: 'ArrowRight' }) // expand src
    await waitFor(() => screen.getByText('index.ts'))
    fireEvent.keyDown(tree, { key: 'ArrowDown' }) // select index.ts (child)
    expect(screen.getByText('index.ts').closest('li')?.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(tree, { key: 'ArrowLeft' }) // → parent, dir stays expanded
    expect(screen.getByText('src').closest('li')?.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('src').closest('li')?.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('index.ts')).toBeDefined() // still visible (not collapsed)
  })

  it('Enter opens the selected file in the viewer', async () => {
    listDir.mockResolvedValueOnce([entry('a.dir', 'dir'), entry('notes.txt', 'file')])
    render(<Explorer root="/p" />)
    await waitFor(() => screen.getByText('notes.txt'))
    const tree = screen.getByTestId('explorer-tree')

    fireEvent.keyDown(tree, { key: 'ArrowDown' }) // move to notes.txt
    fireEvent.keyDown(tree, { key: 'Enter' })
    expect(useViewerStore.getState().file).toEqual({ path: '/p/notes.txt', name: 'notes.txt' })
  })

  it('exposes aria-level for nesting depth', async () => {
    listDir.mockResolvedValueOnce([entry('src', 'dir')])
    listDir.mockResolvedValue([entry('index.ts', 'file', '/p/src')])
    render(<Explorer root="/p" />)
    await waitFor(() => screen.getByText('src'))
    expect(screen.getByText('src').closest('li')?.getAttribute('aria-level')).toBe('1')

    fireEvent.click(screen.getByText('src'))
    await waitFor(() => screen.getByText('index.ts'))
    expect(screen.getByText('index.ts').closest('li')?.getAttribute('aria-level')).toBe('2')
  })

  it('renders empty children for an unreadable subdirectory', async () => {
    listDir.mockResolvedValueOnce([entry('secret', 'dir')])
    listDir.mockRejectedValueOnce(new Error('EACCES'))
    render(<Explorer root="/p" />)
    await waitFor(() => screen.getByText('secret'))
    fireEvent.click(screen.getByText('secret'))
    await waitFor(() =>
      expect(screen.getByText('secret').closest('li')?.getAttribute('aria-expanded')).toBe('true')
    )
  })
})
