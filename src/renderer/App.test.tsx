import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act, waitFor, fireEvent } from '@testing-library/react'
import type { SessionStatus } from '@shared/status/hook-events'
import type { WorkspaceState } from '@shared/ipc/api-contract'
import { WORKSPACE_VERSION } from '@core/persistence/schema'

// TerminalPane is DOM/xterm/IPC-bound (verified by E2E), stub it so the App
// test can focus purely on the tab strip.
vi.mock('./components/TerminalPane', () => ({
  TerminalPane: () => <div data-testid="terminal-pane-stub" />
}))

// ViewerPane is Monaco/DOM-bound (verified by E2E). Stub it so opening a file in
// these unit tests never triggers the lazy `import('../monaco-setup')`, whose
// heavy module graph would otherwise evaluate after the jsdom env is torn down
// and throw "window is not defined". App owns the .viewer-region wrapper these
// tests assert on, so a stub is sufficient.
vi.mock('./components/ViewerPane', () => ({
  ViewerPane: () => <div data-testid="viewer-pane-stub" />
}))

import { App } from './App'
import { useSessionStore } from './store/session-store'
import { useViewerStore } from './store/viewer-store'
import { emptyOpenFiles } from '@core/workspace/open-files'
import { useDockStore } from './store/dock-store'
import { useUsageStore } from './store/usage-store'
import { useIssuesStore } from './store/issues-store'

type StatusEvent = { tabId: string; status: SessionStatus; message?: string }

let statusCb: ((e: StatusEvent) => void) | null = null

const emptyWorkspace: WorkspaceState = {
  version: WORKSPACE_VERSION,
  tabs: [],
  tabOrder: [],
  explorerRoots: [],
  theme: 'system',
  resumeEnabled: false,
  notificationsEnabled: true,
  keymapOverrides: {},
  dock: { position: 'bottom', size: 0.4 }
}

const noop = (): void => {}
const unsub = (): (() => void) => noop

beforeEach(() => {
  statusCb = null
  useSessionStore.setState({ tabs: [], activeTabId: null, spawnFailure: null })
  // The usage store is a singleton; clear panel/usage so plan-readout state
  // never leaks between tests.
  useUsageStore.setState({ usage: null, panel: null })
  useIssuesStore.setState({ panel: null, signIn: null, authError: null })
  // Reset the viewer store fully — it is a singleton whose per-project state
  // would otherwise leak between tests (App's setProject effect writes to it).
  useViewerStore.setState({
    byProject: {},
    projectId: null,
    openFiles: emptyOpenFiles,
    file: null,
    mode: 'view',
    editing: false,
    saveTick: 0
  })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      loadWorkspace: vi.fn(async () => emptyWorkspace),
      saveWorkspace: vi.fn(async () => {}),
      listSessions: vi.fn(async () => []),
      createSession: vi.fn(),
      closeSession: vi.fn(async () => {}),
      moveTabToWindow: vi.fn(async () => {}),
      openProject: vi.fn(async () => null),
      getGitBranch: vi.fn(async () => null),
      getUsage: vi.fn(async () => ({
        costUsd: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        sessionCount: 0
      })),
      getUsagePanel: vi.fn(async () => ({
        planLimits: null,
        weekly: {
          costUsd: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          sessionCount: 0
        },
        sessions: []
      })),
      onSessionStatus: vi.fn((cb: (e: StatusEvent) => void) => {
        statusCb = cb
        return unsub()
      }),
      onSessionExit: vi.fn(unsub),
      onActivateTab: vi.fn(unsub),
      onReDockTab: vi.fn(unsub),
      // Explorer needs these once a tab (with a cwd) becomes active.
      listDir: vi.fn(async () => []),
      watchDir: vi.fn(async () => ({ watchId: 'w1' })),
      unwatchDir: vi.fn(async () => {}),
      onFsChange: vi.fn(unsub),
      // GitHub Issues panel bridge.
      getIssues: vi.fn(async () => ({
        repo: null,
        issues: [],
        authSource: 'none' as const,
        fetchedAt: '2026-07-20T12:00:00Z',
        stale: false,
        error: null
      })),
      githubSignIn: vi.fn(async () => ({ error: 'not configured' })),
      githubSignOut: vi.fn(async () => {}),
      onGithubAuth: vi.fn(unsub),
      openExternal: vi.fn(async () => {})
    }
  })
})

afterEach(cleanup)

