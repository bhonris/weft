phase: time-leap-development
leap_count: 25
expansion_cycle: 3
session_id: 2026-07-18T00:30:00Z
prev_head: ee0830bc080ef0450447379aa77f7ec5f2162240
original_prompt: "Build Weft — a cross-platform (Windows-first) Electron desktop app with a VS Code-style interface built around browser-style tabs of Claude Code CLI sessions (one tab per project), an integrated file explorer, per-tab Claude session status awareness driven by Claude Code hooks, Monaco read-only+diff viewer, tear-off tabs into separate windows, workspace persistence, and app-owned OS notifications. React+TS+Vite renderer, node-pty terminals via xterm.js, electron-store persistence. Full design at documents/claude-terminal-ide.md."
project_name: "weft"
project_type: web
spec_path: documents/steiner-spec.md
test_cmd: pnpm test
dev_server_port: 5173
coverage_pct: 98
divergence_readings: []
current_focus: "Expansion 2 leap A — hardening sweep: frame-parser 1MB cap, POSIX socket perms+unlink, 5MB readFile/getDiff guard + viewer error, git quotepath, dead-code sweep (renameTab/reorderTabs channels+api, needsMigration, isOk, _prev param, regex anchor, depth comment), ViewerPane Reveal button, spawn-failure state into store, E2E hygiene (strip WEFT_* env, poll instead of sleep). Then leap B: Shift+Click + opens SHELL tab (UI+E2E) and Ctrl+Shift+F terminal search (xterm search addon, search bar UI, E2E)."
blocked_on: null
last_test_run: "unit 212 pass, 0 fail; e2e 19 pass, 0 fail; coverage 97.96/96.25/98.64"
closed_worldlines: [divergence-analysis, worldline-selection, time-leap-development, divergence-meter-reading]
next_action: "Implement hardening sweep items with tests, keep suite green, commit; then shell-tab + terminal-search leap with E2E; then cycle-2 checkpoint (docs refresh + counters) and Okabe budget check (EL_PSY_KONGROO expected near 27/30)."
sern_interference_count: 0
mayuri_rework_count: 0
decisions:
  - architecture: "BETA worldline — shared/ (pure IPC contract) + core/ (pure logic: status-mapper, reducers, migrations, correlator, throttle) + main/ (thin Electron adapters + platform/ seams for named-pipe vs UDS + DI container) + preload/ (typed bridge) + renderer/ (React+zustand). PTY lives in main, renderer is a view over main's truth. Beta chosen over Alpha for multi-concern app + 95% coverage bar + cross-platform seam + v2 roadmap."
  - testing: "vitest + @vitest/coverage-v8 (95%/90% thresholds), projects api (node + jsdom); business logic pure & tested via injected fakes (FakePty, FakePlatform, fake store); Playwright for Electron E2E; manual ConPTY/TUI verification on Windows"
  - stack: "TypeScript, Electron 34 + electron-vite 3, pnpm, React 19 + Vite 6 renderer, zustand 5, xterm.js 5.5, chokidar 4, electron-store 10, monaco 0.52, dockview 4, zod 3, node-pty (deferred native install)"
review_items:
  must_fix: []
  nice_to_have: []
  closed:
    - "frame-parser-buffer-cap: fixed (1MB cap + recovery test)"
    - "uds-perms-unlink: fixed (chmod 0600 + unlink on close)"
    - "readfile-size-guard: fixed (5MB stat guard + viewer error)"
    - "git-quotepath: fixed (-c core.quotepath=false)"
    - "dead-code-sweep: fixed (channels/api/needsMigration/isOk/_prev removed; regex+comment fixed; addSessionTab; dropAttachment)"
    - "reveal-affordance: fixed (ViewerPane Reveal button)"
    - "spawn-failure-store-refactor: fixed (zustand store state)"
    - "e2e-hardening: fixed (launchWeft strips WEFT_*, config.json poll, multi-tab/rename/theme restart E2E, correlator normalization)"
    - "reload-respawns-sessions: fixed — listSessions IPC + reconcile/adopt restore; E2E real-reload same-PID proof"
    - "double-attach-leak: fixed — detach-before-overwrite + unit test"
    - "pty-ops-after-exit-throw: fixed — exit guards + throttle-timer try/catch + exit surfaced in attach; E2E error badge"
    - "ipc-arg-validation: fixed — createSession shape check, write/resize sanity checks"
    - "forwarder-untested+null-crash: fixed — stdin guard + 3-scenario real-process/real-pipe integration test"
    - "main-window-assumption: fixed — getMainWindow() + main-window revival on orphaned re-dock"
    - "status-payload-hardening: fixed — message string/truncate + 10s per-tab toast cooldown"
    - "save-validation-backup: fixed — schema-validated saves + config.bak on corruption fallback"
    - "watcher-error-unhandled: fixed — error listener with onError dep"
    - "bounds-clamp: fixed — pure clampBoundsToDisplays + z.int() schema"
max_iterations: 30
push_to_github: false
bypass_playwright: false
sern_no_progress_streak: 0
lessons_learned: ["cycle 1: node-pty Electron rebuild blocked twice on Windows — (a) NoDefaultCurrentDirectoryInExePath=1 breaks winpty GetCommitHash.bat (now unset inside scripts/rebuild-native.mjs), (b) SpectreMitigation flag required Spectre VS libs (removed via committed pnpm patch node-pty@1.1.0). node-pty verified spawning ConPTY under Electron. Rebuild reproducible via pnpm rebuild:native.", "cycle 1: api-level E2E can mask product-path bugs — the reload test drove window.api directly and hid that the REAL React restore flow respawned sessions; always E2E the actual UI path for core guarantees. Destroyed-webContents sends throw inside PTY callbacks and wedge main via modal — guard every main→renderer send. ConPTY children pin process exit — hard-exit fallback after graceful shutdown. What worked: pure-core + injected fakes kept 200+ tests fast; adversarial 3-reviewer pass found a critical product bug that 98% coverage missed."]
