# Steiner Log — weft

> Reading Steiner: the lab's memory across worldline shifts. Newest leap on top.

## Leap 18 — steiner: divergence-meter-stable — 2026-07-18T00:30:00Z

**Phase**: 3b divergence-meter-reading → christinas-analysis
**Changed**: Closed the last two honest AC gaps found in the audit: (1) window-bounds persist/restore (saved into the workspace blob on quit, applied at createWindow; E2E asserts ±8px across restart — Windows DPI rounds), (2) badge default now `unknown` until a hook actually reports (was `working` — a lie before observation; store + E2E updated). Phase 3b evidence: 17/17 Playwright-Electron E2E across every user story, 4 screenshots (empty/terminal/diff/final) in screenshots/, coverage raised to 98.14% stmts / 97.16% branch / 99.28% funcs (185 tests; function-coverage top-ups for bridge/viewer-store/frame-parser/pty-manager/session-store). All 25 spec ACs checked; AC 11 (real OS toast render/click) noted in Open Questions as the one manual-verification item.
**SERN interference**: none (one wrong test expectation about throttle hot-window fixed)
**Divergence meter**: 98.14% / 97.16% / 99.28% · 185 unit + 17 e2e, 0 fail
**Next target**: Phase 4 — Future Okabe ×3 review (simplicity / correctness+security / test quality), consolidate into review_items, then convergence fixes.

---

## Leap 17 — steiner: feat(tear-off) — 2026-07-17T23:55:00Z

**Phase**: time-leap-development
**Changed**: Tear-off windows (spec §4.2), the last major v1 feature. moveTabToWindow(tabId,'new',{title}) → container opens a second BrowserWindow with ?tearoff=<tabId> (shared createWindow factory now injected into wireApp from index); renderer main.tsx routes to TearOffApp (slim title bar + TerminalPane) — the PTY NEVER moves, the new window just attaches (replay + live). Tab strip gets a ⤢ button (removeTab without closeSession). Closing a torn-off window with the session alive → CH.reDockTab {tabId,title,cwd,command} → main strip re-adds the tab. PtyManager sessions now carry `command` (re-dock/persist need it); __weft.pidOf for E2E. CRITICAL BUG FOUND & FIXED via E2E: a destroyed tear-off window left a dangling attachment; next PTY output threw 'Object has been destroyed' inside main's data callback → blocking error dialog wedged the app (2min E2E hangs). Fix: guarded safeSend auto-detaches dead senders (+2 unit tests), process-level uncaughtException logger, and a 2s hard-exit fallback on quit so ConPTY agents can't zombie the process.
**SERN interference**: the wedge above — diagnosed via instrumented step-debug spec; three-layer fix (guard, logger, hard-exit)
**Divergence meter**: unit 179 pass; e2e 16 pass — tear-off asserts SAME PID pre/post, scrollback replay in the new window, interactivity there, and re-dock with both markers
**Next target**: Phase 3b formal sweep (screenshots + AC audit + check spec boxes), coverage report, then Phase 4 Future Okabe ×3 review.

---

## Leap 16 — steiner: feat(error-state+theme) — 2026-07-17T23:10:00Z

**Phase**: time-leap-development
**Changed**: Spawn-failure AC + theme AC + reduced-motion AC. openProject now resolves an `{error,cwd,title,command}` result instead of rejecting (OpenProjectResult union); claudePath injectable (WEFT_CLAUDE_BIN seam). Renderer: spawn-error banner (role=alert) with Retry (fresh createSession in same cwd) + dismiss; module-level failure listener. Theme: store gains theme/setTheme; document dataset applied; CSS vars for light under [data-theme=light] AND (prefers-color-scheme: light + data-theme=system); status-bar cycle button (system→light→dark); theme persisted via buildWorkspaceState(tabs, theme) and restored on launch. Working badge pulses (weft-pulse), static under prefers-reduced-motion.
**SERN interference**: none
**Divergence meter**: unit 177 pass; e2e 15 pass (missing-binary banner + Retry + dismiss; theme cycle with computed --bg assertion)
**Next target**: tear-off windows (moveTabToWindow 'new' → second BrowserWindow re-attaches SAME PTY, PID unchanged; close → re-dock) — the last major v1 feature. Then Phase 3b formal sweep + spec AC checkboxes + Phase 4 review.

---

## Leap 15 — steiner: feat(tabs-ux) — 2026-07-17T22:45:00Z

