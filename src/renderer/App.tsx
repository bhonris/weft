import { useSessionStore, type Tab } from './store/session-store'
import { TerminalPane } from './components/TerminalPane'
import { Explorer } from './components/Explorer'
import { WorkbenchErrorBoundary } from './components/WorkbenchErrorBoundary'
import type { SessionStatus } from '@shared/status/hook-events'

const STATUS_GLYPH: Record<SessionStatus, string> = {
  working: '●',
  waiting: '‖',
  done: '✓',
  error: '✕',
  unknown: '○'
}

function TabButton({ tab, active }: { tab: Tab; active: boolean }): React.ReactElement {
  const setActive = useSessionStore((s) => s.setActive)
  const removeTab = useSessionStore((s) => s.removeTab)
  return (
    <div className={`tab${active ? ' tab--active' : ''}`} data-testid="tab">
      <button type="button" className="tab__label" onClick={() => setActive(tab.tabId)}>
        <span className={`tab__badge tab__badge--${tab.status}`} aria-label={`status: ${tab.status}`}>
          {STATUS_GLYPH[tab.status]}
        </span>
        {tab.title}
      </button>
      <button
        type="button"
        className="tab__close"
        aria-label={`close ${tab.title}`}
        onClick={() => {
          void window.api.closeSession(tab.tabId)
          removeTab(tab.tabId)
        }}
      >
        ×
      </button>
    </div>
  )
}

export function App(): React.ReactElement {
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const addTab = useSessionStore((s) => s.addTab)
  const activeTab = tabs.find((t) => t.tabId === activeTabId) ?? null

  const openProject = async (): Promise<void> => {
    const result = await window.api.openProject()
    if (result) addTab({ tabId: result.tabId, title: result.title, cwd: result.cwd })
  }

  return (
    <WorkbenchErrorBoundary>
      <div className="weft-shell">
        <header className="tab-strip" data-testid="tab-strip">
          {tabs.map((t) => (
            <TabButton key={t.tabId} tab={t} active={t.tabId === activeTabId} />
          ))}
          <button
            type="button"
            className="tab-strip__add"
            aria-label="open project"
            onClick={() => void openProject()}
          >
            +
          </button>
          {tabs.length === 0 && (
            <span className="tab-strip__empty">Open a project to begin</span>
          )}
        </header>
        <main className="workbench">
          <aside className="explorer" data-testid="explorer">
            <Explorer root={activeTab?.cwd ?? null} />
          </aside>
          <section className="terminal-host" data-testid="terminal-host">
            {activeTabId ? (
              <TerminalPane key={activeTabId} tabId={activeTabId} />
            ) : (
              <div className="terminal-host__placeholder">No active session</div>
            )}
          </section>
        </main>
        <footer className="status-bar" data-testid="status-bar">
          <span>Weft</span>
          <span className="status-bar__spacer" />
          <span>{tabs.length} session{tabs.length === 1 ? '' : 's'}</span>
        </footer>
      </div>
    </WorkbenchErrorBoundary>
  )
}
