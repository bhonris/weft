import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { KeybindingsEditor } from './KeybindingsEditor'
import type { Command } from '@core/commands/registry'

// First row is a bindable command (has a chord form); the theme command is not.
const CMDS: Command[] = [
  { id: 'tab.new', title: 'New Tab', category: 'Tabs', shortcutHint: 'Ctrl+T', routes: 'new-tab' },
  {
    id: 'general.commandPalette',
    title: 'Command Palette',
    category: 'General',
    shortcutHint: 'Ctrl+Shift+P',
    routes: 'command-palette'
  },
  { id: 'general.cycleTheme', title: 'Cycle Theme', category: 'General' }
]

afterEach(cleanup)

const dialog = (): HTMLElement => screen.getByRole('dialog')

describe('KeybindingsEditor', () => {
  it('renders nothing when closed', () => {
    render(<KeybindingsEditor open={false} overrides={{}} onChange={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByTestId('keybindings-editor')).toBeNull()
  })

  it('lists only bindable commands with their current chord', () => {
    render(<KeybindingsEditor open overrides={{}} commands={CMDS} onChange={vi.fn()} onClose={vi.fn()} />)
    const options = screen.getAllByRole('option')
    // cycleTheme (no chord form) is excluded.
    expect(options).toHaveLength(2)
    expect(options[0]!.textContent).toContain('New Tab')
    expect(options[0]!.textContent).toContain('Ctrl')
  })

  it('captures a new chord and rebinds the active command (moving its default)', () => {
    const onChange = vi.fn()
    render(<KeybindingsEditor open overrides={{}} commands={CMDS} onChange={onChange} onClose={vi.fn()} />)
    // active row 0 = New Tab. Enter → capture, then press Ctrl+Shift+G.
    fireEvent.keyDown(dialog(), { key: 'Enter' })
    fireEvent.keyDown(dialog(), { key: 'g', ctrlKey: true, shiftKey: true })
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]![0] as Record<string, string>
    expect(next['ctrl+shift+g']).toBe('tab.new')
    expect(next['ctrl+t']).toBe('') // old default unbound
  })

  it('refuses a protected chord and does not persist', () => {
    const onChange = vi.fn()
    render(<KeybindingsEditor open overrides={{}} commands={CMDS} onChange={onChange} onClose={vi.fn()} />)
    fireEvent.keyDown(dialog(), { key: 'Enter' })
    fireEvent.keyDown(dialog(), { key: 'c', ctrlKey: true }) // Ctrl+C — reserved
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toMatch(/reserved/i)
  })

  it('resets the active command to default on Backspace', () => {
    const onChange = vi.fn()
    render(
      <KeybindingsEditor
        open
        overrides={{ 'ctrl+shift+g': 'tab.new', 'ctrl+t': '' }}
        commands={CMDS}
        onChange={onChange}
        onClose={vi.fn()}
      />
    )
    fireEvent.keyDown(dialog(), { key: 'Backspace' })
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]![0] as Record<string, string>
    expect('ctrl+shift+g' in next).toBe(false)
    expect('ctrl+t' in next).toBe(false) // suppressed default restored
  })

  it('reset-all clears every override', () => {
    const onChange = vi.fn()
    render(
      <KeybindingsEditor
        open
        overrides={{ 'ctrl+shift+g': 'tab.new' }}
        commands={CMDS}
        onChange={onChange}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByLabelText('reset all keybindings'))
    expect(onChange).toHaveBeenCalledWith({})
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<KeybindingsEditor open overrides={{}} commands={CMDS} onChange={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(dialog(), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('Escape during capture cancels the capture, not the dialog', () => {
    const onClose = vi.fn()
    render(<KeybindingsEditor open overrides={{}} commands={CMDS} onChange={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(dialog(), { key: 'Enter' }) // start capture
    fireEvent.keyDown(dialog(), { key: 'Escape' }) // cancel capture
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toMatch(/cancel/i)
  })
})
