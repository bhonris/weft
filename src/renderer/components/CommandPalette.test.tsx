import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CommandPalette } from './CommandPalette'
import type { Command } from '@core/commands/registry'

const CMDS: Command[] = [
  { id: 'tab.new', title: 'New Tab', category: 'Tabs', shortcutHint: 'Ctrl+T', routes: 'new-tab' },
  { id: 'tab.close', title: 'Close Tab', category: 'Tabs' },
  { id: 'general.cycleTheme', title: 'Cycle Theme', category: 'General' }
]

afterEach(cleanup)

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    render(<CommandPalette open={false} commands={CMDS} onRun={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByTestId('command-palette')).toBeNull()
  })

  it('lists every command as an accessible option and focuses the input', () => {
    render(<CommandPalette open commands={CMDS} onRun={vi.fn()} onClose={vi.fn()} />)
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    expect(document.activeElement).toBe(screen.getByRole('combobox'))
    // First option is highlighted by default.
    expect(options[0]!.getAttribute('aria-selected')).toBe('true')
  })

  it('fuzzy-filters as the user types', () => {
    render(<CommandPalette open commands={CMDS} onRun={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'theme' } })
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]!.textContent).toContain('Cycle Theme')
  })

  it('shows an empty state when nothing matches', () => {
    render(<CommandPalette open commands={CMDS} onRun={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzzz' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('No matching commands')).toBeTruthy()
  })

  it('ArrowDown/ArrowUp move the highlight (with aria-activedescendant)', () => {
    render(<CommandPalette open commands={CMDS} onRun={vi.fn()} onClose={vi.fn()} />)
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    let options = screen.getAllByRole('option')
    expect(options[1]!.getAttribute('aria-selected')).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]!.id)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    options = screen.getAllByRole('option')
    expect(options[0]!.getAttribute('aria-selected')).toBe('true')
  })

  it('Enter runs the highlighted command and closes', () => {
    const onRun = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette open commands={CMDS} onRun={onRun} onClose={onClose} />)
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // highlight 'Close Tab'
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRun).toHaveBeenCalledWith('tab.close')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape closes without running anything', () => {
    const onRun = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette open commands={CMDS} onRun={onRun} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onRun).not.toHaveBeenCalled()
  })

  it('restores focus to the previously-focused element on close', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const { rerender } = render(
      <CommandPalette open commands={CMDS} onRun={vi.fn()} onClose={vi.fn()} />
    )
    expect(document.activeElement).toBe(screen.getByRole('combobox'))

    rerender(<CommandPalette open={false} commands={CMDS} onRun={vi.fn()} onClose={vi.fn()} />)
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
