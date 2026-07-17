import { TerminalPane } from './components/TerminalPane'
import { WorkbenchErrorBoundary } from './components/WorkbenchErrorBoundary'

/**
 * The torn-off window: one project, one live terminal. The PTY never moved —
 * this view simply attaches to the same main-process session (spec §4.2), so
 * tearing off and re-docking never restarts `claude`.
 */
export function TearOffApp({ tabId, title }: { tabId: string; title: string }): React.ReactElement {
  return (
    <WorkbenchErrorBoundary>
      <div className="weft-shell" data-testid="tearoff-shell">
        <header className="tab-strip tab-strip--tearoff" data-testid="tearoff-title">
          <span className="tab-strip__tearoff-label">⤢ {title}</span>
        </header>
        <main className="workbench">
          <section className="terminal-host" data-testid="terminal-host">
            <TerminalPane tabId={tabId} />
          </section>
        </main>
      </div>
    </WorkbenchErrorBoundary>
  )
}
