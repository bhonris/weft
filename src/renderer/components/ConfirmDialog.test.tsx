import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'

afterEach(cleanup)

const props = {
  title: 'Close project?',
  message: 'This ends the Claude session.',
  confirmLabel: 'Close project'
}

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(<ConfirmDialog open={false} {...props} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByTestId('confirm-dialog')).toBeNull()
  })

  it('shows the title, message and both buttons when open', () => {
    render(<ConfirmDialog open {...props} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Close project?')).toBeTruthy()
    expect(screen.getByText('This ends the Claude session.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close project' })).toBeTruthy()
  })

  it('focuses Cancel on open (safe default for a destructive action)', () => {
    render(<ConfirmDialog open {...props} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
  })

  it('the confirm button confirms', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog open {...props} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close project' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('the cancel button cancels', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open {...props} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Enter confirms, Escape cancels', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog open {...props} onConfirm={onConfirm} onCancel={onCancel} />)
    const dialog = screen.getByRole('alertdialog')
    fireEvent.keyDown(dialog, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('traps Tab inside the dialog', () => {
    render(<ConfirmDialog open {...props} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const dialog = screen.getByRole('alertdialog')
    const evt = fireEvent.keyDown(dialog, { key: 'Tab' })
    // preventDefault ran → the event is reported as not "successful".
    expect(evt).toBe(false)
  })

  it('clicking the backdrop cancels; clicking the dialog does not', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open {...props} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.mouseDown(screen.getByRole('alertdialog'))
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.mouseDown(screen.getByTestId('confirm-dialog'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('restores focus to the previously-focused element on close', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender } = render(
      <ConfirmDialog open {...props} onConfirm={vi.fn()} onCancel={vi.fn()} />
    )
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))

    rerender(<ConfirmDialog open={false} {...props} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
