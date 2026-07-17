import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Injectable for tests; defaults to a full window reload. */
  onReload?: () => void
}

interface State {
  error: Error | null
}

/**
 * Catches render errors in the workbench so a UI bug shows a recoverable
 * fallback instead of a white screen. Crucially, it never touches the main
 * process — the PTYs keep running, and reloading re-attaches to them (§4.7).
 */
export class WorkbenchErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Workbench error boundary caught:', error, info.componentStack)
  }

  private handleReload = (): void => {
    if (this.props.onReload) this.props.onReload()
    else window.location.reload()
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="error-boundary" role="alert" data-testid="error-boundary">
          <h2>Something broke in the UI</h2>
          <p className="error-boundary__message">{this.state.error.message}</p>
          <p className="error-boundary__hint">
            Your terminal sessions are still running. Reload to reconnect to them.
          </p>
          <button type="button" className="error-boundary__reload" onClick={this.handleReload}>
            Reload window
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
