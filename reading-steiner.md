phase: time-leap-development
leap_count: 7
expansion_cycle: 1
session_id: 2026-07-17T19:30:00Z
prev_head: 2ec08d1
original_prompt: "Build Weft — a cross-platform (Windows-first) Electron desktop app with a VS Code-style interface built around browser-style tabs of Claude Code CLI sessions (one tab per project), an integrated file explorer, per-tab Claude session status awareness driven by Claude Code hooks, Monaco read-only+diff viewer, tear-off tabs into separate windows, workspace persistence, and app-owned OS notifications. React+TS+Vite renderer, node-pty terminals via xterm.js, electron-store persistence. Full design at documents/claude-terminal-ide.md."
project_name: "weft"
project_type: web
spec_path: documents/steiner-spec.md
test_cmd: pnpm test
dev_server_port: 5173
coverage_pct: 99
divergence_readings: []
current_focus: "Render the file explorer tree in the renderer: Explorer.tsx — for the active tab's cwd, lazy-expand directories via window.api.listDir; clicking a file reveals/opens it. Then continue: status server (named-pipe/UDS platform seam + inject inline --settings reporting hooks at spawn in register.createSession + wire correlator + status-mapper so tab badges reflect working/waiting/done/error); app-owned OS notifications (focus window+tab on click); Monaco read-only + diff viewer; workspace persistence IPC (loadWorkspace/saveWorkspace) + restore-on-launch; tear-off windows."
blocked_on: null
last_test_run: "110 pass, 0 fail"
closed_worldlines: [divergence-analysis, worldline-selection]
next_action: "Rebuild node-pty for Electron (@electron/rebuild) and launch to verify open-project -> live claude session. Then continue Phase 3 features toward the remaining acceptance criteria: (a) file explorer — fs-service (readdir/stat/reveal/open + chokidar watch) + IPC + virtualized tree; (b) status server — named-pipe/UDS transport (platform seam) + inline --settings hook injection at spawn + wire correlator + status-mapper to update tab badges; (c) app-owned OS notifications (focus window+tab on click); (d) Monaco read-only + diff viewer; (e) workspace persistence IPC wiring (loadWorkspace/saveWorkspace + restore on launch); (f) tear-off windows. Grow vitest coverage include as modules land. When ALL acceptance criteria are checked AND coverage>=90, advance to Phase 3b (Playwright-for-Electron)."
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
lessons_learned: ["cycle 1: node-pty Electron rebuild blocked twice on Windows — (a) NoDefaultCurrentDirectoryInExePath=1 breaks winpty GetCommitHash.bat (now unset inside scripts/rebuild-native.mjs), (b) SpectreMitigation flag required Spectre VS libs (removed via committed pnpm patch node-pty@1.1.0). node-pty verified spawning ConPTY under Electron. Rebuild reproducible via pnpm rebuild:native."]