describe('App tab status coloring', () => {
  it('reflects each Claude Code state as a status class on the whole tab', async () => {
    render(<App />)

    // A freshly opened tab is `unknown` until a hook reports.
    act(() => {
      useSessionStore.getState().addTab({ tabId: 't1', title: 'proj', cwd: '/p' })
    })
    const tab = await screen.findByTestId('tab')
    expect(tab.classList.contains('tab--unknown')).toBe(true)

    await waitFor(() => expect(statusCb).not.toBeNull())

    // running → working
    act(() => statusCb!({ tabId: 't1', status: 'working' }))
    expect(tab.classList.contains('tab--working')).toBe(true)
    expect(tab.classList.contains('tab--unknown')).toBe(false)

    // waiting for user response → waiting
    act(() => statusCb!({ tabId: 't1', status: 'waiting' }))
    expect(tab.classList.contains('tab--waiting')).toBe(true)
    expect(tab.classList.contains('tab--working')).toBe(false)

    // completed → done
    act(() => statusCb!({ tabId: 't1', status: 'done' }))
    expect(tab.classList.contains('tab--done')).toBe(true)
    expect(tab.classList.contains('tab--waiting')).toBe(false)
  })

  it('scopes the status class to the tab it targets', async () => {
    render(<App />)
    act(() => {
      const s = useSessionStore.getState()
      s.addTab({ tabId: 't1', title: 'one', cwd: '/a' })
      s.addTab({ tabId: 't2', title: 'two', cwd: '/b' })
    })
    await screen.findAllByTestId('tab')
    await waitFor(() => expect(statusCb).not.toBeNull())

    act(() => statusCb!({ tabId: 't2', status: 'working' }))

    const [first, second] = screen.getAllByTestId('tab')
    expect(first!.classList.contains('tab--unknown')).toBe(true)
    expect(second!.classList.contains('tab--working')).toBe(true)
  })
})

describe('App command palette', () => {
  it('opens on Ctrl+Shift+P and closes on Escape', async () => {
    render(<App />)
    expect(screen.queryByTestId('command-palette')).toBeNull()

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true })
      )
    })
    const palette = await screen.findByTestId('command-palette')
    expect(palette).toBeTruthy()
    expect(screen.getByRole('combobox')).toBeTruthy()

    // Running a command from the palette (Cycle Theme) applies and closes it.
    act(() => useSessionStore.getState().setTheme('system'))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'cycle theme' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    await waitFor(() => expect(screen.queryByTestId('command-palette')).toBeNull())
    expect(useSessionStore.getState().theme).toBe('light')
  })
})

describe('App keyboard help', () => {
  it('opens the help overlay on Ctrl+Shift+/ and closes on Escape', async () => {
    render(<App />)
    expect(screen.queryByTestId('keyboard-help')).toBeNull()

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '/', ctrlKey: true, shiftKey: true })
      )
    })
    const help = await screen.findByTestId('keyboard-help')
    expect(help).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeTruthy()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('keyboard-help')).toBeNull())
  })
})

describe('App region focus (keyboard-only navigation)', () => {
  const dispatch = (init: KeyboardEventInit): void => {
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', init))
    })
  }

  it('Ctrl+Shift+E focuses the explorer region', async () => {
    render(<App />)
    dispatch({ key: 'E', ctrlKey: true, shiftKey: true })
    // Empty tree → the explorer shell (tabIndex -1) receives focus.
    expect(document.activeElement).toBe(screen.getByTestId('explorer'))
  })

  it('Ctrl+` focuses the terminal region when a session is active', async () => {
    render(<App />)
    act(() => {
      useSessionStore.getState().addTab({ tabId: 't1', title: 'p', cwd: '/p' })
    })
    await screen.findByTestId('tab')
    dispatch({ key: '`', ctrlKey: true })
    expect(document.activeElement).toBe(screen.getByTestId('terminal-region'))
  })

  it('Ctrl+F6 cycles focus to the next present region', async () => {
    render(<App />)
    act(() => {
      useSessionStore.getState().addTab({ tabId: 't1', title: 'p', cwd: '/p' })
    })
    await screen.findByTestId('tab')

    // Start on the explorer, then cycle → next present region is the terminal.
    dispatch({ key: 'E', ctrlKey: true, shiftKey: true })
    expect(document.activeElement).toBe(screen.getByTestId('explorer'))
    dispatch({ key: 'F6', ctrlKey: true })
    expect(document.activeElement).toBe(screen.getByTestId('terminal-region'))
  })

  it('Ctrl+F6 skips absent regions (no tab, no viewer → explorer to status)', async () => {
    useViewerStore.setState({ openFiles: emptyOpenFiles, file: null })
    render(<App />)
    // No tabs (terminal absent) and no viewer file → present = [tabs, explorer, status].
    dispatch({ key: 'E', ctrlKey: true, shiftKey: true })
    expect(document.activeElement).toBe(screen.getByTestId('explorer'))
    dispatch({ key: 'F6', ctrlKey: true })
    // Terminal and viewer are absent, so the next region is the status bar.
    const statusBtn = screen.getByTestId('status-bar').querySelector('button')
    expect(document.activeElement).toBe(statusBtn)
  })
})

