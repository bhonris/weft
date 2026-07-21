# Weft — Design Document

> **Weft** (working name — the crosswise threads woven across a loom's warp; here, many Claude sessions woven into one workspace). A standalone, open-source desktop app with a VS Code-style interface built around **browser-style tabs of Claude Code CLI sessions** — one tab per project, an integrated file explorer, and per-tab awareness of what each Claude instance is doing.

- **Status:** Finalized — v1 design, ready to build
- **Author:** bunna
- **License:** MIT
- **Created:** 2026-07-17
- **Last updated:** 2026-07-17

> Name is provisional pending an npm / GitHub-org / trademark availability check (tracked as a pre-release task, not a design blocker).

---

## 1. Feature specification

### What we're building
A cross-platform (Windows-first) **Electron desktop app** whose primary surface is a set of **tabs, each running a live, interactive Claude Code (`claude`) CLI session** in its own pseudo-terminal. Alongside the terminals sits a **file explorer** for browsing/opening project files, plus a status bar and tab bar that surface the real-time state of each Claude session.

The goal is to let a power user run **many Claude Code sessions across many projects at once**, seamlessly, in one window — instead of juggling separate terminal windows or VS Code integrated terminals with no cross-session awareness.

### Why
Running several Claude Code sessions today means scattered terminals with no unified view: you can't tell at a glance which session is working, which is blocked waiting on you, and which is finished. Switching context is manual and error-prone. This app makes concurrent multi-project work first-class: every session is a labeled tab with a live status badge, one keystroke away.

### Core value proposition (the "why not just VS Code" answer)
The base — tabbed terminals + file tree — is table stakes. The differentiator is **Claude-Code awareness per tab**: each tab knows whether its session is *working / waiting-on-you / done / errored*, driven by Claude Code's own lifecycle hooks. That is the thing a generic terminal or VS Code's integrated terminal cannot give you without exactly this integration.

### Target user
Built first and foremost **for the author's own workflow** — a power user running many Claude Code sessions across many projects at once — and **open-sourced for anyone with the same need**. There is no broader persona or market to serve: every feature is justified by *"does this make the author's multi-project workflow better?"*, with general usefulness a welcome side effect rather than a design driver.

### Success criteria
Success is **the author's own satisfaction in daily use** — the app is "working" when it's the author's preferred way to run multiple Claude sessions. No formal adoption/retention metrics are tracked; community stars/contributions are a bonus signal, not a goal.

### Alternatives & prior art
*(Seeded with what we already know; the author will run a fuller competitor scan via `/dmail` and record findings here.)*
- **VS Code integrated terminal** — tabs + file tree + splits already exist, but no per-session Claude awareness (the core differentiator).
- **Standalone terminal emulators** (Windows Terminal, Warp, Tabby, WezTerm) — tabbed terminals, but generic: no Claude session state, no project-oriented tab model.
- **Claude Code Remote Control** (`claude.ai/code`) — multi-session monitoring/driving, but browser/cloud- and remote-oriented, not a local desktop IDE.
- **TODO (author, via `/dmail`):** confirm nothing already ships the local, per-project, status-aware tabbed model; capture any close matches and how Weft differs.

---

## 2. Scope & out of scope

### In scope (v1)
- **Open-source** Electron desktop app, Windows 11 first but **cross-platform-clean by design** (macOS/Linux shortly after).
- **Browser-style tab model:** one window with a tab strip where **each tab = a project** (rooted at a working directory), each hosting one `claude` session in a real PTY. **Tear-off:** drag a tab out to give that project its own OS window.
- Add / close / rename / reorder / **tear-off** project tabs; persist tabs, order, and working directories across restarts.
- File explorer panel per active project: browse the tree, watch for changes, reveal/open files.
- Per-tab **Claude status badges** (working / waiting / done / error) driven by Claude Code hooks.
- **Read-only + diff Monaco viewer** — open a file to view it, and review "what Claude changed" as a side-by-side diff without leaving the app.
- Basic session persistence: reopen the app to the previous tabs; optional `claude --continue` per project tab.
- **App-owned notifications** — the app raises its own OS toasts when a session needs attention or finishes, and routes clicks to the right tab/window. Fully self-contained (does not depend on the user's personal `~/.claude` hooks).

### Out of scope (v1) — intentional boundaries
- **Full Monaco code editing** (multi-cursor authoring, per-language IntelliSense/LSP). v1 is view + diff + light edits only; full editing is v2.
- **Multiple Claude sessions per project** — v1 is one session per project tab; running a second session in the same project comes with split panes (v2).
- **Split panes** — deferred to v2. High value here (see UI/UX) but adds layout/focus complexity.
- **Remote / SSH sessions** — local machine only. (Claude Code's own Remote Control already covers remote.)
- **Orchestration / task queues / cross-session automation** — this is a terminal IDE, not an agent control plane.
- **Cost/token analytics dashboards** — nice-to-have, later.
- **Multi-user / cloud sync / accounts** — single local user.
- **Non-Claude workflows** — plain shell tabs may be supported but are not a focus.

---

## 3. User stories

- As a **developer running 5 projects**, I want each project's Claude session in its own labeled tab so that I can switch between them without hunting through windows.
- As a **power user**, I want a tab to visibly change state when its Claude session is *waiting on me*, so that no session sits idle unnoticed.
- As a **developer**, I want to open a project folder in the file explorer and start a Claude session rooted there in one action, so that setup is instant.
- As a **user returning to the app**, I want my previous tabs and working directories restored, so that I can resume where I left off.
- As a **developer**, I want to click a file in the explorer to reveal or open it, so that I can navigate a project while Claude works.
- As a **user**, I want a finished/blocked session to raise an OS notification that focuses the app on the right tab, so that I can multitask away from the app.

---

## 4. Acceptance criteria

- [ ] The app launches on Windows 11 and opens at least one tab.
- [ ] A new tab spawns `claude` in a user-selected directory and renders its **fullscreen TUI** correctly (colors, mouse, resize) inside the embedded terminal.
- [ ] Typing/keyboard/paste/`Ctrl+C` behave correctly in the active terminal; resizing the window resizes the PTY.
- [ ] Tabs can be added, closed, renamed, and reordered; closing a tab terminates its PTY cleanly.
- [ ] Each Claude tab shows a live status badge that transitions **working → waiting/done** based on real session events (not output scraping).
- [ ] Closing and reopening the app restores the prior tabs and their working directories.
- [ ] The file explorer lists a project directory, reflects external file changes within ~1s, and can reveal/open a file.
- [ ] A session that needs input or finishes raises an OS notification that, when clicked, focuses the app and activates that session's tab.
- [ ] All of the above is covered by tests meeting the project's 95%+ coverage bar (per global conventions), with the ConPTY/TUI rendering verified manually on Windows.

---

## 5. Architecture & technical design

### High-level
Standard Electron two-process split, with the renderer written as a normal web app:

```
┌─────────────────────────────────────────────────────────────┐
│ Main process (Node)                                           │
│  • Window / menu / tray / OS notifications                    │
│  • PTY manager (node-pty): one pty per tab                    │
│  • Filesystem service + chokidar watcher                      │
│  • Config/persistence store (electron-store)                  │
│  • Status server: local named-pipe endpoint that Claude       │
│    hooks report to; maps events → tab status                  │
└───────────────▲───────────────────────────────┬──────────────┘
                │  typed IPC (preload bridge)     │ pty data / status
┌───────────────┴───────────────────────────────▼──────────────┐
│ Renderer (React + TS + Vite)                                  │
│  • Tab bar + status badges       • File explorer tree         │
│  • Terminal panes (xterm.js)     • Status bar                 │
│  • Zustand store (UI + session state)                         │
└───────────────────────────────────────────────────────────────┘
```

- **Security posture:** `contextIsolation: true`, `nodeIntegration: false`. The renderer touches Node capabilities only through a minimal, typed **preload bridge** (`window.api`).
- **State:** UI/session state in the renderer (Zustand); authoritative PTY/session lifecycle in main. Renderer is a view over main's truth.

### Window & tab model (browser-style + tear-off)
- The default is a **single `BrowserWindow`** with a **tab strip; one tab per project**. Each tab owns a working directory, one `claude` PTY, its file-explorer root, and a Monaco view area.
- **Tear-off:** dragging a tab out (or a menu action) **promotes that project into its own `BrowserWindow`**, and dragging it back re-docks it — the browser mental model. Main owns a `WindowManager` tracking which project lives in which window; a project (its PTY + state) migrates between windows without restarting the session.
- The **PTY lives in the main process** regardless of which window shows it, so tearing off/re-docking never kills the `claude` session — the renderer just re-attaches its xterm to the same PTY stream.
- v1 = **one `claude` session per project tab**. Multiple sessions in a single project arrive with split panes (v2), each split attaching to its own PTY.

### Terminal pipeline
- `node-pty` spawns the process (`claude` or a shell) with a chosen `cwd` and environment. On Windows this uses **ConPTY**.
- PTY `data` → IPC → `xterm.js` `write()`. xterm keystrokes → IPC → `pty.write()`.
- Resize: xterm `fit` addon computes cols/rows → IPC → `pty.resize()`.
- Renderer uses the `webgl` addon for throughput; main applies flow control (pause reads when the renderer's buffer is backed up).

### Tab ↔ Claude session identity & status (the key integration)
Goal: know each tab's Claude state **without scraping terminal output**. Mechanism **verified against current Claude Code** (CLI flags + hook payloads).

1. When the app spawns a project tab, it **generates a UUID and launches `claude --session-id <uuid>`**, mapping `uuid → tab` in the main process. This is the primary, deterministic correlation key — every hook payload carries `session_id`.
2. It passes its reporting hooks via **`--settings '<inline JSON>'`**, which is **session-only** and **merges** with (never overwrites) the user's `~/.claude/settings.json`. No personal config is touched. Hooks are registered on `UserPromptSubmit`, `Notification`, and `Stop`.
3. It also sets **`CLAUDE_IDE_TAB=<tabId>`** in the PTY environment as a redundant identifier (hooks inherit the spawned env — confirmed).
4. Each hook command forwards its stdin JSON to the app's **local status endpoint** (Windows **named pipe** ↔ POSIX **Unix domain socket** behind one interface — never a TCP port): `session_id`, `cwd`, event name, and for `Notification` the `notification_type` + `message`.
5. The main-process status server maps events → status:
   - `UserPromptSubmit` → **working**
   - `Notification` with `notification_type ∈ {permission_prompt, idle_prompt, agent_needs_input}` → **waiting** (blocked on you) + surface `message`
   - `Notification` with `notification_type = agent_completed`, or `Stop` → **done**
   - pty exit (non-zero) → **error**
6. Renderer badges the tab and, if the app/window is unfocused, raises an OS notification that activates the right window + tab on click.

Fallback if the endpoint is unavailable: status shows **unknown**; the terminal still works fully.

> Hooks are **observation-only** (they can't gate Claude) — exactly right here, since we only read state. This supersedes the personal `~/.claude/notify/*` prototype: it reports to the app instead of firing standalone toasts, and correlates by the pinned `session_id` (exact) rather than by guessing window handles.

### File explorer
- Main exposes `readdir`/`stat`/`reveal`/`open` over IPC; a `chokidar` watcher per opened root emits debounced change events.
- Renderer renders a virtualized tree; large directories load lazily on expand.

---

## 6. API contract (IPC + local status endpoint)

There is no HTTP server. "API" here means the **preload IPC bridge** and the **local hook-reporting endpoint**.

### Preload bridge (`window.api`), typed
```ts
// Terminal / session
createSession(opts: { cwd: string; command: 'claude' | 'shell'; args?: string[] }): Promise<{ tabId: string }>
writeToSession(tabId: string, data: string): void
resizeSession(tabId: string, cols: number, rows: number): void
closeSession(tabId: string): Promise<void>
onSessionData(cb: (e: { tabId: string; data: string }) => void): Unsubscribe
onSessionExit(cb: (e: { tabId: string; exitCode: number }) => void): Unsubscribe
onSessionStatus(cb: (e: { tabId: string; status: SessionStatus; message?: string }) => void): Unsubscribe

// Filesystem
listDir(path: string): Promise<DirEntry[]>
watchDir(path: string): Promise<{ watchId: string }>
onFsChange(cb: (e: { watchId: string; type: 'add'|'change'|'unlink'; path: string }) => void): Unsubscribe
revealInOs(path: string): Promise<void>
openWithDefault(path: string): Promise<void>

// Persistence
loadWorkspace(): Promise<WorkspaceState>
saveWorkspace(state: WorkspaceState): Promise<void>

// Types
type SessionStatus = 'working' | 'waiting' | 'done' | 'error' | 'unknown'

interface DirEntry {
  name: string
  path: string
  kind: 'file' | 'dir' | 'symlink'
}

interface TabState {
  tabId: string          // app-side id
  sessionId: string      // pinned via `claude --session-id`
  title: string
  cwd: string
  command: 'claude' | 'shell'
  windowId: string       // which BrowserWindow currently hosts it (tear-off)
}

interface WorkspaceState {
  version: number        // schema version, for migrations
  tabs: TabState[]
  tabOrder: string[]     // tabId order in the strip
  explorerRoots: string[]
  theme: 'system' | 'light' | 'dark'
}
```

### Local status endpoint (named pipe / UDS)
- Transport: Windows named pipe `\\.\pipe\claude-ide-<uuid>` (Unix: `$XDG_RUNTIME_DIR/claude-ide.sock`). No network socket.
- Message (newline-delimited JSON) — the hook forwards its stdin payload plus the event name:
```json
{ "event": "UserPromptSubmit|Notification|Stop",
  "session_id": "…",            // primary key → tab (pinned via --session-id)
  "cwd": "…",
  "notification_type": "permission_prompt|idle_prompt|agent_needs_input|agent_completed",  // Notification only
  "message": "…",               // Notification only
  "tabId": "…" }                // redundant, from $CLAUDE_IDE_TAB
```
- Server resolves the tab by `session_id` (falling back to `tabId`); unknown/malformed messages are dropped and logged.

---

## 7. Database changes

No relational database in v1. Local persistence only:

- **`electron-store`** (JSON on disk) holds: window bounds, theme, tab layout (`[{ tabId, title, cwd, command }]`), file-explorer roots, and a schema `version` for migrations.
- **Optional (v2+):** `better-sqlite3` if we later track per-session history/cost metrics. Not needed now.
- **Schema versioning:** every persisted blob carries a `version`; a migration step runs on load to upgrade older shapes (see Migration & rollback).

---

## 8. UI/UX considerations

### Layout (browser-style tabs, one per project)
```
┌──────────────────────────────────────────────────────────────┐
│ [proj-a ●working] [proj-b ‖waiting] [proj-c ✓ ⤢]  [+]         │  ← project tab strip
├───┬───────────────┬──────────────────────────────────────────┤     (⤢ = tear-off)
│ A │  EXPLORER      │        xterm.js terminal (active proj)    │
│ c │  ▸ src/        │        running `claude` fullscreen TUI    │
│ t │  ▸ tests/      │  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│ i │    README.md   │        Monaco (optional): file view /     │
│ v │                │        side-by-side diff of Claude edits  │
├───┴───────────────┴──────────────────────────────────────────┤
│ status bar:  cwd · git branch · session status · notifs        │
└──────────────────────────────────────────────────────────────┘
tearing a tab off  →  same layout in its own OS window
```

- **Tabs = projects, browser-style:** click to switch, `+` opens a project, drag to reorder, **drag out to tear off** into a separate window (⤢), drag back to re-dock.
- **Diff-on-demand:** when Claude edits files, the status bar / tab surfaces a "review changes" affordance that opens the Monaco diff pane for that project.
- **Tab badges:** working (spinner/●), waiting (‖ + accent color), done (✓), error (✕). Color-coded and shape-coded for accessibility (don't rely on color alone).
- **States:** loading (pty starting), empty (no tabs → "Open a project" CTA), error (pty failed to spawn / `claude` not found → actionable message with a "retry" and a link to install/PATH help).
- **Theme:** dark default; honor OS light/dark; respect reduced-motion (badge spinners become static).
- **Accessibility:** keyboard-navigable tabs and tree; screen-reader labels on badges; sufficient contrast; focus rings.
- **Keyboard:** `Ctrl+T` new tab, `Ctrl+W` close tab, `Ctrl+Tab` cycle, `Ctrl+1..9` jump to tab — but ensure terminal-bound keys (`Ctrl+C`, arrows) reach the PTY; app shortcuts use a chord/modifier that won't collide.

---

## 9. Security considerations

- **Renderer isolation:** `contextIsolation` on, `nodeIntegration` off, `sandbox` where feasible; expose only the minimal typed bridge — no raw `fs`/`child_process` in the renderer.
- **Arbitrary code execution is inherent** to a terminal; the app runs `claude`/shells at the **user's own privilege level** and adds no privilege escalation. Document this clearly.
- **Local status endpoint is local-only** (named pipe / UDS), never a TCP port; validate every message and bind `tabId` to known tabs to prevent spoofed status from other processes.
- **No secrets in logs/persistence:** never persist terminal scrollback to disk by default; if scrollback export is added, make it explicit and redact env.
- **Settings injection:** the app-managed settings file used to register reporting hooks must be written to an app-owned path and not clobber the user's own `~/.claude/settings.json`.
- **Auto-update integrity:** signed releases; verify update signatures (electron-updater).
- **CSP** for the renderer even though it's local (defense in depth); disallow remote content loading.

---

## 10. Performance considerations

- **Throughput:** xterm `webgl` renderer; batch/coalesce PTY writes; main-side flow control to pause a firehose pty when the renderer is behind.
- **Many tabs:** keep PTYs alive for all tabs but only mount the active xterm; inactive tabs retain a lightweight buffer (serialize addon) and rehydrate on activation. Cap live scrollback (e.g., 5–10k lines/tab).
- **File watching:** debounce chokidar (e.g., 100–200ms), ignore `node_modules`/`.git` by default, lazy-load tree nodes.
- **Startup:** lazy-init non-active tabs' terminals; restore layout first, spawn PTYs on demand.
- **Memory target:** define an acceptable ceiling for N=10 tabs during the spike and measure.

---

## 11. Edge cases & error handling

- **ConPTY quirks** (resize glitches, mouse reporting, fullscreen redraw) — the primary risk; validate in the spike.
- **`claude` not on PATH / wrong version** — detect at spawn, show actionable error, don't crash the tab.
- **PTY exits unexpectedly** (crash, `exit`) — mark tab **error/closed**, show exit code, offer restart in same cwd.
- **Working directory deleted/renamed while open** — surface a warning; disable file-tree ops for that root.
- **Status endpoint down / hook not firing** — degrade to **unknown** status; never block the terminal.
- **Claude Code TUI/behavior changes across versions** — since we embed the real CLI, pin nothing but test against current; the status pipeline depends on hook event names staying stable.
- **Resize storms** while dragging — throttle resize → pty.resize.
- **Huge single-line output / binary spew** — guard xterm against pathological input; cap line length.
- **Multiple app windows / duplicate tab of same session** — decide single-window vs multi-window (open question); avoid two PTYs claiming one `tabId`.
- **Notification click when app closed** — relaunch and route to the tab, or no-op gracefully.

---

## 12. Testing strategy

Per global conventions: tests for every feature/bugfix, **95%+ coverage before commit**, regression test for every bug.

- **Unit:** session/tab state reducer; IPC handlers (mock pty); hook status-message parser; config-store migrations; keybinding router.
- **Integration:** spawn a fake PTY (e.g., an `echo`/scripted process) and assert data round-trips through IPC to a headless xterm; chokidar → `onFsChange` events; status endpoint receives a simulated hook message → correct tab status transition.
- **E2E:** **Playwright for Electron** — launch app, open a tab, run a command, assert output; add/close/reorder tabs; restore-on-restart.
- **Manual (Windows, required):** the fullscreen `claude` TUI in an embedded terminal — rendering, mouse, resize, paste, `Ctrl+C`. This is the spike's exit criterion and can't be fully automated.
- **Mocks/fixtures:** fake-pty harness, sample project tree fixture, canned hook payloads.

---

## 13. Dependencies

Package manager: **pnpm** (per global conventions). Renderer: React + TS + **Vite**.

- **Shell/build:** `electron`, `electron-vite`, `electron-builder`, `typescript`, `vite`, `react`, `react-dom`.
- **Terminal:** `@xterm/xterm` + addons `@xterm/addon-fit`, `@xterm/addon-webgl`, `@xterm/addon-search`, `@xterm/addon-web-links`, `@xterm/addon-unicode11`, `@xterm/addon-serialize`.
- **PTY:** `node-pty` — **native module**; must be rebuilt for Electron's ABI (`electron-rebuild` / prebuilt binaries). Known setup gotcha; validate early.
- **Filesystem:** `chokidar`.
- **Persistence:** `electron-store` (+ `better-sqlite3` later, optional).
- **State:** `zustand`.
- **Editor/diff:** `monaco-editor` (+ `@monaco-editor/react`) — read-only viewer + diff editor in v1.
- **Layout / tabs / tear-off:** `dockview` (supports tabbed groups, floating/torn-off panels, and splits) — covers the browser-style tab strip + tear-off now and split panes in v2.
- **Testing:** `vitest`, `@playwright/test` (Electron support), coverage via `@vitest/coverage-v8`.
- **External prerequisite:** a working `claude` CLI on the user's PATH (Windows 10+ for ConPTY).

---

## 14. Migration & rollback plan

- **Greenfield** — no data migration from an existing system.
- **Config schema migrations:** `electron-store` blobs are versioned; a migration chain upgrades old layouts on load. Back up the prior config file before migrating so a failed upgrade can restore.
- **Distribution:** `electron-builder` + `electron-updater` with signed releases; staged/opt-in channel for risky versions.
- **Rollback:** users can reinstall the previous signed release; config migrations are backward-tolerant (never destructively rewrite without a backup). Feature-flag the status-endpoint/hook injection so it can be disabled if a Claude Code update breaks it, degrading to a plain tabbed terminal.

---

## 15. Decisions & remaining validation

All design questions are **resolved**. What remains is empirical validation and pre-release chores — not open design choices.

### Resolved decisions
- **Hook/session injection** → launch `claude --session-id <uuid>` (deterministic tab correlation) + `--settings '<inline JSON>'` (session-only, merges, never touches personal config) to register observation-only reporting hooks; `CLAUDE_IDE_TAB` env as redundant key. **Verified against current Claude Code.** *(§5, §6)*
- **Window model** → browser-style, **one tab per project**, with **tear-off** into separate OS windows. *(§5, §8)*
- **Editor scope** → **Monaco read-only + diff in v1**; full authoring/LSP is v2. *(§2)*
- **Splits** → **v2** (real value as a live multi-session dashboard, but layout complexity). *(§8)*
- **Notifications** → **app-owned**, self-contained; retires the standalone `~/.claude/notify/*` hooks for the app's sessions. *(§2, §16)*
- **Cross-platform** → **Windows-first but cross-platform-clean from day one** (platform abstractions for ConPTY and the status endpoint). *(§17)*
- **Sessions per project** → **one in v1**; multiple via splits in v2. *(§5)*
- **License** → **MIT** (simplest, most common for developer tooling; permissive and contribution-friendly). *(§17)*
- **Name** → **Weft** (provisional). *(header)*

### Remaining validation (not design blockers)
- **ConPTY/TUI spike** — confirm Claude Code's fullscreen TUI renders/behaves in `xterm.js` via ConPTY on Windows 11. Expected to pass (VS Code ships this exact stack); it's the Phase-0 exit criterion. *(§16)*
- **Name availability** — npm / GitHub org / trademark check for "Weft" before public release. *(header)*
- **Dependency license audit** — before first release. *(§17)*

---

## 16. Todo list

### Phase 0 — De-risk (spike)
- [ ] Electron + React + Vite skeleton (`electron-vite`), `contextIsolation` on, preload bridge stub.
- [ ] `node-pty` integrated and rebuilt for Electron on Windows.
- [ ] Spawn `claude` in one xterm.js pane; **verify fullscreen TUI, mouse, resize, paste, Ctrl+C on Windows 11**.
- [ ] Decide go/no-go on the embedding approach based on the spike.

### Phase 1 — Core terminal IDE (MVP)
- [ ] Browser-style tab strip (dockview): one tab per project; add / close / rename / reorder.
- [ ] **Tear-off** a tab into its own window + re-dock; PTY stays in main and survives the move.
- [ ] PTY ↔ xterm data + resize pipeline with flow control.
- [ ] File explorer per project: tree + chokidar watch + reveal/open.
- [ ] Monaco **read-only viewer + diff** ("review Claude's changes").
- [ ] Workspace persistence (electron-store) + restore-on-launch.
- [ ] Keybindings + copy/paste + terminal-key passthrough.
- [ ] Packaging (electron-builder) for Windows.

### Phase 2 — Claude awareness
- [ ] Implement session correlation: `--session-id <uuid>` + `--settings` inline hooks + `CLAUDE_IDE_TAB` (mechanism verified — see §5).
- [ ] Local status endpoint (named pipe ↔ UDS) receiving forwarded hook payloads; resolve tab by `session_id`.
- [ ] Per-tab status badges + status bar.
- [ ] **App-owned OS notifications** that focus the app + activate the right tab/window (replaces the standalone `~/.claude/notify/*` toasts).

### Phase 3 — Polish / v2 candidates
- [ ] Split panes (dockview) → multiple Claude sessions visible per project.
- [ ] `claude --continue` session resume per tab.
- [ ] Full Monaco editing + per-language intelligence (LSP).
- [ ] Cost/token metrics (optional SQLite).
- [ ] Logging / observability — structured logs, crash capture, and a "copy diagnostics" action for OSS bug reports.
- [ ] Polished macOS/Linux builds.

### Cross-cutting
- [ ] Test suite to 95%+ coverage (unit + integration + Playwright-Electron E2E).
- [ ] Open-source hygiene: LICENSE, README, CONTRIBUTING, CI, no hardcoded personal paths.
- [ ] `CLAUDE.md` for the project (run `/init` once code exists).

---

## 17. Open-source & distribution considerations

This ships as a public, open-source project, which shapes several design constraints:

- **Zero personal state.** Nothing may hardcode a user's paths, session ids, or machine specifics. The current `~/.claude/notify/*` prototype (with literal `C:\Users\bunna\...` paths and a hand-edited global `settings.json`) is a personal spike, **not** a template — the app must generate all Claude hook/notification config **at runtime** into an app-owned location and configure each `claude` session itself (e.g. via its own settings file / flags), never asking users to edit their personal `~/.claude`.
- **Cross-platform-clean from day one.** Windows is the first target, but the platform-specific pieces are isolated behind interfaces so macOS/Linux are a fill-in, not a rewrite:
  - Terminal host: ConPTY (Windows) — `node-pty`/`xterm` are already cross-platform.
  - Status endpoint: **named pipe on Windows ↔ Unix domain socket on POSIX** behind one transport interface.
  - OS notifications and window/taskbar focus behaviors abstracted per platform.
- **Licensing:** **MIT** (decided). Audit transitive dependency licenses before release.
- **Trust & safety in the README:** be explicit that this runs `claude` and shells at the user's own privilege level and injects Claude Code hooks it manages — no telemetry, no network endpoints beyond what Claude Code itself does.
- **Distribution:** signed release builds via `electron-builder` (+ `electron-updater`) for convenience, plus a documented **build-from-source** path so the community can verify and contribute. No proprietary assets or secrets in the repo.
- **Contribution surface:** `CONTRIBUTING.md`, CI (lint + typecheck + test + coverage gate), issue/PR templates, and a clear module boundary between the platform-abstraction layer and the UI so contributors can add OS support safely.
