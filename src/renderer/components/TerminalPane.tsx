import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { UnicodeGraphemesAddon } from '@xterm/addon-unicode-graphemes'
import { routeKey } from '@core/keybindings/keybinding-router'
import { buildKeymap } from '@core/keybindings/effective-keymap'
import { TERMINAL_FONT_FAMILY, TERMINAL_LINE_HEIGHT } from '@core/terminal/font-stack'
import { useTerminalStore } from '../store/terminal-store'
import { useSessionStore } from '../store/session-store'
import { useFontStore } from '../store/font-store'
import '@xterm/xterm/css/xterm.css'

interface Props {
  tabId: string
}

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
  const fitRef = useRef<FitAddon | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Open the search bar when the command layer requests it (palette / a remapped
  // chord). A ref-guard ignores the mount-time value and tab-switch remounts, so
  // search only opens on a genuine new request.
  const searchTick = useTerminalStore((s) => s.searchTick)
  const lastSearchTick = useRef(searchTick)
  useEffect(() => {
    if (searchTick !== lastSearchTick.current) {
      lastSearchTick.current = searchTick
      setSearchOpen(true)
    }
  }, [searchTick])

  // xterm's key handler must resolve against the SAME effective keymap as the
  // app-level listener, or a remapped/freed chord and the terminal disagree
  // (a §7.4 passthrough regression). Read live via a ref so a rebind applies
  // without re-attaching the handler.
  const keymapOverrides = useSessionStore((s) => s.keymapOverrides)
  const keymapRef = useRef(buildKeymap(keymapOverrides))
  useEffect(() => {
    keymapRef.current = buildKeymap(keymapOverrides)
  }, [keymapOverrides])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      // Thai (and other non-Latin) support depends on this fallback chain —
      // the leading monospace fonts have no Thai glyphs. See font-stack.ts.
      fontFamily: TERMINAL_FONT_FAMILY,
      // Extra row height so stacked Thai vowels/tone marks aren't cropped.
      lineHeight: TERMINAL_LINE_HEIGHT,
      // Initial size read once from the font store; live changes are applied by
      // the separate effect below (so a resize never re-mounts the terminal).
      fontSize: useFontStore.getState().terminalFontSize,
      cursorBlink: true,
      // Required by the Unicode graphemes addon (unicode.activeVersion is proposed API).
      allowProposedApi: true,
      scrollback: 8000, // spec §4.3: cap live scrollback per tab
      theme: { background: '#1e1e1e', foreground: '#e6e6e6' }
    })
    const fit = new FitAddon()
    const search = new SearchAddon()
    term.loadAddon(fit)
    term.loadAddon(search)
    // Grapheme clustering: group a Thai base consonant with its stacked upper
    // vowel + tone mark (U+0E31/0E34–3A/0E47–4E, etc.) into a single cell, so
    // the DOM renderer emits the whole cluster as one span and the browser's
    // shaper can stack the marks over the base (best the grid model allows —
    // xterm does no HarfBuzz-class shaping itself). Also fixes combining-mark
    // width so the cursor advances correctly. Complements the Thai font stack.
    term.loadAddon(new UnicodeGraphemesAddon())
    term.unicode.activeVersion = '15-graphemes'
    termRef.current = term
    fitRef.current = fit
    searchRef.current = search
    // Single source of truth: the pure router. terminal-search opens the search
    // bar (and is swallowed); passthrough reaches the PTY; any other reserved
    // app chord is swallowed here so the app-level listener handles it.
    term.attachCustomKeyEventHandler((e) => {
      const action = routeKey(e, keymapRef.current)
      if (e.type === 'keydown' && action.kind === 'terminal-search') {
        setSearchOpen(true)
        return false
      }
      return action.kind === 'passthrough'
    })
    term.open(host)

    // DELIBERATE: no WebGL addon. GL rendering moves terminal text out of the
    // DOM, which breaks assistive-tech access AND automated verification
    // (every Playwright text assertion went dark when it was trialled —
    // STEINER_LOG leap 25). The DOM renderer is fully adequate at Weft's
    // scale; revisit only with a measured throughput problem.

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
      fitRef.current = null
      searchRef.current = null
      term.dispose()
    }
  }, [tabId])

  // Apply a live terminal font-size change without re-mounting the terminal:
  // set the option, then re-fit and tell the PTY the new cols/rows so wrapping
  // stays correct. Guarded so it no-ops before the terminal mounts.
  const terminalFontSize = useFontStore((s) => s.terminalFontSize)
  useEffect(() => {
    const term = termRef.current
    const fit = fitRef.current
    if (!term || !fit) return
    if (term.options.fontSize === terminalFontSize) return
    term.options.fontSize = terminalFontSize
    fit.fit()
    window.api.resizeSession(tabId, term.cols, term.rows)
  }, [terminalFontSize, tabId])

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
