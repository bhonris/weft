# Steiner Log — weft

> Reading Steiner: the lab's memory across worldline shifts. Newest leap on top.

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
