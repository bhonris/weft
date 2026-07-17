import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { routeKey } from '@core/keybindings/keybinding-router'
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
 * This component is intentionally excluded from the unit-coverage gate: its
 * behaviour is DOM/xterm/IPC-bound and is verified by the Playwright-for-Electron
 * E2E suite (including the reload-recovery scenario).
 */
export function TerminalPane({ tabId }: Props): React.ReactElement {
  const hostRef = useRef<HTMLDivElement>(null)

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
    term.loadAddon(fit)
    // Reserved app chords (Ctrl+T/W/Tab/1..9) must NOT be swallowed by the
    // terminal; everything else (Ctrl+C, arrows, …) reaches the PTY.
    term.attachCustomKeyEventHandler((e) => routeKey(e).kind === 'passthrough')
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

    // Attach: replay buffered output, then fit to the container.
    void window.api.attachSession(tabId).then(({ snapshot }) => {
      if (disposed) return
      if (snapshot) term.write(snapshot)
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
      term.dispose()
    }
  }, [tabId])

  return <div className="terminal-pane" data-testid="terminal-pane" ref={hostRef} />
}
