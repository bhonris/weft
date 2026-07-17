phase: time-leap-development
leap_count: 4
expansion_cycle: 1
session_id: 2026-07-17T17:00:00Z
prev_head: d321679
original_prompt: "Build Weft — a cross-platform (Windows-first) Electron desktop app with a VS Code-style interface built around browser-style tabs of Claude Code CLI sessions (one tab per project), an integrated file explorer, per-tab Claude session status awareness driven by Claude Code hooks, Monaco read-only+diff viewer, tear-off tabs into separate windows, workspace persistence, and app-owned OS notifications. React+TS+Vite renderer, node-pty terminals via xterm.js, electron-store persistence. Full design at documents/claude-terminal-ide.md."
project_name: "weft"
project_type: web
spec_path: documents/steiner-spec.md
test_cmd: pnpm test
dev_server_port: 5173
coverage_pct: 100
divergence_readings: []
current_focus: "Wire the IPC layer + preload bridge + renderer terminal to complete the §4.7 session-resilience guarantee END-TO-END. (1) main/ipc/register.ts: ipcMain.handle for createSession (generate uuid, spawn via NodePtyFactory with claude --session-id + CLAUDE_IDE_TAB env + inline --settings hooks), writeToSession, resizeSession, closeSession, attachSession (returns {snapshot}, subscribes a per-webContents listener that sends CH.sessionData), detachSession, plus loadWorkspace/saveWorkspace. Forward pty data/exit via webContents.send(CH.sessionData/sessionExit). (2) preload/bridge.ts: implement WeftApi over ipcRenderer.invoke/on, each on* returning Unsubscribe; expose as window.api (contextBridge). (3) renderer: zustand store + TerminalPane (mount xterm + fit/webgl/serialize addons, call attachSession on mount, write snapshot, subscribe onSessionData, and on unmount/HMR-dispose detach + dispose xterm — exactly one subscription), and a WorkbenchErrorBoundary (fallback + reload) around the workbench. Add src/main/ipc/**, src/preload/**, src/renderer/store/** to vitest coverage include as they land."
blocked_on: null
last_test_run: "74 pass, 0 fail"
closed_worldlines: [divergence-analysis, worldline-selection]
next_action: "Build main/ipc/register.ts + preload/bridge.ts + renderer TerminalPane/store + WorkbenchErrorBoundary. Unit-test IPC handlers with a fake PtyManager + fake ipcMain; test preload bridge over a fake ipcRenderer; test the error boundary + store in jsdom. Then Phase 3b (Playwright-Electron) can smoke-test the running app incl. the reload-recovery E2E. node-pty is installed (prebuilt, ConPTY dll copied); a full Electron-ABI rebuild (@electron/rebuild) may be needed before pnpm dev launches — verify at Phase 3b and add electron-rebuild to postinstall if so."
sern_interference_count: 0
mayuri_rework_count: 0
decisions:
  - architecture: "BETA worldline — shared/ (pure IPC contract) + core/ (pure logic: status-mapper, reducers, migrations, correlator, throttle) + main/ (thin Electron adapters + platform/ seams for named-pipe vs UDS + DI container) + preload/ (typed bridge) + renderer/ (React+zustand). PTY lives in main, renderer is a view over main's truth. Beta chosen over Alpha for multi-concern app + 95% coverage bar + cross-platform seam + v2 roadmap."
  - testing: "vitest + @vitest/coverage-v8 (95%/90% thresholds), projects api (node + jsdom); business logic pure & tested via injected fakes (FakePty, FakePlatform, fake store); Playwright for Electron E2E; manual ConPTY/TUI verification on Windows"
  - stack: "TypeScript, Electron 34 + electron-vite 3, pnpm, React 19 + Vite 6 renderer, zustand 5, xterm.js 5.5, chokidar 4, electron-store 10, monaco 0.52, dockview 4, zod 3, node-pty (deferred native install)"
review_items:
  must_fix: []
  nice_to_have: []
  closed: []
max_iterations: 30
push_to_github: false
bypass_playwright: false
sern_no_progress_streak: 0
lessons_learned: []
