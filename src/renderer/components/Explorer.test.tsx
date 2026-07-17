import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { Explorer } from './Explorer'
import { useViewerStore } from '../store/viewer-store'
import type { DirEntry } from '@shared/ipc/api-contract'

const listDir = vi.fn<(path: string) => Promise<DirEntry[]>>()
const openWithDefault = vi.fn(async () => {})

beforeEach(() => {
  listDir.mockReset()
  openWithDefault.mockClear()
  useViewerStore.setState({ file: null, mode: 'view' })
  Object.defineProperty(window, 'api', {
    value: { listDir, openWithDefault },
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
    listDir.mockResolvedValueOnce([entry('index.ts', 'file', '/p/src')])
    render(<Explorer root="/p" />)
    await waitFor(() => screen.getByText('src'))

    fireEvent.click(screen.getByText('src'))
    await waitFor(() => expect(screen.getByText('index.ts')).toBeDefined())
    expect(listDir).toHaveBeenCalledWith('/p/src')

    // Collapse: children hidden, no refetch on re-expand
    fireEvent.click(screen.getByText('src'))
    expect(screen.queryByText('index.ts')).toBeNull()
    fireEvent.click(screen.getByText('src'))
    await waitFor(() => expect(screen.getByText('index.ts')).toBeDefined())
    expect(listDir).toHaveBeenCalledTimes(2)
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
