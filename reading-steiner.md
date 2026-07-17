phase: time-leap-development
leap_count: 3
expansion_cycle: 1
session_id: 2026-07-17T16:32:00Z
prev_head: 0dce3bc7663a6dd7b9e74c493f8264f67a30aaef
original_prompt: "Build Weft — a cross-platform (Windows-first) Electron desktop app with a VS Code-style interface built around browser-style tabs of Claude Code CLI sessions (one tab per project), an integrated file explorer, per-tab Claude session status awareness driven by Claude Code hooks, Monaco read-only+diff viewer, tear-off tabs into separate windows, workspace persistence, and app-owned OS notifications. React+TS+Vite renderer, node-pty terminals via xterm.js, electron-store persistence. Full design at documents/claude-terminal-ide.md."
project_name: "weft"
project_type: web
spec_path: documents/steiner-spec.md
test_cmd: pnpm test
dev_server_port: 5173
coverage_pct: 100
divergence_readings: []
current_focus: "Implement PtyManager in main/services with an injectable PtyFactory interface (production adapter lazy-imports node-pty; tests use a FakePty EventEmitter). Cover: create session (spawn claude --session-id <uuid> with cwd + CLAUDE_IDE_TAB env + inline --settings hooks), write, resize (throttled <=1/50ms via core/terminal/resize-throttle), close (pty.kill + deregister), data/exit events. HARD REQUIREMENT (user-driven, spec §4.7): PTY lifecycle is decoupled from the renderer — a PTY dies ONLY on explicit closeSession/process-exit, NEVER on renderer reload/HMR/crash. PtyManager MUST keep a bounded per-session output ring buffer (default 8k lines); add window.api.attachSession(tabId)/detachSession(tabId) (+ channels) that replays the ring buffer to a freshly mounted xterm then streams live data; make attach idempotent (one session:data subscription per mount, no leaks); add a renderer error boundary (fallback + reload) around the workbench. Then install node-pty native."
blocked_on: null
last_test_run: "40 pass, 0 fail"
closed_worldlines: [divergence-analysis, worldline-selection]
next_action: "Phase 3 next slice: build core/terminal/resize-throttle (pure, injected clock) + main/services/pty-manager (PtyFactory DI, FakePty tests) + core/status/session-correlator (session_id -> tabId -> cwd resolution). Add node-pty to deps and the real PtyFactory adapter. Keep growing vitest coverage `include` list as each module lands (add src/main/services/** already covered; add core/terminal, then ipc, preload, renderer/store later)."
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
