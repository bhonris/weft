import { useEffect, useRef, useState } from 'react'
import { useSessionStore, nextTheme, type Tab, type SpawnFailure } from './store/session-store'
import { useViewerStore } from './store/viewer-store'
import { useTerminalStore } from './store/terminal-store'
import { buildWorkspaceState, restoreWorkspace } from './store/workspace-sync'
import { TerminalPane } from './components/TerminalPane'
import { Explorer } from './components/Explorer'
import { ViewerPane } from './components/ViewerPane'
import { WorkbenchErrorBoundary } from './components/WorkbenchErrorBoundary'
import { CommandPalette } from './components/CommandPalette'
import { KeyboardHelp } from './components/KeyboardHelp'
import { KeybindingsEditor } from './components/KeybindingsEditor'
import { routeKey } from '@core/keybindings/keybinding-router'
import { commandIdForAction } from '@core/commands/action-dispatch'
import { buildKeymap } from '@core/keybindings/effective-keymap'
import { nextRegion, type RegionId } from '@core/focus/region-cycle'
import type { CommandId } from '@core/commands/registry'
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

/** Add a spawned session as a tab and clear any spawn-failure banner. */
function addSessionTab(t: {
  tabId: string
  sessionId?: string
  title: string
  cwd: string
  command: 'claude' | 'shell'
}): void {
  const s = useSessionStore.getState()
  s.setSpawnFailure(null)
  s.addTab(t)
}

/** Open the OS folder picker and add the resulting session as a tab. */
async function openProject(command?: 'claude' | 'shell'): Promise<void> {
  const result = await window.api.openProject(command)
  if (!result) return
  if ('error' in result) {
    useSessionStore.getState().setSpawnFailure({
      message: result.error,
      cwd: result.cwd,
      title: result.title,
      command: result.command
    })
    return
  }
  addSessionTab(result)
}

