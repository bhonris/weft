import { useEffect, useRef, useState } from 'react'
import { useSessionStore, nextTheme, type Tab, type SpawnFailure } from './store/session-store'
import { useViewerStore } from './store/viewer-store'
import { useTerminalStore } from './store/terminal-store'
import { useDockStore } from './store/dock-store'
import { useUsageStore } from './store/usage-store'
import { useIssuesStore } from './store/issues-store'
import { useActivityStore } from './store/activity-store'
import { formatUsageLabel, formatUsageTooltip } from '@core/usage/summary'
import { formatUtilization, formatResetIn } from '@core/usage/plan-limits'
import { modelDisplayName, effortLabel } from '@core/model/model-name'
import { nextDockPosition, dockResizeDelta } from '@core/workspace/dock'
import { buildWorkspaceState, restoreWorkspace } from './store/workspace-sync'
import { TerminalPane } from './components/TerminalPane'
import { Explorer } from './components/Explorer'
import { ActivityBar } from './components/ActivityBar'
import { UsagePanel } from './components/UsagePanel'
import { IssuesPanel } from './components/IssuesPanel'
import { ViewerPane } from './components/ViewerPane'
import { WorkbenchErrorBoundary } from './components/WorkbenchErrorBoundary'
import { CommandPalette } from './components/CommandPalette'
import { QuickOpen } from './components/QuickOpen'
import { KeyboardHelp } from './components/KeyboardHelp'
import { KeybindingsEditor } from './components/KeybindingsEditor'
import { ConfirmDialog } from './components/ConfirmDialog'
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

/** Pull the latest aggregate Claude Code usage from main into the store. */
function refreshUsage(): void {
  void window.api
    .getUsage()
    .then((u) => useUsageStore.getState().setUsage(u))
    .catch(() => {
      /* transient read failure — keep the last value. */
    })
}

/**
 * Pull the active claude tab's current model + effort from its transcript into
 * the store. Cleared for shell tabs / no active tab. Guards against a tab switch
 * racing the fetch, so a slow read never stamps a stale tab's model on the bar.
 */
function refreshSessionInfo(): void {
  const s = useSessionStore.getState()
  const tab = s.tabs.find((t) => t.tabId === s.activeTabId)
  const set = useUsageStore.getState().setSessionInfo
  if (!tab || tab.command !== 'claude' || !tab.sessionId) {
    set(null)
    return
  }
  const sessionId = tab.sessionId
  void window.api
    .getSessionInfo(tab.cwd, sessionId)
    .then((info) => {
      if (useSessionStore.getState().activeTabId === tab.tabId) set(info)
    })
    .catch(() => {
      /* transient read failure — keep the last value. */
    })
}

/** Pull the full Usage-panel payload (plan limits + weekly + sessions). */
function refreshUsagePanel(): void {
  void window.api
    .getUsagePanel()
    .then((p) => useUsageStore.getState().setPanel(p))
    .catch(() => {
      /* transient read failure — keep the last value. */
    })
}

/** Pull the GitHub Issues payload for `cwd` (its origin repo) into the store. */
function refreshIssues(cwd: string | null): void {
  void window.api
    .getIssues(cwd)
    .then((p) => useIssuesStore.getState().setPanel(p))
    .catch(() => {
      /* transient read failure — keep the last value. */
    })
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
  // Forget this project's open editor tabs (they don't outlive the project).
  useViewerStore.getState().dropProject(tabId)
}