describe('App keyboard tab management', () => {
  it('Ctrl+Shift+PageDown / PageUp reorder the active tab', async () => {
    render(<App />)
    act(() => {
      const s = useSessionStore.getState()
      s.addTab({ tabId: 't1', title: 'one', cwd: '/a' })
      s.addTab({ tabId: 't2', title: 'two', cwd: '/b' })
      s.addTab({ tabId: 't3', title: 'three', cwd: '/c' })
      s.setActive('t2')
    })
    await screen.findAllByTestId('tab')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', ctrlKey: true, shiftKey: true }))
    })
    expect(useSessionStore.getState().tabs.map((t) => t.tabId)).toEqual(['t2', 't1', 't3'])

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'PageDown', ctrlKey: true, shiftKey: true })
      )
    })
    expect(useSessionStore.getState().tabs.map((t) => t.tabId)).toEqual(['t1', 't2', 't3'])
  })

  it('F2 on a focused tab enters inline rename', async () => {
    render(<App />)
    act(() => {
      useSessionStore.getState().addTab({ tabId: 't1', title: 'proj', cwd: '/a' })
    })
    // The label button's accessible name is the badge aria-label + the title.
    const label = await screen.findByRole('button', { name: 'status: unknown proj' })
    fireEvent.keyDown(label, { key: 'F2' })
    const input = await screen.findByLabelText('rename tab')
    expect(input).toBeTruthy()
    fireEvent.change(input, { target: { value: 'renamed' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(useSessionStore.getState().tabs[0]!.title).toBe('renamed'))
  })
})

describe('App viewer commands', () => {
  it('runs viewer.diff from the palette (no file needed to set the mode)', async () => {
    useViewerStore.setState({ openFiles: emptyOpenFiles, file: null, mode: 'view', editing: false, saveTick: 0 })
    render(<App />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true }))
    })
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'diff vs head' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    await waitFor(() => expect(useViewerStore.getState().mode).toBe('diff'))
  })

  it('runs viewer.save from the palette (requests a save)', async () => {
    useViewerStore.setState({ openFiles: emptyOpenFiles, file: null, mode: 'view', editing: false, saveTick: 0 })
    render(<App />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true }))
    })
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'save file' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    await waitFor(() => expect(useViewerStore.getState().saveTick).toBe(1))
  })

  it('app-level Ctrl+S in the viewer region requests a save; Ctrl+Alt+S does not', async () => {
    // The viewer region only exists when a file is open (Expansion 8 split).
    const f = { path: '/p/x.ts', name: 'x.ts' }
    useViewerStore.setState({
      openFiles: { files: [f], activeIndex: 0 },
      file: f,
      mode: 'view',
      editing: false,
      saveTick: 0
    })
    render(<App />)
    const region = screen.getByTestId('viewer-region')
    fireEvent.keyDown(region, { key: 's', ctrlKey: true })
    expect(useViewerStore.getState().saveTick).toBe(1)
    // Modified chords must not hijack save.
    fireEvent.keyDown(region, { key: 's', ctrlKey: true, altKey: true })
    fireEvent.keyDown(region, { key: 's', ctrlKey: true, metaKey: true })
    expect(useViewerStore.getState().saveTick).toBe(1)
  })
})

describe('App per-project editor tabs (regression: files were global)', () => {
  it('switching the active project swaps the viewer file set', async () => {
    render(<App />)
    act(() => {
      const s = useSessionStore.getState()
      s.addTab({ tabId: 't1', title: 'one', cwd: '/a' })
      s.addTab({ tabId: 't2', title: 'two', cwd: '/b' })
      s.setActive('t1')
    })
    await waitFor(() => expect(useViewerStore.getState().projectId).toBe('t1'))
    act(() => useViewerStore.getState().openFile('/a/x.ts', 'x.ts'))
    expect(useViewerStore.getState().file?.path).toBe('/a/x.ts')

    // Switch to project 2 → its empty set shows, not project 1's file.
    act(() => useSessionStore.getState().setActive('t2'))
    await waitFor(() => expect(useViewerStore.getState().projectId).toBe('t2'))
    expect(useViewerStore.getState().file).toBeNull()

    // Back to project 1 → the file is still open (not lost on the round trip).
    act(() => useSessionStore.getState().setActive('t1'))
    await waitFor(() => expect(useViewerStore.getState().file?.path).toBe('/a/x.ts'))
  })

  it('closing a project drops its editor tabs (no stale file left open)', async () => {
    render(<App />)
    act(() => {
      const s = useSessionStore.getState()
      s.addTab({ tabId: 't1', title: 'one', cwd: '/a' })
      s.setActive('t1')
    })
    await waitFor(() => expect(useViewerStore.getState().projectId).toBe('t1'))
    act(() => useViewerStore.getState().openFile('/a/x.ts', 'x.ts'))
    expect(useViewerStore.getState().file?.path).toBe('/a/x.ts')

    // Closing a whole project is guarded by a confirm dialog now.
    fireEvent.click(await screen.findByLabelText('close one'))
    fireEvent.click(await screen.findByRole('button', { name: 'Close project' }))
    await waitFor(() => expect(useViewerStore.getState().file).toBeNull())
  })
})

