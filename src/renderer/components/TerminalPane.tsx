import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { routeKey } from '@core/keybindings/keybinding-router'
import '@xterm/xterm/css/xterm.css'

interface Props {
  tabId: string
}

const isSearchChord = (e: { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }): boolean =>
  e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'f'

/**
 * Mounts an xterm bound to a live PTY. On mount it calls `attachSession`, which
 * replays the main-side ring buffer (recovering scrollback after a reload/HMR),
 * then streams live output. On unmount it detaches and disposes WITHOUT closing
 * the PTY — so a renderer reload never kills the session (spec §4.7).
 *
 * Ctrl+Shift+F opens an in-terminal search bar (xterm search addon).
 *
 * This component is intentionally excluded from the unit-coverage gate: its
 * behaviour is DOM/xterm/IPC-bound and is verified by the Playwright-for-Electron
 * E2E suite (including the reload-recovery scenario).
 */
export function TerminalPane({ tabId }: Props): React.ReactElement {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: { background: '#1e1e1e', foreground: '#e6e6e6' }
    })
    const fit = new FitAddon()
    const search = new SearchAddon()
    term.loadAddon(fit)
    term.loadAddon(search)
    termRef.current = term
    searchRef.current = search
    // Reserved app chords (Ctrl+T/W/Tab/1..9) must NOT be swallowed by the
    // terminal; Ctrl+Shift+F opens search; everything else reaches the PTY.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && isSearchChord(e)) {
        setSearchOpen(true)
        return false
      }
      return routeKey(e).kind === 'passthrough'
    })
    term.open(host)

    let disposed = false

    const applyFit = (): void => {
      if (disposed) return
      fit.fit()
      window.api.resizeSession(tabId, term.cols, term.rows)
    }

    // Live output → terminal (only for this tab).
    const offData = window.api.onSessionData(({ tabId: id, data }) => {
      if (id === tabId) term.write(data)
    })
    const offExit = window.api.onSessionExit(({ tabId: id, exitCode }) => {
      if (id === tabId) term.write(`\r\n\x1b[90m[process exited: ${exitCode}]\x1b[0m\r\n`)
    })

    // Keystrokes → PTY.
    const keyListener = term.onData((data) => window.api.writeToSession(tabId, data))

    // Attach: replay buffered output, then fit to the container. A session
    // that already exited renders its exit line so it never looks live.
    void window.api.attachSession(tabId).then(({ snapshot, exited, exitCode }) => {
      if (disposed) return
      if (snapshot) term.write(snapshot)
      if (exited) {
        term.write(`\r\n\x1b[90m[process exited: ${exitCode ?? '?'}]\x1b[0m\r\n`)
      }
      applyFit()
    })

    const observer = new ResizeObserver(() => applyFit())
    observer.observe(host)

    return () => {
      disposed = true
      observer.disconnect()
      offData()
      offExit()
      keyListener.dispose()
      void window.api.detachSession(tabId) // leaves the PTY running
      termRef.current = null
      searchRef.current = null
      term.dispose()
    }
  }, [tabId])

  const closeSearch = (): void => {
    setSearchOpen(false)
    setQuery('')
    termRef.current?.focus()
  }

  return (
    <div className="terminal-pane" data-testid="terminal-pane">
      {searchOpen && (
        <div className="terminal-search" data-testid="terminal-search">
          <input
            autoFocus
            aria-label="search terminal"
            placeholder="Find in terminal…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              searchRef.current?.findNext(e.target.value, { incremental: true })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') searchRef.current?.findNext(query)
              if (e.key === 'Escape') closeSearch()
            }}
          />
          <button type="button" onClick={() => searchRef.current?.findNext(query)}>
            ↓
          </button>
          <button type="button" onClick={() => searchRef.current?.findPrevious(query)}>
            ↑
          </button>
          <button type="button" aria-label="close search" onClick={closeSearch}>
            ×
          </button>
        </div>
      )}
      <div className="terminal-pane__host" ref={hostRef} />
    </div>
  )
}
