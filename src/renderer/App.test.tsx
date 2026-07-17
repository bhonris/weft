import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act, waitFor } from '@testing-library/react'
import type { SessionStatus } from '@shared/status/hook-events'
import type { WorkspaceState } from '@shared/ipc/api-contract'
import { WORKSPACE_VERSION } from '@core/persistence/schema'

// TerminalPane is DOM/xterm/IPC-bound (verified by E2E), stub it so the App
// test can focus purely on the tab strip.
vi.mock('./components/TerminalPane', () => ({
  TerminalPane: () => <div data-testid="terminal-pane-stub" />
}))

import { App } from './App'
import { useSessionStore } from './store/session-store'

type StatusEvent = { tabId: string; status: SessionStatus; message?: string }

let statusCb: ((e: StatusEvent) => void) | null = null

const emptyWorkspace: WorkspaceState = {
  version: WORKSPACE_VERSION,
  tabs: [],
  tabOrder: [],
  explorerRoots: [],
  theme: 'system',
  resumeEnabled: false
}

const noop = (): void => {}
const unsub = (): (() => void) => noop

beforeEach(() => {
  statusCb = null
  useSessionStore.setState({ tabs: [], activeTabId: null, spawnFailure: null })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      loadWorkspace: vi.fn(async () => emptyWorkspace),
      saveWorkspace: vi.fn(async () => {}),
      listSessions: vi.fn(async () => []),
      createSession: vi.fn(),
      getGitBranch: vi.fn(async () => null),
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
      onFsChange: vi.fn(unsub)
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