**Phase**: time-leap-development
**Changed**: Tab UX + keyboard layer. Pure core/keybindings/keybinding-router (Ctrl+T new / Ctrl+W close / Ctrl+Tab cycle ±Shift / Ctrl+1..9 jump; EVERYTHING else passthrough incl. Ctrl+C/R/D and Alt/Meta/Ctrl+Shift combos; 4 test groups). App: window keydown capture dispatches chords; TerminalPane attachCustomKeyEventHandler keeps reserved chords out of the PTY. Store: moveTab (drag-insert reorder) + cycleTab (wrapping). TabButton: double-click inline rename (Enter/blur commit, Esc cancel), HTML5 drag-and-drop reorder. openProject/closeTab hoisted to module fns.
**SERN interference**: none
**Divergence meter**: unit 174 pass; e2e 13 pass (rename, Ctrl+1/2 jump, Ctrl+W close, passthrough proof, drag reorder)
**Next target**: spawn-error state (claude not on PATH → actionable error + Retry, AC) + OS light/dark theme honor + reduced-motion working-spinner; then tear-off window; then Phase 3b sweep + coverage audit.

---

## Leap 14 — steiner: feat(fs-watching) — 2026-07-17T22:15:00Z

**Phase**: time-leap-development
**Changed**: Live file watching (≤1s explorer reflection AC). WatchService (injectable chokidar factory; add/addDir/change/unlink/unlinkDir → add/change/unlink; unwatch/closeAll; 4 unit tests). register-fs: watchDir (forwards CH.fsChange to the calling sender) + unwatchDir. Container: chokidar (ignoreInitial, node_modules/.git ignored, depth 4) + watchers closed on shutdown. Bridge/WeftBridge: watchDir/unwatchDir/onFsChange. Explorer: watches active root; fs events bump a version that re-lists root AND all open nodes; refactored node fetching so the open-effect owns it (no double fetch). E2E extended: externally created file appears ≤5s, externally deleted file disappears.
**SERN interference**: none
**Divergence meter**: unit 166 pass; e2e 9 pass incl. live add/delete reflection
**Next target**: tab rename (double-click inline edit) + drag-reorder + keybindings (Ctrl+T/W/Tab/1..9 with terminal passthrough via core keybinding-router); then spawn-error state + theme; tear-off; Phase 3b sweep.

---

## Leap 13 — steiner: feat(monaco-viewer) — 2026-07-17T21:50:00Z

**Phase**: time-leap-development
**Changed**: Monaco read-only viewer + "Diff vs HEAD". Main: DiffService (readFileText; getDiff = git ls-files → git show HEAD:<rel> baseline vs current; untracked/non-repo → empty baseline = all-additions view; injectable fs+exec, 4 unit tests). register-fs adds readFileText/getDiff handlers; bridge + WeftBridge extended. Renderer: viewer-store (zustand), monaco-setup (lazy chunk, editor worker only — no LSP in v1), ViewerPane (read-only editor / side-by-side diffEditor, View|Diff toggle, close; overlays terminal area). Explorer: single-click → in-app viewer, double-click → OS default (tests updated). tsconfig.web gains vite/client types for ?worker import.
**SERN interference**: none (one tsconfig types fix)
**Divergence meter**: unit 160 pass; e2e 9 pass incl. real-git diff assertion
**Next target**: chokidar fs watcher (explorer reflects external changes ≤1s, AC) + tab rename/reorder UI + keybindings; then spawn-error state, light theme, tear-off; then Phase 3b sweep.

---

## Leap 12 — steiner: feat(workspace-persistence) — 2026-07-17T21:20:00Z

**Phase**: time-leap-development
**Changed**: Workspace persistence + restore-on-launch. register-workspace IPC (loadWorkspace/saveWorkspace over WorkspaceStore); container wires electron-store + config.bak backup writer. Renderer workspace-sync: buildWorkspaceState (tabs→versioned blob) + restoreWorkspace (respawn fresh session per saved tab, skip failures, preserve order/titles); App restores once on launch (StrictMode-guarded) and saves on every tabs change via zustand subscribe. Tab now carries `command`; openProject response includes it. index.ts honors WEFT_USER_DATA_DIR for isolation. FIXED E2E cross-contamination: every spec now launches with its own mkdtemp userData (status spec was restoring tabs saved by open-project spec) + cleaned the polluted shared dev config.json (removed stray workspace key).
**SERN interference**: E2E cross-test pollution via shared userData once persistence landed — isolated per-launch userData; lesson recorded
**Divergence meter**: unit 155 pass; e2e 8 pass incl. restart-restore
**Next target**: Monaco read-only file viewer + diff (readFileText/getDiff IPC + git-HEAD diff provider + renderer viewer pane), then keybindings, tear-off, Phase 3b full sweep.

