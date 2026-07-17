import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { WorkbenchErrorBoundary } from './WorkbenchErrorBoundary'

afterEach(cleanup)

function Boom(): React.ReactElement {
  throw new Error('kaboom')
}

describe('WorkbenchErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <WorkbenchErrorBoundary>
        <div data-testid="child">ok</div>
      </WorkbenchErrorBoundary>
    )
    expect(screen.getByTestId('child')).toBeDefined()
  })

  it('renders a recoverable fallback when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <WorkbenchErrorBoundary>
        <Boom />
      </WorkbenchErrorBoundary>
    )
    expect(screen.getByTestId('error-boundary')).toBeDefined()
    expect(screen.getByText('kaboom')).toBeDefined()
    // The fallback reassures that sessions survive.
    expect(screen.getByText(/still running/i)).toBeDefined()
    spy.mockRestore()
  })

  it('invokes the injected reload handler', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReload = vi.fn()
    render(
      <WorkbenchErrorBoundary onReload={onReload}>
        <Boom />
      </WorkbenchErrorBoundary>
    )
    fireEvent.click(screen.getByText('Reload window'))
    expect(onReload).toHaveBeenCalledOnce()
    spy.mockRestore()
  })
})