function TabButton({
  tab,
  active,
  onRequestClose
}: {
  tab: Tab
  active: boolean
  onRequestClose: (tab: Tab) => void
}): React.ReactElement {
  const setActive = useSessionStore((s) => s.setActive)
  const rename = useSessionStore((s) => s.rename)
  const moveTab = useSessionStore((s) => s.moveTab)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(tab.title)

  // The "Rename Tab" command bumps renameTick; the ACTIVE tab enters inline
  // rename (keyboard/palette parity with F2). A ref-guard ignores the mount-time
  // value so it never fires spuriously.
  const renameTick = useSessionStore((s) => s.renameTick)
  const lastRenameTick = useRef(renameTick)
  useEffect(() => {
    if (renameTick !== lastRenameTick.current) {
      lastRenameTick.current = renameTick
      if (active) {
        setDraft(tab.title)
        setEditing(true)
      }
    }
  }, [renameTick, active, tab.title])

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
          useViewerStore.getState().dropProject(tab.tabId)
        }}
      >
        ⤢
      </button>
      <button
        type="button"
        className="tab__close"
        aria-label={`close ${tab.title}`}
        onClick={() => onRequestClose(tab)}
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
  const usage = useUsageStore((s) => s.usage)
  // The active claude tab's model + reasoning effort, for the status-bar readout.
  const sessionInfo = useUsageStore((s) => s.sessionInfo)
  // The 5-hour plan-limit window, shown in the status bar at all times.
  const fiveHour = useUsageStore((s) => s.panel?.planLimits?.fiveHour ?? null)
  const planStale = useUsageStore((s) => s.panel?.planLimits?.stale ?? false)
  const activePanel = useActivityStore((s) => s.active)
  const spawnFailure = useSessionStore((s) => s.spawnFailure)
  const setSpawnFailure = useSessionStore((s) => s.setSpawnFailure)
  const [gitBranch, setGitBranch] = useState<string | null>(null)
  const resumeEnabled = useSessionStore((s) => s.resumeEnabled)
  const setResumeEnabled = useSessionStore((s) => s.setResumeEnabled)
  const notificationsEnabled = useSessionStore((s) => s.notificationsEnabled)
  const setNotificationsEnabled = useSessionStore((s) => s.setNotificationsEnabled)
  const keymapOverrides = useSessionStore((s) => s.keymapOverrides)
  const setKeymapOverrides = useSessionStore((s) => s.setKeymapOverrides)
  // In-project split: the editor area shows only when a file is open AND the CLI
  // isn't maximized; otherwise the CLI dock fills the whole area. Dock
  // position/size/maximized come from the dock store.
  const hasViewerFile = useViewerStore((s) => s.file !== null)
  const viewerFilePath = useViewerStore((s) => s.file?.path ?? null)
  const dockPosition = useDockStore((s) => s.position)
  const dockSize = useDockStore((s) => s.size)
  const cliMaximized = useDockStore((s) => s.maximized)
  // "Maximize CLI" hides the editor pane without closing the file, so the CLI
  // gets the full split area. The file stays open; toggling off restores it.
  const showEditor = hasViewerFile && !cliMaximized
  const [overlay, setOverlay] = useState<
    'none' | 'palette' | 'quickOpen' | 'help' | 'keybindings'
  >('none')
  // The project tab awaiting a close confirmation, or null. Closing a project
  // terminates its Claude session, so it's guarded by a confirm dialog.
  const [closeTarget, setCloseTarget] = useState<Tab | null>(null)
  // Read inside the stable window keydown listener without re-subscribing it.
  const overlayOpenRef = useRef(false)
  useEffect(() => {
    // The confirm dialog owns the keyboard too, so treat it as an open overlay.
    overlayOpenRef.current = overlay !== 'none' || closeTarget !== null
  }, [overlay, closeTarget])
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
  const terminalHostRef = useRef<HTMLElement>(null)
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
    // The viewer region only exists when a file is open AND the CLI isn't
    // maximized (maximize hides the editor), so don't cycle to a hidden pane.
    if (useViewerStore.getState().file && !useDockStore.getState().maximized) p.push('viewer')
    p.push('status')
    return p
  }

  const cycleRegion = (dir: 1 | -1): void => {
    const target = nextRegion(presentRegions(), activeRegionRef.current, dir)
    if (target) focusRegion(target)
  }

  // Drag the divider to resize the CLI dock. The new size is the CLI pane's
  // fraction of the host along the dock axis (setSize clamps it).
  const startDockDrag = (e: React.MouseEvent): void => {
    e.preventDefault()
    const host = terminalHostRef.current
    if (!host) return
    const pos = useDockStore.getState().position
    const onMove = (ev: MouseEvent): void => {
      const r = host.getBoundingClientRect()
      const size =
        pos === 'bottom'
          ? (r.bottom - ev.clientY) / r.height
          : pos === 'right'
            ? (r.right - ev.clientX) / r.width
            : (ev.clientX - r.left) / r.width
      useDockStore.getState().setSize(size)
    }
    // Suppress text selection across the editor/terminal while dragging the
    // divider (otherwise a drag highlights everything it passes over).
    const prevUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    const onUp = (): void => {
      document.body.style.userSelect = prevUserSelect
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
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
      case 'tab.close': {
        // Closing a whole project kills its Claude session — confirm first.
        const active = s.tabs.find((t) => t.tabId === s.activeTabId)
        if (active) setCloseTarget(active)
        break
      }
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
      case 'general.quickOpen':
        setOverlay('quickOpen')
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
      case 'focus.terminal': {
        // Ctrl+` focuses the terminal; pressing it AGAIN while the terminal is
        // already focused escalates to a full-pane CLI (and toggles back on the
        // next press). So a double-tap from anywhere gets you a full-screen CLI
        // without closing the open file — no separate chord needed.
        const termFocused = terminalRef.current?.contains(document.activeElement) ?? false
        if (termFocused) useDockStore.getState().toggleMaximized()
        else focusRegion('terminal')
        break
      }
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
      case 'tab.rename':
        // Inline-rename the active tab (palette parity with the local F2 key).
        if (s.activeTabId) s.requestRename()
        break
      case 'view.cycleDock': {
        const dock = useDockStore.getState()
        dock.setPosition(nextDockPosition(dock.position))
        break
      }
      case 'view.maximizeCli':
        // Focus mode: full-pane CLI without closing the open file.
        useDockStore.getState().toggleMaximized()
        break
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

  // The editor tabs are per project: point the viewer at the active project's
  // file set whenever the active tab changes, so switching/closing projects never
  // shows another project's files.
  useEffect(() => {
    useViewerStore.getState().setProject(activeTabId ?? null)
  }, [activeTabId])

  // Refresh the status-bar model/effort readout when the active tab changes.
  // (It also refreshes on session-status changes — see the status listener.)
  useEffect(() => {
    refreshSessionInfo()
  }, [activeTabId])

  // Maximize CLI is a transient focus mode: any deliberate file navigation
  // (open / switch / close) exits it, so you never open a file into a pane the
  // maximize toggle is currently hiding.
  useEffect(() => {
    useDockStore.getState().setMaximized(false)
  }, [viewerFilePath])

  // Poll Claude Code usage for the bottom-left readout. Cheap: main caches
  // transcript parses by mtime+size, so unchanged sessions aren't re-read.
  useEffect(() => {
    refreshUsage()
    const id = window.setInterval(refreshUsage, 4000)
    return () => window.clearInterval(id)
  }, [])

  // Poll the richer Usage panel (plan limits + weekly + sessions) continuously,
  // so the always-on 5-hour readout in the status bar stays live even when the
  // file tree is showing. Refresh once a minute normally — the plan endpoint is
  // main-cached to one real hit per minute — and speed up to every 15s while the
  // Usage panel is the active sidebar so its weekly/session figures feel snappy.
  useEffect(() => {
    refreshUsagePanel()
    const id = window.setInterval(refreshUsagePanel, activePanel === 'usage' ? 15000 : 60000)
    return () => window.clearInterval(id)
  }, [activePanel])

  // GitHub Issues: poll only while the panel is active (per active tab's repo).
  // Main caches per-repo to one real GitHub hit per minute, so 15s is cheap.
  useEffect(() => {
    if (activePanel !== 'issues') return
    const cwd = activeTab?.cwd ?? null
    refreshIssues(cwd)
    const id = window.setInterval(() => refreshIssues(cwd), 15000)
    return () => window.clearInterval(id)
  }, [activePanel, activeTab?.cwd])

  // Device-flow sign-in outcome (pushed from main): on approval, clear the code
  // prompt and re-fetch as authenticated; on failure, surface the message.
  useEffect(() => {
    return window.api.onGithubAuth((e) => {
      const store = useIssuesStore.getState()
      if (e.state === 'authorized') {
        store.setSignIn(null)
        store.setAuthError(null)
        const s = useSessionStore.getState()
        const cwd = s.tabs.find((t) => t.tabId === s.activeTabId)?.cwd ?? null
        refreshIssues(cwd)
      } else if (e.state === 'error') {
        store.setSignIn(null)
        store.setAuthError(e.message ?? 'Sign-in failed. Please try again.')
      }
    })
  }, [])

  // Hook-driven status → badges; PTY exit → done/error (spec §4.4).
  useEffect(() => {
    const setStatus = useSessionStore.getState().setStatus
    const offStatus = window.api.onSessionStatus((e) => {
      setStatus(e.tabId, e.status)
      // A status change means a turn just started/finished — refresh cost and
      // the model/effort readout now rather than waiting for the next poll tick
      // (the model or effort may have changed for the turn that just began).
      refreshUsage()
      refreshSessionInfo()
    })
    const offExit = window.api.onSessionExit((e) => {
      setStatus(e.tabId, e.exitCode === 0 ? 'done' : 'error')
      refreshUsage()
    })
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
        useDockStore.getState().restore(saved.dock)
        useActivityStore.getState().setActive(saved.activePanel)
        const restored = await restoreWorkspace(window.api, saved)
        if (disposed) return
        const add = useSessionStore.getState().addTab
        for (const tab of restored) add(tab)
      })
    }
    // Persist from both stores (tabs/prefs live in session-store; the CLI dock
    // in dock-store) whenever a persisted field changes.
    const persist = (): void => {
      const s = useSessionStore.getState()
      const dock = useDockStore.getState()
      void window.api.saveWorkspace(
        buildWorkspaceState(
          s.tabs,
          s.theme,
          s.resumeEnabled,
          s.notificationsEnabled,
          s.keymapOverrides,
          { position: dock.position, size: dock.size },
          useActivityStore.getState().active
        )
      )
    }
    const unsubSession = useSessionStore.subscribe((state, prev) => {
      if (
        state.tabs !== prev.tabs ||
        state.theme !== prev.theme ||
        state.resumeEnabled !== prev.resumeEnabled ||
        state.notificationsEnabled !== prev.notificationsEnabled ||
        state.keymapOverrides !== prev.keymapOverrides
      ) {
        persist()
      }
    })
    const unsubDock = useDockStore.subscribe((state, prev) => {
      if (state.position !== prev.position || state.size !== prev.size) persist()
    })
    const unsubActivity = useActivityStore.subscribe((state, prev) => {
      if (state.active !== prev.active) persist()
    })
    return () => {
      disposed = true
      unsubSession()
      unsubDock()
      unsubActivity()
    }
  }, [])

  // The in-project split regions. Order depends on the dock edge: a left dock
  // renders the CLI first (so it sits on the left of the editor).
  const editorRegion = showEditor && (
    <div
      className="viewer-region"
      data-testid="viewer-region"
      ref={viewerRef}
      style={{ flex: '1 1 0' }}
      onKeyDown={(e) => {
        // App-level Ctrl+S: save whenever focus is anywhere in the viewer region.
        if (e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 's' || e.key === 'S')) {
          e.preventDefault()
          useViewerStore.getState().requestSave()
        }
      }}
    >
      <ViewerPane />
    </div>
  )
  const dockDivider = showEditor && (
    <div
      className="dock-divider"
      data-testid="dock-divider"
      role="separator"
      aria-orientation={dockPosition === 'bottom' ? 'horizontal' : 'vertical'}
      aria-label="Resize CLI dock"
      aria-valuenow={Math.round(dockSize * 100)}
      aria-valuemin={15}
      aria-valuemax={85}
      tabIndex={0}
      onMouseDown={startDockDrag}
      onKeyDown={(e) => {
        // Delta depends on the dock edge so the divider moves in the arrow's
        // direction (matching a mouse drag) — see dockResizeDelta.
        const delta = dockResizeDelta(dockPosition, e.key)
        if (delta !== 0) {
          e.preventDefault()
          const dock = useDockStore.getState()
          dock.setSize(dock.size + delta)
        }
      }}
    />
  )
  const cliRegion = (
    <div
      className="terminal-region"
      data-testid="terminal-region"
      ref={terminalRef}
      tabIndex={-1}
      aria-label="Terminal"
      style={showEditor ? { flex: `0 0 ${Math.round(dockSize * 100)}%` } : { flex: '1 1 auto' }}
    >
      {activeTabId ? (
        <TerminalPane key={activeTabId} tabId={activeTabId} />
      ) : (
        <div className="terminal-host__placeholder">No active session</div>
      )}
    </div>
  )

  return (
    <WorkbenchErrorBoundary>
      <div className="weft-shell">
        <header className="tab-strip" data-testid="tab-strip" ref={tabStripRef}>
          {tabs.map((t) => (
            <TabButton
              key={t.tabId}
              tab={t}
              active={t.tabId === activeTabId}
              onRequestClose={setCloseTarget}
            />
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
          <ActivityBar />
          <aside
            className="explorer"
            data-testid="explorer"
            ref={explorerRef}
            tabIndex={-1}
            aria-label={
              activePanel === 'usage'
                ? 'Usage'
                : activePanel === 'issues'
                  ? 'GitHub Issues'
                  : 'File explorer'
            }
          >
            {activePanel === 'usage' ? (
              <UsagePanel />
            ) : activePanel === 'issues' ? (
              <IssuesPanel cwd={activeTab?.cwd ?? null} />
            ) : (
              <Explorer root={activeTab?.cwd ?? null} />
            )}
          </aside>
          <section
            className="terminal-host"
            data-testid="terminal-host"
            data-dock={dockPosition}
            data-split={showEditor ? 'on' : 'off'}
            ref={terminalHostRef}
          >
            {dockPosition === 'left' ? (
              <>
                {cliRegion}
                {dockDivider}
                {editorRegion}
              </>
            ) : (
              <>
                {editorRegion}
                {dockDivider}
                {cliRegion}
              </>
            )}
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
          {usage && usage.totalTokens > 0 && (
            <span
              className="status-bar__usage"
              data-testid="usage-readout"
              title={formatUsageTooltip(usage)}
            >
              ✳ {formatUsageLabel(usage)}
            </span>
          )}
          {sessionInfo && (
            <span
              className="status-bar__model"
              data-testid="status-model"
              title={
                `Model: ${modelDisplayName(sessionInfo.model)}` +
                (effortLabel(sessionInfo.effort)
                  ? ` · reasoning effort ${effortLabel(sessionInfo.effort)}`
                  : '')
              }
            >
              ✦ {modelDisplayName(sessionInfo.model)}
              {effortLabel(sessionInfo.effort) ? ` · ${effortLabel(sessionInfo.effort)}` : ''}
            </span>
          )}
          {fiveHour && (
            <span
              className="status-bar__plan"
              data-testid="status-plan-5h"
              data-level={
                fiveHour.utilization >= 90 ? 'crit' : fiveHour.utilization >= 75 ? 'warn' : 'ok'
              }
              title={
                `5-hour plan limit: ${formatUtilization(fiveHour.utilization)} used` +
                (formatResetIn(fiveHour.resetsAt, Date.now())
                  ? ` — ${formatResetIn(fiveHour.resetsAt, Date.now())}`
                  : '') +
                (planStale ? ' (last known)' : '')
              }
            >
              ⏱ 5h {formatUtilization(fiveHour.utilization)}
              {planStale ? ' •' : ''}
            </span>
          )}
          <span className="status-bar__spacer" />
          {hasViewerFile && (
            <button
              type="button"
              className="status-bar__theme"
              aria-label={cliMaximized ? 'show editor' : 'maximize CLI'}
              title={
                cliMaximized
                  ? 'Restore the split view (or press Ctrl+` in the terminal)'
                  : 'Give the CLI the full pane without closing your file (or double-tap Ctrl+`)'
              }
              onClick={() => useDockStore.getState().toggleMaximized()}
            >
              {cliMaximized ? '❐ show editor' : '⛶ max CLI'}
            </button>
          )}
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
        <QuickOpen
          open={overlay === 'quickOpen'}
          cwd={activeTab?.cwd ?? null}
          onOpen={(path, name) => useViewerStore.getState().openFile(path, name)}
          onClose={() => setOverlay((o) => (o === 'quickOpen' ? 'none' : o))}
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
        <ConfirmDialog
          open={closeTarget !== null}
          title="Close project?"
          message={
            <>
              This ends the Claude session in{' '}
              <strong>{closeTarget?.title}</strong> and closes any files open in it.
            </>
          }
          confirmLabel="Close project"
          onConfirm={() => {
            if (closeTarget) closeTab(closeTarget.tabId)
            setCloseTarget(null)
          }}
          onCancel={() => setCloseTarget(null)}
        />
      </div>
    </WorkbenchErrorBoundary>
  )
}