---

## Leap 11 — steiner: feat(os-notifications) — 2026-07-17T20:55:00Z

**Phase**: time-leap-development
**Changed**: App-owned OS notifications. NotificationService (pure policy, injected OS I/O): waiting/done while app unfocused → toast ("<project> — needs you"/"— done", hook message as body); click → focusTab; silent when focused; working/error/unknown ignored. Container wires Electron Notification + isFocused check + focusTab (restore/show/focus window + CH.activateTab). New activateTab channel + bridge onActivateTab + App subscription → setActive. register.closeSession now calls onSessionClosed → statusServer.forget(tabId). 7 new unit tests.
**SERN interference**: none
**Divergence meter**: unit 150 pass; e2e 7 pass
**Next target**: workspace persistence IPC (loadWorkspace/saveWorkspace via WorkspaceStore+electron-store) + restore-on-launch (recreate saved tabs' sessions) + E2E restart test; then Monaco read-only+diff; tear-off.

---

## Leap 10 — steiner: feat(status-pipeline) — 2026-07-17T20:40:00Z

**Phase**: time-leap-development
**Changed**: THE DIFFERENTIATOR — hook-driven per-tab status, end-to-end. Core: FrameParser (NDJSON across chunk boundaries + end() flush), statusEndpointPath (named pipe win32 / UDS posix, never TCP), buildHookSettings(Json) (inline --settings registering UserPromptSubmit/Stop/StopFailure/Notification → forwarder command). Main: StatusServer (transport-injectable; bytes→parse→correlate→map→onStatus; dedup; drop+log unknown/malformed; statusOf/forget), hook-forwarder (generates forward.cjs relay + forward.cmd/.sh wrapper; ELECTRON_RUN_AS_NODE scoped INSIDE wrapper; 5s hard timeout so hooks never wedge), NetTransport (node:net on pipe path). PtyManager.tabRefs() (+cwd). register: claude spawns get --settings + WEFT_STATUS_ENDPOINT env. Container wires it all + broadcasts CH.sessionStatus to all windows + __weft E2E introspection global + SHUTDOWN handler (before-quit kills PTYs + stops server — fixed app.close() hang where ConPTY children pinned the process). Renderer App subscribes onSessionStatus/onSessionExit → badges.
**SERN interference**: app.close() hung 60s in E2E (ConPTY children + live pipe held process open) — fixed with before-quit shutdown; 2 unit fixes (NodeJS namespace not in pure core; JSON quote-escaping in assertion)
**Divergence meter**: unit 143 pass; e2e 7 pass incl. real-pipe badge flip waiting→working→done + unknown-session no-op
**Next target**: OS notifications (waiting/done while unfocused → toast → focus window+tab), then workspace persistence IPC + restore-on-launch, Monaco read-only+diff, tear-off.

---

## Leap 9 — steiner: feat(explorer-tree) — 2026-07-17T20:05:00Z

**Phase**: time-leap-development
**Changed**: Renderer Explorer tree (lazy listDir expansion, file→openWithDefault, error/empty states, aria tree roles) wired to active tab cwd. E2E seams: WEFT_E2E_OPEN_DIR (folder-picker bypass) + WEFT_OPEN_PROJECT_COMMAND=shell (no real claude boot in tests) — the ENTIRE open-project UI flow is now automatable. e2e/open-project.spec.ts: click + → tab appears → xterm mounts → typed echo round-trips on screen → explorer lists fixture files + lazy-expands subdir; close tab → empty state. 6 Explorer jsdom tests + register defaultCommand test.
**SERN interference**: none (a log-write shell heredoc hit the Windows python alias and timed out — no repo damage; lesson: use Edit tool for log edits)
**Divergence meter**: unit 117 pass; e2e 5 pass (real Electron)
**Next target**: status pipeline (differentiator): NDJSON frame-parser (core) + named-pipe/UDS StatusServer + inline --settings hook injection at spawn + forward-script via ELECTRON_RUN_AS_NODE + renderer badge wiring + E2E (inject hook payload over the pipe → badge flips to waiting).

---

## Leap 8 — steiner: test(e2e) Playwright-Electron harness — 2026-07-17T19:45:00Z

**Phase**: time-leap-development (Phase 3b harness established early)
**Changed**: Installed @playwright/test 1.61 (no browser download — Electron uses app's own binary). Added playwright.config.ts + e2e/app.spec.ts driving the REAL built Electron app via _electron.launch(). 3 tests, all green: (1) workbench shell renders + window.api exposed under context isolation; (2) a shell session spawns and echoes input through the real preload→IPC→node-pty/ConPTY pipeline; (3) §4.7 — a session SURVIVES a hard renderer reload and re-attach replays its buffered output. test:e2e now builds first (electron-vite build && playwright test). gitignored test-results/playwright-report/.playwright-mcp.
**SERN interference**: none
**Divergence meter**: unit 110 pass; e2e 3 pass (real Electron)
**Next target**: continue Phase 3 features — renderer explorer tree, status server + inline hooks (tab badges), OS notifications, Monaco diff, persistence IPC + restore, tear-off. E2E harness now lets me self-verify each in the real app.

---

## Leap 7 — steiner: chore(native-build) node-pty runs under Electron — 2026-07-17T19:30:00Z

**Phase**: time-leap-development
**Changed**: Resolved the node-pty Electron-ABI build (user installed VS Build Tools). Two Windows blockers fixed: (1) NoDefaultCurrentDirectoryInExePath=1 broke winpty's GetCommitHash.bat — now cleared inside a new scripts/rebuild-native.mjs; (2) SpectreMitigation flag required Spectre VS libs — removed via committed `pnpm patch` (patches/node-pty@1.1.0.patch, changes 'Spectre'→'false' in binding.gyp + winpty.gyp). `electron-rebuild` now completes. Verified with a headless Electron smoke test: node-pty spawned a real ConPTY session and echoed output. blocked_on cleared.
**SERN interference**: none (both build blockers diagnosed + fixed)
**Divergence meter**: 110 pass, 0 fail (unchanged — native build is toolchain, not app logic)
**Next target**: launch pnpm dev + user opens a project to try a live claude session; then renderer explorer tree, status server + inline hooks, notifications, Monaco diff, persistence IPC, tear-off; then Phase 3b (Playwright-Electron).

---

## Leap 6 — steiner: feat(file-explorer-backend) — 2026-07-17T17:27:00Z

**Phase**: time-leap-development
**Changed**: File explorer backend (unblocked by native build). Pure `core/fs/dir-sort` (dirs-first case-insensitive sort + default ignores node_modules/.git). `main/services/FsService.listDir` over injectable FsLike → mapped/sorted DirEntry[] with kinds (dir/file/symlink), ignore-filtering. `main/ipc/register-fs` (listDir/revealInOs/openWithDefault, injected reveal/open). Wired into container (fsPromises + electron shell). Added listDir/revealInOs/openWithDefault to preload bridge + WeftBridge. Fixed tests to use path.join (Windows backslash separators, not hardcoded '/').
**SERN interference**: none (caught Windows path-separator assumption in tests immediately)
**Divergence meter**: 99.83% stmts / 96% branch / 95.18% funcs, 110 pass, 0 fail
**Next target**: renderer Explorer tree (lazy-expand via listDir); then status server + inline hooks, OS notifications, Monaco diff, persistence IPC + restore, tear-off. LIVE verify + Phase 3b still gated on node-pty Electron rebuild (VS Build Tools installing).

---

## Leap 5 — steiner: feat(interactive-terminal) — 2026-07-17T17:18:00Z

**Phase**: time-leap-development
**Changed**: Wired the terminal end-to-end so the app is usable. main/ipc/register.ts (electron-free, injectable ipcMain/pty/pickDirectory): createSession (uuid + claude --session-id + CLAUDE_IDE_TAB env), write/resize (guarded), close, attach (replay snapshot + forward data/exit to the sender), detach, openProject (dir picker → session). main/container.ts composition root (real ipcMain/dialog/NodePtyFactory). preload/create-bridge.ts (testable over injected ipcRenderer) + preload/index.ts glue → window.api. Renderer: session-store (zustand), TerminalPane (xterm + fit, attach-on-mount replay, HMR-safe cleanup that detaches without killing), WorkbenchErrorBoundary (fallback + reload), App wired with tab strip + status glyphs + Open-project. Added openProject channel + WeftApi.openProject + WeftBridge Pick type.
**SERN interference**: none (fixed inline: vitest 'dom' project needed @vitejs/plugin-react for JSX automatic runtime — 'React is not defined' until added)
**Divergence meter**: 99.81% stmts / 95.61% branch / 98.66% funcs, 98 pass, 0 fail; production build OK
**Next target**: node-pty Electron-ABI rebuild (@electron/rebuild) + launch to verify open-project→live-claude-session works (de-risk Phase 3b blocker); then file explorer, status server + inline hooks, OS notifications.

---

## Leap 4 — steiner: feat(pty-manager) — 2026-07-17T17:00:00Z

**Phase**: time-leap-development
**Changed**: Built the session-resilience foundation the user asked for (spec §4.7). Pure core: `terminal/resize-throttle` (leading+trailing Throttle, injected clock/timers — no globals, stays pure), `terminal/output-ring-buffer` (char-bounded raw-output buffer for verbatim replay), `status/session-correlator` (session_id→tabId→cwd routing). `main/services/PtyManager` over an injectable `PtyFactory`: create/write/resize(throttled)/close, per-session ring buffer, `attach`/`detach` (replay snapshot + live subscription; NEVER respawns on reload; detach doesn't kill; only close/exit kills), exit tracking, listener fan-out. `NodePtyFactory` real adapter (lazy `createRequire('node-pty')`, ConPTY). Installed node-pty 1.1.0 (prebuilt binary loads; postinstall copied conpty.dll + OpenConsole.exe). Added attachSession/detachSession to IPC channels + WeftApi contract.
**SERN interference**: none (fixed inline: kept core pure by moving real-timer deps out of core into main `realThrottleDeps`; pnpm approve-builds is interactive-only so added node-pty to onlyBuiltDependencies instead)
**Divergence meter**: 100% stmts / 99.35% branch / 97.87% funcs (built modules), 74 pass, 0 fail
**Next target**: IPC layer (register handlers + preload bridge for session create/write/resize/close/attach/detach + data/exit/status events), then renderer TerminalPane (xterm mount, attach-on-mount replay, HMR-safe cleanup) + workbench error boundary — completing the §4.7 guarantee end-to-end.

---

## Leap 3 — steiner: feat(persistence) — 2026-07-17T16:32:00Z

**Phase**: time-leap-development
**Changed**: Implemented the workspace persistence vertical slice (Beta core + adapter). Pure `core/persistence`: `schema` (zod shapes + WORKSPACE_VERSION + compile-time schema↔API conformance assert), `migrations/` (ordered chain + `v0ToV1` legacy upgrade), `validate.loadWorkspace(raw) -> Result<LoadedWorkspace>` (nullish→default, non-object→err, migrate+validate, migration-throw handling). `main/services/WorkspaceStore` adapter over an injectable `KeyValueStore` + backup fn (writes config.bak before a migrating overwrite; corrupt blob → default + warn). Added `Result` helper test. Fixed TS project-ref path aliases in tsconfig.shared + excluded test files from `tsc -b`.
**SERN interference**: none (fixed two build issues inline: missing @shared/@core paths in shared project; over-strict bidirectional schema type-assert vs version literal)
**Divergence meter**: 100% stmts / 98.83% branch / 100% funcs (built modules), 40 pass, 0 fail
**Next target**: PtyManager with injectable PtyFactory + node-pty native install; then session correlation (--session-id + inline --settings hooks + CLAUDE_IDE_TAB).

---

## Leap 2 — steiner: worldline-beta-selected — 2026-07-17T16:24:00Z

**Phase**: worldline-selection → time-leap-development
**Changed**: Kurisu ×2 proposed Alpha (minimal) vs Beta (clean seams + platform ports + DI). Chose **Beta** (multi-concern app, 95% coverage bar, cross-platform seam, v2 roadmap). Scaffolded electron-vite skeleton: `shared/` contract (result, ipc/channels, ipc/api-contract, status/hook-events), first pure `core/status/status-mapper` + 12 passing tests, minimal main/preload/renderer Electron shell, tsconfig project refs, vitest (projects api, 95%/90% coverage thresholds). `pnpm install` clean, Electron 34 binary downloaded, `pnpm build` compiles all 3 targets, `pnpm test` → 12 pass. Fixed preload path (.mjs under type:module).
**SERN interference**: none (node-pty native install deferred to keep first build green; PtyFactory DI means unit tests never import it)
**Divergence meter**: 12 pass, 0 fail (coverage n/a yet)
**Next target**: Implement core/persistence (migrations + validate) and main/services/workspace-store; then PtyManager with injectable PtyFactory.

---

## Leap 1 — steiner: divergence-analysis — 2026-07-17T16:07:00Z

**Phase**: divergence-analysis
**Changed**: Faris ran market research (confirmed the wedge: hook-driven per-session status + tab-focusing notifications + Windows-first + tear-off shell; competitors scrape output or are Mac-only/worktree-framed). Okabe authored `documents/steiner-spec.md` with 21 machine-checkable acceptance criteria. Spec Quality Gate passed. DOSSIER populated.
**SERN interference**: none
**Divergence meter**: unknown (no code yet)
**Next target**: Worldline Selection — Kurisu ×2 propose Alpha (minimal) vs Beta (clean) architectures; scaffold electron-vite skeleton.

---
