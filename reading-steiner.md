phase: worldline-convergence
leap_count: 19
expansion_cycle: 1
session_id: 2026-07-18T00:30:00Z
prev_head: 67fe8ec6268622c6795427f69a368f49848f840a
original_prompt: "Build Weft — a cross-platform (Windows-first) Electron desktop app with a VS Code-style interface built around browser-style tabs of Claude Code CLI sessions (one tab per project), an integrated file explorer, per-tab Claude session status awareness driven by Claude Code hooks, Monaco read-only+diff viewer, tear-off tabs into separate windows, workspace persistence, and app-owned OS notifications. React+TS+Vite renderer, node-pty terminals via xterm.js, electron-store persistence. Full design at documents/claude-terminal-ide.md."
project_name: "weft"
project_type: web
spec_path: documents/steiner-spec.md
test_cmd: pnpm test
dev_server_port: 5173
coverage_pct: 98
divergence_readings: []
current_focus: "Phase 4 — Future Okabe x3 review: (1) simplicity/elegance, (2) correctness+security, (3) test quality. Spawn three general-purpose agents in parallel with key file contents, consolidate findings into review_items (must_fix with file:line, nice_to_have), commit christina-review, advance to worldline-convergence."
blocked_on: null
last_test_run: "unit 185 pass, 0 fail; e2e 17 pass, 0 fail; coverage 98.14/97.16/99.28"
closed_worldlines: [divergence-analysis, worldline-selection, time-leap-development, divergence-meter-reading]
next_action: "Spawn Future Okabe x3 reviewers over src/ (main services+ipc, core, preload, renderer components/stores) and e2e/. Consolidate into review_items. Then Phase 5 convergence (fix must_fix, keep suite green), Phase 6 checkpoint (README, USAGE full pass, prod-build smoke, lessons_learned, Mayuri), Phase 7 expansion."
sern_interference_count: 0
mayuri_rework_count: 0
decisions:
  - architecture: "BETA worldline — shared/ (pure IPC contract) + core/ (pure logic: status-mapper, reducers, migrations, correlator, throttle) + main/ (thin Electron adapters + platform/ seams for named-pipe vs UDS + DI container) + preload/ (typed bridge) + renderer/ (React+zustand). PTY lives in main, renderer is a view over main's truth. Beta chosen over Alpha for multi-concern app + 95% coverage bar + cross-platform seam + v2 roadmap."
  - testing: "vitest + @vitest/coverage-v8 (95%/90% thresholds), projects api (node + jsdom); business logic pure & tested via injected fakes (FakePty, FakePlatform, fake store); Playwright for Electron E2E; manual ConPTY/TUI verification on Windows"
  - stack: "TypeScript, Electron 34 + electron-vite 3, pnpm, React 19 + Vite 6 renderer, zustand 5, xterm.js 5.5, chokidar 4, electron-store 10, monaco 0.52, dockview 4, zod 3, node-pty (deferred native install)"
review_items:
  must_fix:
    - "reload-respawns-sessions: UI reload re-runs restore and createSession-per-tab, orphaning live PTYs — violates §4.7. Reconcile against main via new listSessions IPC; re-attach live tabs, spawn only missing. E2E: UI reload → same PID, scrollback replayed, tabRefs count 1 (App.tsx:245-266, workspace-sync.ts:46-60)"
    - "double-attach-leak: attachSession overwrites prior handle without detach → duplicated output after reload (register.ts:147-153); detach old handle first + attach→attach unit test"
    - "pty-ops-after-exit-throw: write/resize on exited session throws (resize inside throttle timer → uncaughtException); guard exited in PtyManager.write/resize, surface exitCode in AttachHandle, render exit line on re-attach; E2E exit→error badge (pty-manager.ts:133-139)"
    - "ipc-arg-validation: renderer-supplied cols/rows/data/createSession opts unvalidated → malformed message throws in main; validate + drop at boundary (register.ts:111-117)"
    - "forwarder-untested+null-crash: forward.cjs never executed by any test AND crashes on non-object JSON stdin; fix null-guard + real relay integration test (spawn node forward.cjs against live NetTransport) (hook-forwarder.ts:26-29)"
    - "main-window-assumption: getAllWindows()[0] used for re-dock/toast/bounds — wrong window when main closed with tear-offs open → zombie session; resolve real main window (no tearoff query) (container.ts:66-71,108-115,185)"
    - "status-payload-hardening: payload.message trusted as string → object throws in Notification, huge strings broadcast; string-only + truncate ~500; per-tab toast cooldown (status-server.ts:80-86, notification-service.ts:36-41)"
    - "save-validation-backup: saveWorkspace persists unvalidated blob; corruption fallback loses workspace with NO backup; validate in save, write config.bak before default-fallback (workspace-store.ts:43-46)"
    - "watcher-error-unhandled: chokidar error events have no listener → uncaught exception on Windows junction EPERM; add error handler (watch-service.ts:36-45)"
    - "bounds-clamp: restored windowBounds unclamped (off-screen after monitor change) + zod accepts NaN; clamp to displays + z.int().finite() (index.ts:27-30, schema.ts:16-21)"
  nice_to_have:
    - "frame-parser-buffer-cap: unbounded buffer on newline-less stream; cap ~1MB (frame-parser.ts:16-25)"
    - "uds-perms-unlink: POSIX socket in /tmp world-connectable + never unlinked; chmod 0600 + unlink on close (net-transport.ts, pipe-name.ts)"
    - "readfile-size-guard: viewer loads whole file; stat-cap ~5MB with friendly error (diff-service.ts:27-29)"
    - "git-quotepath: non-ASCII filenames break diff baseline; add -c core.quotepath=false (diff-service.ts:37-48)"
    - "dead-code-sweep: remove renameTab/reorderTabs channels+api, needsMigration, isOk, _prev param on mapHookToStatus; fix depth comment; anchor node_modules regex; addSessionTab helper; safeSend dedupe (multiple files)"
    - "reveal-affordance: revealInOs plumbed but no UI caller; add Reveal button to ViewerPane header (ViewerPane.tsx)"
    - "spawn-failure-store-refactor: module-level mutable spawnFailureListener → move into store (App.tsx:30-31)"
    - "e2e-hardening: strip WEFT_* from inherited env in specs; replace persistence waitForTimeout(500) with store poll; multi-tab+rename+theme restart coverage; correlator path-normalization tests"
  closed: []
max_iterations: 30
push_to_github: false
bypass_playwright: false
sern_no_progress_streak: 0
lessons_learned: ["cycle 1: node-pty Electron rebuild blocked twice on Windows — (a) NoDefaultCurrentDirectoryInExePath=1 breaks winpty GetCommitHash.bat (now unset inside scripts/rebuild-native.mjs), (b) SpectreMitigation flag required Spectre VS libs (removed via committed pnpm patch node-pty@1.1.0). node-pty verified spawning ConPTY under Electron. Rebuild reproducible via pnpm rebuild:native."]