/** Retry a failed spawn in the same cwd (e.g. after fixing PATH). */
async function retrySpawn(failure: SpawnFailure): Promise<void> {
  try {
    const { tabId, sessionId } = await window.api.createSession({
      cwd: failure.cwd,
      command: failure.command
    })
    addSessionTab({
      tabId,
      sessionId,
      title: failure.title,
      cwd: failure.cwd,
      command: failure.command
    })
  } catch (e) {
    useSessionStore.getState().setSpawnFailure({
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
      className={`tab tab--${tab.status}${active ? ' tab--active' : ''}`}
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
          onKeyDown={(e) => {
            // F2 renames the focused tab (keyboard parity with double-click).
            if (e.key === 'F2') {
              e.preventDefault()
              setDraft(tab.title)
              setEditing(true)
            }
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
        className="tab__tearoff"
        aria-label={`tear off ${tab.title}`}
        title="Move to its own window"
        onClick={() => {
          // Move the view, not the session: the PTY stays alive in main.
          void window.api.moveTabToWindow(tab.tabId, 'new', { title: tab.title })
          useSessionStore.getState().removeTab(tab.tabId)
        }}
      >
        ⤢
      </button>
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
  const spawnFailure = useSessionStore((s) => s.spawnFailure)
  const setSpawnFailure = useSessionStore((s) => s.setSpawnFailure)
  const [gitBranch, setGitBranch] = useState<string | null>(null)
  const resumeEnabled = useSessionStore((s) => s.resumeEnabled)
  const setResumeEnabled = useSessionStore((s) => s.setResumeEnabled)
  const notificationsEnabled = useSessionStore((s) => s.notificationsEnabled)
  const setNotificationsEnabled = useSessionStore((s) => s.setNotificationsEnabled)
  const keymapOverrides = useSessionStore((s) => s.keymapOverrides)
  const setKeymapOverrides = useSessionStore((s) => s.setKeymapOverrides)
  const [overlay, setOverlay] = useState<'none' | 'palette' | 'help' | 'keybindings'>('none')
  // Read inside the stable window keydown listener without re-subscribing it.
  const overlayOpenRef = useRef(false)
  useEffect(() => {
    overlayOpenRef.current = overlay !== 'none'
  }, [overlay])
  // Effective keymap (defaults + user overrides), read live by the key listener
  // so a rebind takes effect without re-subscribing.
  const keymapRef = useRef(buildKeymap({}))
  useEffect(() => {
    keymapRef.current = buildKeymap(keymapOverrides)
  }, [keymapOverrides])

  // ── Region focus (keyboard-only navigation between UI regions) ──
  const tabStripRef = useRef<HTMLElement>(null)
  const explorerRef = useRef<HTMLElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLElement>(null)
  const activeRegionRef = useRef<RegionId | null>(null)

  const focusEl = (el: Element | null | undefined): void => {
    if (el instanceof HTMLElement) el.focus()
  }

  const focusRegion = (id: RegionId): void => {
    activeRegionRef.current = id
    switch (id) {
      case 'tabs':
        focusEl(
          tabStripRef.current?.querySelector('.tab__label') ??
            tabStripRef.current?.querySelector('.tab-strip__add')
        )
        break
      case 'explorer':
        // The roving (tabindex 0) node, else the first, else the shell.
        focusEl(
          explorerRef.current?.querySelector('.explorer__item[tabindex="0"]') ??
            explorerRef.current?.querySelector('.explorer__item') ??
            explorerRef.current
        )
        break
      case 'terminal':
        // xterm's hidden textarea when live; the region shell otherwise.
        focusEl(terminalRef.current?.querySelector('textarea') ?? terminalRef.current)
        break
      case 'viewer':
        focusEl(
          viewerRef.current?.querySelector('textarea') ??
            viewerRef.current?.querySelector('button') ??
            viewerRef.current
        )
        break
      case 'status':
        focusEl(statusRef.current?.querySelector('button') ?? statusRef.current)
        break
    }
  }

  // Regions currently focusable (read live to avoid stale closures).
  const presentRegions = (): RegionId[] => {
    const p: RegionId[] = ['tabs', 'explorer']
    if (useSessionStore.getState().activeTabId) p.push('terminal')
    if (useViewerStore.getState().file) p.push('viewer')
    p.push('status')
    return p
  }

  const cycleRegion = (dir: 1 | -1): void => {
    const target = nextRegion(presentRegions(), activeRegionRef.current, dir)
    if (target) focusRegion(target)
  }

  // Renderer-owned command dispatch: maps a CommandId to its side effect.
  // Handlers not yet wired this cycle are safe no-ops until their leap lands.
  const runCommand = (id: CommandId): void => {
    const s = useSessionStore.getState()
    switch (id) {
      case 'tab.new':
      case 'tab.openProject':
        void openProject()
        break
      case 'tab.newShell':
        void openProject('shell')
        break
      case 'tab.close':
        if (s.activeTabId) closeTab(s.activeTabId)
        break
      case 'tab.next':
        s.cycleTab(1)
        break
      case 'tab.prev':
        s.cycleTab(-1)
        break
      case 'tab.moveLeft':
        s.moveActiveTab(-1)
        break
      case 'tab.moveRight':
        s.moveActiveTab(1)
        break
      case 'general.commandPalette':
        setOverlay('palette')
        break
      case 'general.keyboardHelp':
        setOverlay('help')
        break
      case 'general.cycleTheme':
        s.setTheme(nextTheme(s.theme))
        break
      case 'general.toggleResume':
        s.setResumeEnabled(!s.resumeEnabled)
        break
      case 'general.toggleNotifications':
        s.setNotificationsEnabled(!s.notificationsEnabled)
        break
      case 'general.keybindings':
        setOverlay('keybindings')
        break
      case 'general.resetKeybindings':
        s.setKeymapOverrides({})
        break
      case 'viewer.save':
        useViewerStore.getState().requestSave()
        break
      case 'focus.terminal':
        focusRegion('terminal')
        break
      case 'focus.explorer':
        focusRegion('explorer')
        break
      case 'focus.cycleNext':
        cycleRegion(1)
        break
      case 'focus.cyclePrev':
        cycleRegion(-1)
        break
      case 'viewer.view': {
        const v = useViewerStore.getState()
        v.setMode('view')
        v.setEditing(false)
        break
      }
      case 'viewer.edit':
        useViewerStore.getState().setEditing(true)
        break
      case 'viewer.diff':
        useViewerStore.getState().setMode('diff')
        break
      case 'viewer.reveal': {
        const f = useViewerStore.getState().file
        if (f) void window.api.revealInOs(f.path)
        break
      }
      case 'viewer.close':
        useViewerStore.getState().close()
        break
      case 'general.terminalSearch':
        // Focus the terminal and open its in-terminal search bar. The chord
        // (Ctrl+Shift+F) still opens it directly inside TerminalPane; this makes
        // the palette command do the same via the terminal-store signal.
        focusRegion('terminal')
        useTerminalStore.getState().requestSearch()
        break
      // (tab.rename is a local F2 key on the focused tab, not a dispatch entry.)
      default:
        break
    }
  }

  // Git branch for the active project (blank for non-repos).
  useEffect(() => {
    const cwd = activeTab?.cwd
    if (!cwd) {
      setGitBranch(null)
      return
    }
    let cancelled = false
    void window.api.getGitBranch(cwd).then((branch) => {
      if (!cancelled) setGitBranch(branch)
    })
    return () => {
      cancelled = true
    }
  }, [activeTab?.cwd])

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
    const offReDock = window.api.onReDockTab((e) => addSessionTab(e))
    return () => {
      offStatus()
      offExit()
      offActivate()
      offReDock()
    }
  }, [])

  // Global chords route through the single pure keybinding-router, then resolve
  // to a CommandId dispatched by `runCommand` — the ONE place a command's side
  // effect lives (no parallel KeyAction switch to drift out of sync). We only
  // preventDefault for actions we actually handle; everything else (passthrough,
  // terminal-search) reaches the PTY. While an overlay is open it owns the
  // keyboard, so we stand down entirely.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (overlayOpenRef.current) return
      const action = routeKey(e, keymapRef.current)
      if (action.kind === 'jump-tab') {
        // Parameterized by number (Ctrl+1..9); no registry command. We still
        // intercept the chord even when no tab occupies that slot.
        const s = useSessionStore.getState()
        const target = s.tabs[action.index]
        if (target) s.setActive(target.tabId)
      } else {
        const id = commandIdForAction(action)
        if (!id) return // passthrough / terminal-search: let the terminal have it
        runCommand(id)
      }
      e.preventDefault()
      e.stopPropagation()
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
        useSessionStore.getState().setResumeEnabled(saved.resumeEnabled)
        useSessionStore.getState().setNotificationsEnabled(saved.notificationsEnabled)
        useSessionStore.getState().setKeymapOverrides(saved.keymapOverrides)
        const restored = await restoreWorkspace(window.api, saved)
        if (disposed) return
        const add = useSessionStore.getState().addTab
        for (const tab of restored) add(tab)
      })
    }
    const unsub = useSessionStore.subscribe((state, prev) => {
      if (
        state.tabs !== prev.tabs ||
        state.theme !== prev.theme ||
        state.resumeEnabled !== prev.resumeEnabled ||
        state.notificationsEnabled !== prev.notificationsEnabled ||
        state.keymapOverrides !== prev.keymapOverrides
      ) {
        void window.api.saveWorkspace(
          buildWorkspaceState(
            state.tabs,
            state.theme,
            state.resumeEnabled,
            state.notificationsEnabled,
            state.keymapOverrides
          )
        )
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
        <header className="tab-strip" data-testid="tab-strip" ref={tabStripRef}>
          {tabs.map((t) => (
            <TabButton key={t.tabId} tab={t} active={t.tabId === activeTabId} />
          ))}
          <button
            type="button"
            className="tab-strip__add"
            aria-label="open project"
            title="Open project (Shift+Click: plain shell tab)"
            onClick={(e) => void openProject(e.shiftKey ? 'shell' : undefined)}
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
          <aside
            className="explorer"
            data-testid="explorer"
            ref={explorerRef}
            tabIndex={-1}
            aria-label="File explorer"
          >
            <Explorer root={activeTab?.cwd ?? null} />
          </aside>
          <section className="terminal-host" data-testid="terminal-host">
            <div
              className="terminal-region"
              data-testid="terminal-region"
              ref={terminalRef}
              tabIndex={-1}
              aria-label="Terminal"
            >
              {activeTabId ? (
                <TerminalPane key={activeTabId} tabId={activeTabId} />
              ) : (
                <div className="terminal-host__placeholder">No active session</div>
              )}
            </div>
            <div
              className="viewer-region"
              data-testid="viewer-region"
              ref={viewerRef}
              onKeyDown={(e) => {
                // App-level Ctrl+S: save whenever focus is anywhere in the
                // viewer region (not only when Monaco itself holds focus).
                if (e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 's' || e.key === 'S')) {
                  e.preventDefault()
                  useViewerStore.getState().requestSave()
                }
              }}
            >
              <ViewerPane />
            </div>
          </section>
        </main>
        <footer className="status-bar" data-testid="status-bar" ref={statusRef}>
          <span>Weft</span>
          {activeTab && (
            <span className="status-bar__cwd" title={activeTab.cwd}>
              {activeTab.title}
              {gitBranch && (
                <span className="status-bar__branch" data-testid="git-branch">
                  {'  '}⎇ {gitBranch}
                </span>
              )}
            </span>
          )}
          <span className="status-bar__spacer" />
          <button
            type="button"
            className="status-bar__theme"
            aria-label={`notifications: ${notificationsEnabled ? 'on' : 'off'}`}
            title="Turn OS notifications on/off (toasts when an unfocused session needs you or finishes). The tab color/badge stays live either way."
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
          >
            {notificationsEnabled ? '🔔 notify on' : '🔕 notify off'}
          </button>
          <button
            type="button"
            className="status-bar__theme"
            aria-label={`resume: ${resumeEnabled ? 'on' : 'off'}`}
            title="Resume prior Claude conversations when restoring tabs after a restart (opt-in — resuming spends tokens)"
            onClick={() => setResumeEnabled(!resumeEnabled)}
          >
            ↻ resume {resumeEnabled ? 'on' : 'off'}
          </button>
          <button
            type="button"
            className="status-bar__theme"
            aria-label={`theme: ${theme}`}
            title="Cycle theme (system → light → dark → cyberpunk)"
            onClick={() => setTheme(nextTheme(theme))}
          >
            {theme === 'system'
              ? '◐'
              : theme === 'light'
                ? '☀'
                : theme === 'dark'
                  ? '☾'
                  : '⚡'}{' '}
            {theme}
          </button>
          <span>
            {tabs.length} session{tabs.length === 1 ? '' : 's'}
          </span>
        </footer>
        <CommandPalette
          open={overlay === 'palette'}
          onRun={runCommand}
          onClose={() => setOverlay((o) => (o === 'palette' ? 'none' : o))}
        />
        <KeyboardHelp
          open={overlay === 'help'}
          onClose={() => setOverlay((o) => (o === 'help' ? 'none' : o))}
        />
        <KeybindingsEditor
          open={overlay === 'keybindings'}
          overrides={keymapOverrides}
          onChange={setKeymapOverrides}
          onClose={() => setOverlay((o) => (o === 'keybindings' ? 'none' : o))}
        />
      </div>
    </WorkbenchErrorBoundary>
  )
}
