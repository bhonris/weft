import { useEffect } from 'react'
import { useSessionStore, type Tab } from './store/session-store'
import { buildWorkspaceState, restoreWorkspace } from './store/workspace-sync'
import { TerminalPane } from './components/TerminalPane'
import { Explorer } from './components/Explorer'
import { WorkbenchErrorBoundary } from './components/WorkbenchErrorBoundary'
import type { SessionStatus } from '@shared/status/hook-events'

// Module-level guard: React StrictMode double-invokes effects in dev; the
// workspace must be restored exactly once per renderer lifetime.
let restoreStarted = false

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

  // Hook-driven status → badges; PTY exit → done/error (spec §4.4).
  useEffect(() => {
    const setStatus = useSessionStore.getState().setStatus
    const offStatus = window.api.onSessionStatus((e) => setStatus(e.tabId, e.status))
    const offExit = window.api.onSessionExit((e) =>
      setStatus(e.tabId, e.exitCode === 0 ? 'done' : 'error')
    )
    const offActivate = window.api.onActivateTab((e) =>
      useSessionStore.getState().setActive(e.tabId)
    )
    return () => {
      offStatus()
      offExit()
      offActivate()
    }
  }, [])

  // Restore the previous workspace once on launch; then persist tab changes.
  useEffect(() => {
    let disposed = false
    if (!restoreStarted) {
      restoreStarted = true
      void window.api.loadWorkspace().then(async (saved) => {
        const restored = await restoreWorkspace(window.api, saved)
        if (disposed) return
        const add = useSessionStore.getState().addTab
        for (const tab of restored) add(tab)
      })
    }
    const unsub = useSessionStore.subscribe((state, prev) => {
      if (state.tabs !== prev.tabs) {
        void window.api.saveWorkspace(buildWorkspaceState(state.tabs))
      }
    })
    return () => {
      disposed = true
      unsub()
    }
  }, [])

  const openProject = async (): Promise<void> => {
    const result = await window.api.openProject()
    if (result) {
      addTab({
        tabId: result.tabId,
        title: result.title,
        cwd: result.cwd,
        command: result.command
      })
    }
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