describe('App overlay key handling', () => {
  it('stands down while the palette is open (Ctrl+T does not open a project)', async () => {
    render(<App />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true }))
    })
    await screen.findByTestId('command-palette')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true }))
    })
    // The palette owns the keyboard: the global new-tab chord did not fire.
    expect(window.api.openProject).not.toHaveBeenCalled()
    expect(screen.getByTestId('command-palette')).toBeTruthy()
  })
})

describe('App status commands', () => {
  it('toggles resume from the palette', async () => {
    act(() => useSessionStore.setState({ resumeEnabled: false }))
    render(<App />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true }))
    })
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'toggle resume' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    await waitFor(() => expect(useSessionStore.getState().resumeEnabled).toBe(true))
  })

  it('toggles notifications from the palette', async () => {
    act(() => useSessionStore.setState({ notificationsEnabled: true }))
    render(<App />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true }))
    })
    fireEvent.change(await screen.findByRole('combobox'), {
      target: { value: 'toggle notifications' }
    })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    await waitFor(() => expect(useSessionStore.getState().notificationsEnabled).toBe(false))
  })

  it('toggles notifications from the status-bar button', async () => {
    act(() => useSessionStore.setState({ notificationsEnabled: true }))
    render(<App />)
    const btn = await screen.findByLabelText('notifications: on')
    fireEvent.click(btn)
    await waitFor(() => expect(useSessionStore.getState().notificationsEnabled).toBe(false))
  })

  it('cycles the CLI dock position from the palette', async () => {
    act(() => useDockStore.setState({ position: 'bottom', size: 0.4 }))
    render(<App />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true }))
    })
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'move cli dock' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    await waitFor(() => expect(useDockStore.getState().position).toBe('right'))
  })

  it('renames the active tab from the palette (criterion 7)', async () => {
    act(() =>
      useSessionStore.setState({
        tabs: [{ tabId: 't1', title: 'proj', cwd: 'C:/p', command: 'claude', status: 'unknown' }],
        activeTabId: 't1',
        renameTick: 0
      })
    )
    render(<App />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true }))
    })
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'rename tab' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    // The active tab's inline rename input appears.
    expect(await screen.findByLabelText('rename tab')).toBeTruthy()
  })
})

