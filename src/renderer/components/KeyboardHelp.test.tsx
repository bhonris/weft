import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { KeyboardHelp } from './KeyboardHelp'
import type { Command } from '@core/commands/registry'

const CMDS: Command[] = [
  { id: 'general.commandPalette', title: 'Command Palette', category: 'General', shortcutHint: 'Ctrl+Shift+P', routes: 'command-palette' },
  { id: 'tab.new', title: 'New Tab', category: 'Tabs', shortcutHint: 'Ctrl+T', routes: 'new-tab' },
  { id: 'tab.rename', title: 'Rename Tab', category: 'Tabs', shortcutHint: 'F2' },
  { id: 'tab.openProject', title: 'Open Project…', category: 'Tabs' } // no shortcut → omitted
]

afterEach(cleanup)

describe('KeyboardHelp', () => {
  it('renders nothing when closed', () => {
    render(<KeyboardHelp open={false} commands={CMDS} onClose={vi.fn()} />)
    expect(screen.queryByTestId('keyboard-help')).toBeNull()
  })

  it('shows only shortcut-bearing commands, grouped by category, with keys', () => {
    render(<KeyboardHelp open commands={CMDS} onClose={vi.fn()} />)
    expect(screen.getByText('Command Palette')).toBeTruthy()
    expect(screen.getByText('New Tab')).toBeTruthy()
    expect(screen.getByText('Rename Tab')).toBeTruthy()
    // A command without a shortcut hint is not a "shortcut" — excluded here.
    expect(screen.queryByText('Open Project…')).toBeNull()
    // Category headings present.
    expect(screen.getByText('General')).toBeTruthy()
    expect(screen.getByText('Tabs')).toBeTruthy()
    // Shortcut labels rendered.
    expect(screen.getByText('Ctrl+Shift+P')).toBeTruthy()
    expect(screen.getByText('F2')).toBeTruthy()
  })

  it('focuses the dialog on open and is labelled', () => {
    render(<KeyboardHelp open commands={CMDS} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    expect(document.activeElement).toBe(dialog)
  })

  it('Escape closes', () => {
    const onClose = vi.fn()
    render(<KeyboardHelp open commands={CMDS} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('the close button closes', () => {
    const onClose = vi.fn()
    render(<KeyboardHelp open commands={CMDS} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('restores focus to the previously-focused element on close', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender } = render(<KeyboardHelp open commands={CMDS} onClose={vi.fn()} />)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))

    rerender(<KeyboardHelp open={false} commands={CMDS} onClose={vi.fn()} />)
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
