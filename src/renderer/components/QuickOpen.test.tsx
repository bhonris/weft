import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { QuickOpen } from './QuickOpen'
import type { IndexedFile } from '@shared/ipc/api-contract'

const FILES: IndexedFile[] = [
  { name: 'index.ts', path: '/p/src/index.ts', rel: 'src/index.ts' },
  { name: 'app.tsx', path: '/p/src/app.tsx', rel: 'src/app.tsx' },
  { name: 'README.md', path: '/p/README.md', rel: 'README.md' }
]

const load = () => vi.fn(async () => FILES)

afterEach(cleanup)

describe('QuickOpen', () => {
  it('renders nothing when closed', () => {
    render(
      <QuickOpen open={false} cwd="/p" onOpen={vi.fn()} onClose={vi.fn()} loadFiles={load()} />
    )
    expect(screen.queryByTestId('quick-open')).toBeNull()
  })

  it('indexes the project, lists files, and focuses the input', async () => {
    const loadFiles = load()
    render(<QuickOpen open cwd="/p" onOpen={vi.fn()} onClose={vi.fn()} loadFiles={loadFiles} />)
    expect(loadFiles).toHaveBeenCalledWith('/p')
    expect(document.activeElement).toBe(screen.getByRole('combobox'))
    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(3)
    // The directory path is shown as a secondary label; root files show none.
    expect(options[0]!.textContent).toContain('src')
    expect(options.find((o) => o.textContent?.includes('README.md'))!.textContent).toBe('README.md')
  })

  it('shows an indexing state while the walk is in flight', () => {
    // A promise that never resolves keeps the finder in its loading state.
    const loadFiles = vi.fn(() => new Promise<IndexedFile[]>(() => {}))
    render(<QuickOpen open cwd="/p" onOpen={vi.fn()} onClose={vi.fn()} loadFiles={loadFiles} />)
    expect(screen.getByText('Indexing files…')).toBeTruthy()
  })

  it('shows a no-project state and does not index when cwd is null', () => {
    const loadFiles = load()
    render(<QuickOpen open cwd={null} onOpen={vi.fn()} onClose={vi.fn()} loadFiles={loadFiles} />)
    expect(loadFiles).not.toHaveBeenCalled()
    expect(screen.getByText('Open a project to search its files')).toBeTruthy()
  })

  it('degrades to an empty state when indexing fails', async () => {
    const loadFiles = vi.fn(async () => {
      throw new Error('outside an open project')
    })
    render(<QuickOpen open cwd="/p" onOpen={vi.fn()} onClose={vi.fn()} loadFiles={loadFiles} />)
    await waitFor(() => expect(screen.getByText('No matching files')).toBeTruthy())
  })

  it('fuzzy-filters files as the user types', async () => {
    render(<QuickOpen open cwd="/p" onOpen={vi.fn()} onClose={vi.fn()} loadFiles={load()} />)
    await screen.findAllByRole('option')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'app' } })
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]!.textContent).toContain('app.tsx')
  })

  it('indexes once per open — typing does not re-run the walk (regression)', async () => {
    // Regression: an unstable loadFiles identity used to refire the load effect
    // on every keystroke, resetting the query and looping on "Indexing files…".
    const loadFiles = load()
    render(<QuickOpen open cwd="/p" onOpen={vi.fn()} onClose={vi.fn()} loadFiles={loadFiles} />)
    await screen.findAllByRole('option')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'app' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'app.tsx' } })
    // The query survived (wasn't wiped) and the project was walked exactly once.
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('app.tsx')
    expect(loadFiles).toHaveBeenCalledTimes(1)
  })

  it('shows an empty state when nothing matches', async () => {
    render(<QuickOpen open cwd="/p" onOpen={vi.fn()} onClose={vi.fn()} loadFiles={load()} />)
    await screen.findAllByRole('option')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzzz' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('No matching files')).toBeTruthy()
  })

  it('ArrowDown/ArrowUp move the highlight', async () => {
    render(<QuickOpen open cwd="/p" onOpen={vi.fn()} onClose={vi.fn()} loadFiles={load()} />)
    await screen.findAllByRole('option')
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    let options = screen.getAllByRole('option')
    expect(options[1]!.getAttribute('aria-selected')).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]!.id)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    options = screen.getAllByRole('option')
    expect(options[0]!.getAttribute('aria-selected')).toBe('true')
  })

  it('Enter opens the highlighted file and closes', async () => {
    const onOpen = vi.fn()
    const onClose = vi.fn()
    render(<QuickOpen open cwd="/p" onOpen={onOpen} onClose={onClose} loadFiles={load()} />)
    await screen.findAllByRole('option')
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // highlight app.tsx
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onOpen).toHaveBeenCalledWith('/p/src/app.tsx', 'app.tsx')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking a file opens it', async () => {
    const onOpen = vi.fn()
    const onClose = vi.fn()
    render(<QuickOpen open cwd="/p" onOpen={onOpen} onClose={onClose} loadFiles={load()} />)
    const options = await screen.findAllByRole('option')
    fireEvent.mouseDown(options[2]!) // README.md
    expect(onOpen).toHaveBeenCalledWith('/p/README.md', 'README.md')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape closes without opening anything', async () => {
    const onOpen = vi.fn()
    const onClose = vi.fn()
    render(<QuickOpen open cwd="/p" onOpen={onOpen} onClose={onClose} loadFiles={load()} />)
    await screen.findAllByRole('option')
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('clicking the backdrop closes', async () => {
    const onClose = vi.fn()
    render(<QuickOpen open cwd="/p" onOpen={vi.fn()} onClose={onClose} loadFiles={load()} />)
    await screen.findAllByRole('option')
    fireEvent.mouseDown(screen.getByTestId('quick-open'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('restores focus to the previously-focused element on close', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender } = render(
      <QuickOpen open cwd="/p" onOpen={vi.fn()} onClose={vi.fn()} loadFiles={load()} />
    )
    expect(document.activeElement).toBe(screen.getByRole('combobox'))

    rerender(
      <QuickOpen open={false} cwd="/p" onOpen={vi.fn()} onClose={vi.fn()} loadFiles={load()} />
    )
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