describe('App maximize CLI (full-pane focus mode)', () => {
  // A file is open so the split (and the maximize affordance) exist.
  const openAFile = (): void => {
    const f = { path: '/p/x.ts', name: 'x.ts' }
    useViewerStore.setState({ openFiles: { files: [f], activeIndex: 0 }, file: f })
  }

  it('toggles maximize from the palette, hiding the editor without closing the file', async () => {
    openAFile()
    render(<App />)
    // Split is showing: the editor region is present.
    expect(screen.getByTestId('viewer-region')).toBeTruthy()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true }))
    })
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'maximize cli' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })

    // Editor pane + divider are gone, but the file is STILL open (not closed).
    await waitFor(() => expect(useDockStore.getState().maximized).toBe(true))
    expect(screen.queryByTestId('viewer-region')).toBeNull()
    expect(screen.queryByTestId('dock-divider')).toBeNull()
    expect(useViewerStore.getState().file?.path).toBe('/p/x.ts')
  })

  it('toggles from the status-bar button and back', async () => {
    openAFile()
    render(<App />)
    // Not maximized → button offers "maximize CLI".
    fireEvent.click(await screen.findByLabelText('maximize CLI'))
    await waitFor(() => expect(screen.queryByTestId('viewer-region')).toBeNull())

    // Now maximized → button offers "show editor"; clicking restores the split.
    fireEvent.click(await screen.findByLabelText('show editor'))
    await waitFor(() => expect(screen.getByTestId('viewer-region')).toBeTruthy())
  })

  it('Ctrl+` focuses the terminal, a 2nd press maximizes, a 3rd restores', async () => {
    render(<App />)
    act(() => {
      const s = useSessionStore.getState()
      s.addTab({ tabId: 't1', title: 'p', cwd: '/p' })
      s.setActive('t1')
    })
    await waitFor(() => expect(useViewerStore.getState().projectId).toBe('t1'))
    act(() => useViewerStore.getState().openFile('/p/x.ts', 'x.ts'))
    expect(screen.getByTestId('viewer-region')).toBeTruthy()

    const press = (): void =>
      act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '`', ctrlKey: true })))

    // 1st press → focus the terminal region (no maximize yet).
    press()
    expect(document.activeElement).toBe(screen.getByTestId('terminal-region'))
    expect(useDockStore.getState().maximized).toBe(false)

    // 2nd press (already focused) → maximize; editor hidden but file still open.
    press()
    await waitFor(() => expect(useDockStore.getState().maximized).toBe(true))
    expect(screen.queryByTestId('viewer-region')).toBeNull()
    expect(useViewerStore.getState().file?.path).toBe('/p/x.ts')

    // 3rd press → restore the split.
    press()
    await waitFor(() => expect(useDockStore.getState().maximized).toBe(false))
    expect(screen.getByTestId('viewer-region')).toBeTruthy()
  })

  it('hides the maximize button when no file is open (nothing to maximize)', () => {
    useViewerStore.setState({ openFiles: emptyOpenFiles, file: null })
    render(<App />)
    expect(screen.queryByLabelText('maximize CLI')).toBeNull()
  })

  it('opening a different file exits maximize (never opens into a hidden pane)', async () => {
    openAFile()
    render(<App />)
    act(() => useDockStore.getState().setMaximized(true))
    await waitFor(() => expect(screen.queryByTestId('viewer-region')).toBeNull())

    // Navigating to another file must reveal the editor again.
    act(() => useViewerStore.setState({ file: { path: '/p/y.ts', name: 'y.ts' } }))
    await waitFor(() => expect(useDockStore.getState().maximized).toBe(false))
    expect(screen.getByTestId('viewer-region')).toBeTruthy()
  })
})

describe('App theme toggle', () => {
  it('cycles system → light → dark → cyberpunk → system and reflects it on <html>', async () => {
    act(() => useSessionStore.getState().setTheme('system'))
    render(<App />)
    const btn = await screen.findByRole('button', { name: /^theme:/ })
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('system'))

    for (const expected of ['light', 'dark', 'cyberpunk', 'system']) {
      fireEvent.click(btn)
      await waitFor(() => expect(document.documentElement.dataset['theme']).toBe(expected))
    }

    // Back at the start; the toggle advertises the active theme for a11y.
    expect(screen.getByRole('button', { name: 'theme: system' })).toBeTruthy()
  })
})

describe('App status-bar 5-hour plan readout (always on)', () => {
  const withFiveHour = (utilization: number, stale = false): void => {
    act(() =>
      useUsageStore.getState().setPanel({
        planLimits: {
          fiveHour: { utilization, resetsAt: null },
          sevenDay: null,
          sevenDayOpus: null,
          fetchedAt: '2026-07-20T00:00:00.000Z',
          stale
        },
        weekly: {
          costUsd: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          sessionCount: 0
        },
        sessions: []
      })
    )
  }

  it('shows the 5-hour utilization even when the file explorer is the active panel', async () => {
    render(<App />)
    // Explorer is the default panel, yet the plan readout is still present.
    withFiveHour(42)
    const readout = await screen.findByTestId('status-plan-5h')
    expect(readout.textContent).toContain('5h 42%')
    expect(readout.dataset['level']).toBe('ok')
  })

  it('flags warn/crit levels and a stale (last-known) reading', async () => {
    render(<App />)
    withFiveHour(80)
    await waitFor(() =>
      expect(screen.getByTestId('status-plan-5h').dataset['level']).toBe('warn')
    )
    withFiveHour(95, true)
    await waitFor(() => {
      const el = screen.getByTestId('status-plan-5h')
      expect(el.dataset['level']).toBe('crit')
      expect(el.getAttribute('title')).toContain('(last known)')
    })
  })

  it('renders nothing when plan limits are unavailable', async () => {
    render(<App />)
    act(() =>
      useUsageStore.getState().setPanel({
        planLimits: null,
        weekly: {
          costUsd: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          sessionCount: 0
        },
        sessions: []
      })
    )
    await waitFor(() => expect(screen.queryByTestId('status-plan-5h')).toBeNull())
  })
})
