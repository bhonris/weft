import { useEffect, useState } from 'react'
import { useSessionStore, type Tab } from './store/session-store'
import { buildWorkspaceState, restoreWorkspace } from './store/workspace-sync'
import { TerminalPane } from './components/TerminalPane'
import { Explorer } from './components/Explorer'
import { ViewerPane } from './components/ViewerPane'
import { WorkbenchErrorBoundary } from './components/WorkbenchErrorBoundary'
import { routeKey } from '@core/keybindings/keybinding-router'
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

export interface SpawnFailure {
  message: string
  cwd: string
  title: string
  command: 'claude' | 'shell'
}

type SpawnFailureListener = (failure: SpawnFailure | null) => void
let spawnFailureListener: SpawnFailureListener = () => {}

/** Open the OS folder picker and add the resulting session as a tab. */
async function openProject(): Promise<void> {
  const result = await window.api.openProject()
  if (!result) return
  if ('error' in result) {
    spawnFailureListener({
      message: result.error,
      cwd: result.cwd,
      title: result.title,
      command: result.command
    })
    return
  }
  spawnFailureListener(null)
  useSessionStore.getState().addTab({
    tabId: result.tabId,
    title: result.title,
    cwd: result.cwd,
    command: result.command
  })
}

/** Retry a failed spawn in the same cwd (e.g. after fixing PATH). */
async function retrySpawn(failure: SpawnFailure): Promise<void> {
  try {
    const { tabId } = await window.api.createSession({
      cwd: failure.cwd,
      command: failure.command
    })
    spawnFailureListener(null)
    useSessionStore.getState().addTab({
      tabId,
      title: failure.title,
      cwd: failure.cwd,
      command: failure.command
    })
  } catch (e) {
    spawnFailureListener({
      ...failure,
      message: e instanceof Error ? e.message : String(e)
    })
  }
}

function closeTab(tabId: string): void {
  void window.api.closeSession(tabId)
  useSessionStore.getState().removeTab(tabId)
}

function TabButton({ tab, active }: { tab: Tab; active: boolean }): React.ReactElement {
  const setActive = useSessionStore((s) => s.setActive)
  const rename = useSessionStore((s) => s.rename)
  const moveTab = useSessionStore((s) => s.moveTab)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(tab.title)

  const commit = (): void => {
    const title = draft.trim()
    if (title.length > 0) rename(tab.tabId, title)
    setEditing(false)
  }

  return (
    <div
      className={`tab${active ? ' tab--active' : ''}`}
      data-testid="tab"
      draggable={!editing}
      onDragStart={(e) => e.dataTransfer.setData('text/weft-tab', tab.tabId)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const dragId = e.dataTransfer.getData('text/weft-tab')
        if (dragId) moveTab(dragId, tab.tabId)
      }}
    >
      {editing ? (
        <input
          className="tab__rename"
          aria-label="rename tab"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <button
          type="button"
          className="tab__label"
          onClick={() => setActive(tab.tabId)}
          onDoubleClick={() => {
            setDraft(tab.title)
            setEditing(true)
          }}
        >
          <span
            className={`tab__badge tab__badge--${tab.status}`}
            aria-label={`status: ${tab.status}`}
          >
            {STATUS_GLYPH[tab.status]}
          </span>
          {tab.title}
        </button>
      )}
      <button
        type="button"
        className="tab__close"
        aria-label={`close ${tab.title}`}
        onClick={() => closeTab(tab.tabId)}
      >
        ×
      </button>
    </div>
  )
}

export function App(): React.ReactElement {
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const theme = useSessionStore((s) => s.theme)
  const setTheme = useSessionStore((s) => s.setTheme)
  const activeTab = tabs.find((t) => t.tabId === activeTabId) ?? null
  const [spawnFailure, setSpawnFailure] = useState<SpawnFailure | null>(null)

  // Module-level open/retry helpers report spawn failures into this component.
  useEffect(() => {
    spawnFailureListener = setSpawnFailure
    return () => {
      spawnFailureListener = () => {}
    }
  }, [])

  // Apply the theme choice to the document (CSS handles system/light/dark).
  useEffect(() => {
    document.documentElement.dataset['theme'] = theme
  }, [theme])

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

  // Reserved chords (Ctrl+T/W/Tab/1..9); everything else reaches the PTY.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const action = routeKey(e)
      if (action.kind === 'passthrough') return
      e.preventDefault()
      e.stopPropagation()
      const s = useSessionStore.getState()
      switch (action.kind) {
        case 'new-tab':
          void openProject()
          break
        case 'close-tab':
          if (s.activeTabId) closeTab(s.activeTabId)
          break
        case 'next-tab':
          s.cycleTab(1)
          break
        case 'prev-tab':
          s.cycleTab(-1)
          break
        case 'jump-tab': {
          const target = s.tabs[action.index]
          if (target) s.setActive(target.tabId)
          break
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // Restore the previous workspace once on launch; then persist tab changes.
  useEffect(() => {
    let disposed = false
    if (!restoreStarted) {
      restoreStarted = true
      void window.api.loadWorkspace().then(async (saved) => {
        useSessionStore.getState().setTheme(saved.theme)
        const restored = await restoreWorkspace(window.api, saved)
        if (disposed) return
        const add = useSessionStore.getState().addTab
        for (const tab of restored) add(tab)
      })
    }
    const unsub = useSessionStore.subscribe((state, prev) => {
      if (state.tabs !== prev.tabs || state.theme !== prev.theme) {
        void window.api.saveWorkspace(buildWorkspaceState(state.tabs, state.theme))
      }
    })
    return () => {
      disposed = true
      unsub()
    }
  }, [])

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
        {spawnFailure && (
          <div className="spawn-error" role="alert" data-testid="spawn-error">
            <span>
              Could not start <strong>{spawnFailure.command}</strong> in{' '}
              {spawnFailure.cwd}: {spawnFailure.message}
              {spawnFailure.command === 'claude' && (
                <> — is the `claude` CLI installed and on your PATH?</>
              )}
            </span>
            <span className="spawn-error__actions">
              <button type="button" onClick={() => void retrySpawn(spawnFailure)}>
                Retry
              </button>
              <button type="button" onClick={() => setSpawnFailure(null)} aria-label="dismiss error">
                ×
              </button>
            </span>
          </div>
        )}
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
            <ViewerPane />
          </section>
        </main>
        <footer className="status-bar" data-testid="status-bar">
          <span>Weft</span>
          <span className="status-bar__spacer" />
          <button
            type="button"
            className="status-bar__theme"
            aria-label={`theme: ${theme}`}
            title="Cycle theme (system → light → dark)"
            onClick={() =>
              setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system')
            }
          >
            {theme === 'system' ? '◐' : theme === 'light' ? '☀' : '☾'} {theme}
          </button>
          <span>
            {tabs.length} session{tabs.length === 1 ? '' : 's'}
          </span>
        </footer>
      </div>
    </WorkbenchErrorBoundary>
  )
}
