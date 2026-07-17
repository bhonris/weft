phase: time-leap-development
leap_count: 5
expansion_cycle: 1
session_id: 2026-07-17T17:18:00Z
prev_head: 2aa4dd65cf1569a2d9015adeaff099c8429e9792
original_prompt: "Build Weft — a cross-platform (Windows-first) Electron desktop app with a VS Code-style interface built around browser-style tabs of Claude Code CLI sessions (one tab per project), an integrated file explorer, per-tab Claude session status awareness driven by Claude Code hooks, Monaco read-only+diff viewer, tear-off tabs into separate windows, workspace persistence, and app-owned OS notifications. React+TS+Vite renderer, node-pty terminals via xterm.js, electron-store persistence. Full design at documents/claude-terminal-ide.md."
project_name: "weft"
project_type: web
spec_path: documents/steiner-spec.md
test_cmd: pnpm test
dev_server_port: 5173
coverage_pct: 99
divergence_readings: []
current_focus: "Verify the terminal works END-TO-END in the real Electron app. node-pty's prebuilt binary is built for Node's ABI, NOT Electron 34's — spawning a session in-app will likely fail until rebuilt. Add @electron/rebuild (dev dep), add a postinstall/rebuild step for node-pty against Electron, launch pnpm dev, open a project, and confirm a live claude session renders + accepts input. This de-risks the Phase-3b node-pty blocker. If the rebuild needs VS C++ build tools not present, PAUSE and tell the user."
blocked_on: "node-pty Electron-ABI rebuild needs VS C++ Build Tools (not installed). User chose to install them (winget Microsoft.VisualStudio.2022.BuildTools + Workload.VCTools). AFTER install: run `pnpm rebuild:native`, then `pnpm dev` and open a project to verify a live claude session. Python 3.14.2 present — if node-gyp errors on Python compat, install Python 3.11 and set npm_config_python. Feature work (file explorer, status server, notifications, Monaco) can proceed in parallel and does NOT depend on this."
last_test_run: "98 pass, 0 fail"
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
lessons_learned: []
