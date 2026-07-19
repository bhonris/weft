# Weft — Feature Specification (Steiner)

> **Codename Steiner** — the ability to perceive the true state across every worldline. Here: perceive the true state of every Claude Code session, woven into one workspace. This document refines `design-doc.md` into an implementation-ready specification with machine-checkable acceptance criteria.

- **Status:** Ready to build (v1)
- **Author:** bunna (Hououin Kyouma, Future Gadget Lab)
- **License:** MIT
- **Created:** 2026-07-17
- **Last updated:** 2026-07-17
- **Supersedes:** the acceptance criteria and API stubs in `design-doc.md` §4/§6 (this document is authoritative for build sign-off)

---

## 1. Feature description & purpose

**Weft** is a cross-platform (Windows-first), open-source **Electron desktop app**: a VS Code-style shell wrapped around **browser-style tabs of Claude Code CLI sessions**. Each tab is one project rooted at a working directory, and each hosts a **live, interactive `claude` CLI session** in its own pseudo-terminal (`node-pty` + `xterm.js`). Around the terminals sit an integrated file explorer, a Monaco read-only/diff viewer, a tab strip with live status badges, and a status bar.

The purpose is to let a power user run **many Claude Code sessions across many projects at once** in a single coherent workspace — with tear-off tabs into separate OS windows, workspace persistence, and, critically, **per-tab awareness of what each Claude session is doing**.

### The differentiation wedge (Faris NyanNyan / Cheshire Break market research)

The base — tabbed terminals plus a file tree — is table stakes. The **unoccupied wedge** Weft owns is the combination of:

1. **Hook-driven per-session AI status** — working / waiting-on-you / done / error derived from **Claude Code's own lifecycle hooks**, never from scraping terminal output.
2. **Tab-focusing OS notifications** — app-owned toasts that, on click, focus the exact window and activate the exact tab that needs attention.
3. **Windows-first** — a first-class Windows 11 experience (ConPTY), where most competitors are Mac-only or Windows-hostile.
4. **Tear-off VS Code shell** — one-tab-per-project with drag-out-to-window and re-dock.

Competitors miss this: Conductor is Mac-only; Crystal, Claude Squad, and the many GitHub wrappers scrape output for status; vibe-kanban is defunct; several are worktree/kanban-framed rather than one-tab-per-project; most are single-window; many skip Windows entirely. **Weft leads on the status/notification UX.**

The **#1 user pain** Weft targets: *"which of my N sessions needs me right now?"* — answered directly by hook-driven `waiting`/`done` status plus a notification that focuses the correct tab.

---

## 2. Scope

### In scope (v1)

- Open-source Electron desktop app; Windows 11 first, cross-platform-clean by design (macOS/Linux behind platform interfaces).
- **Browser-style tab model:** one window, a tab strip, **one tab = one project** (rooted at a cwd), each hosting one `claude` PTY session.
- Tab lifecycle: **create, close, rename, reorder**.
- **Tear-off:** drag a tab out into its own `BrowserWindow`; re-dock by dragging back. The PTY survives the move (it lives in main).
- Per-tab **Claude status badges** (working / waiting / done / error / unknown) driven by Claude Code hooks.
- **File explorer** per active project: browse tree, watch for external changes (chokidar), reveal/open files.
- **Monaco read-only viewer + side-by-side diff** ("review what Claude changed").
- **Workspace persistence** (electron-store): tabs, order, cwds, explorer roots, theme, window bounds — restored on launch.
- **App-owned OS notifications** that focus the right window + tab on click; self-contained (does not depend on the user's personal `~/.claude` hooks).
- Terminal I/O correctness: keyboard, paste, `Ctrl+C`, mouse, resize, fullscreen TUI rendering.

### Explicitly out of scope (v2+)

- **Full Monaco code editing / LSP / IntelliSense** — v1 is view + diff only.
- **Multiple Claude sessions per project** — v1 is exactly one session per tab.
- **Split panes** — deferred (arrives with multi-session-per-project).
- **Remote / SSH sessions** — local machine only.
- **Orchestration / task queues / cross-session automation** — Weft is a terminal IDE, not an agent control plane.
- **Cost / token analytics dashboards.**
- **Multi-user / cloud sync / accounts** — single local user, no backend.

---

## 3. User stories

- As a **developer running 5 projects**, I want each project's Claude session in its own labeled tab, so that I can switch between them without hunting through OS windows.
- As a **power user**, I want a tab's badge to change the instant its Claude session is *waiting on me*, so that no session sits blocked unnoticed.
- As a **developer**, I want to pick a project folder and start a Claude session rooted there in one action, so that setup is instant.
- As a **user returning to the app**, I want my previous tabs, order, and working directories restored, so that I can resume where I left off.
- As a **developer**, I want to click a file in the explorer to reveal or open it, so that I can navigate a project while Claude works.
- As a **reviewer**, I want to open a side-by-side diff of the files Claude changed, so that I can review edits without leaving the app.
- As a **multitasker**, I want a finished or blocked session to raise an OS notification that focuses the right tab when clicked, so that I can work elsewhere and be pulled back precisely.
- As a **user who tears a tab into its own window**, I want the Claude session to keep running uninterrupted, so that reorganizing my workspace never restarts work.
- As a **privacy-conscious user**, I want the status channel to be a local-only named pipe/socket with no network port, so that no other machine can read or spoof my session state.

---

## 4. Architecture & technical design

### 4.1 Electron two-process split

```
┌─────────────────────────────────────────────────────────────┐
│ Main process (Node / TypeScript)                             │
│  • WindowManager: BrowserWindows, tear-off, re-dock          │
│  • PtyManager (node-pty): one PTY per tab — SOURCE OF TRUTH   │
│  • FsService + chokidar watchers (one per explorer root)     │
│  • WorkspaceStore (electron-store): persistence + migrations │
│  • StatusServer: named pipe / UDS; maps hook events → status │
│  • NotificationService: OS toasts + focus routing            │
│  • Menu / tray                                                │
└───────────────▲──────────────────────────────┬──────────────┘
                │ typed IPC (preload window.api) │ pty data / status / fs
┌───────────────┴──────────────────────────────▼──────────────┐
│ Renderer (React + TypeScript + Vite)                         │
│  • dockview tab strip + status badges                        │
│  • xterm.js terminal panes (fit/webgl/search/serialize)      │
│  • File explorer tree (virtualized)                          │
│  • Monaco read-only + diff pane                              │
│  • Zustand store (UI + mirrored session state)              │
│  • Status bar                                                 │
└──────────────────────────────────────────────────────────────┘
```

- **Security posture:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox` where feasible. The renderer reaches Node capabilities **only** through a minimal, typed preload bridge exposed as `window.api`. No raw `fs`/`child_process`/`net` in the renderer. A CSP forbids remote content.
- **Source of truth:** the PTY and full session lifecycle live in **main**. The renderer is a **view over main's truth** — it holds a mirrored, disposable copy in Zustand and re-derives it from main on demand (e.g., after tear-off).

### 4.2 Window & tab model (browser-style + tear-off)

- Default: a single `BrowserWindow` with a **dockview** tab strip; **one tab per project**. Each tab owns a cwd, one `claude` PTY, an explorer root, and a Monaco view area.
- **Tear-off:** dragging a tab out (or a menu action) promotes that project into its own `BrowserWindow`; dragging back re-docks. A main-process **`WindowManager`** tracks `tabId → windowId`.
- Because the PTY lives in main, tearing off / re-docking **never restarts the `claude` session** — the destination renderer's xterm re-attaches to the same PTY stream and replays buffered scrollback via the serialize addon.

### 4.3 Terminal pipeline

- `node-pty` spawns the process (`claude` or a shell) with the chosen `cwd` and environment. On Windows this uses **ConPTY**. `node-pty` is a native module and **must be rebuilt for Electron's ABI** (validated in Phase 0).
- Data path: `pty.onData` → IPC (`session:data`) → `xterm.write()`. Keystrokes: xterm `onData` → IPC (`session:write`) → `pty.write()`.
- Resize: xterm `fit` addon computes `{cols, rows}` → IPC (`session:resize`) → `pty.resize()`. Resize events are **throttled** (≤ 1 call / 50 ms) to survive drag-resize storms.
- Rendering: xterm `webgl` addon for throughput; `search`, `fit`, `serialize` addons loaded. Main applies **flow control** — it pauses PTY reads when the renderer signals its write buffer is backed up, and resumes when drained.
- Only the **active** tab's xterm is mounted; inactive tabs keep a lightweight serialized buffer and rehydrate on activation. Scrollback capped (default 8k lines/tab).

### 4.4 Status pipeline (the key integration — hook-driven, not scraping)

1. **Session identity.** On tab creation, main generates a UUID and launches **`claude --session-id <uuid>`**, mapping `sessionId → tabId`. `session_id` is the **primary, deterministic correlation key** carried on every hook payload.
2. **Inline hook injection.** Main passes reporting hooks via **`--settings '<inline JSON>'`**, which is **session-only** and **merges with** (never overwrites) the user's `~/.claude/settings.json`. Hooks registered: `UserPromptSubmit`, `Stop`, `StopFailure`, `Notification` (and optionally `SessionStart`/`SessionEnd`). Personal config is never touched or written.
3. **Redundant env key.** The PTY environment includes **`CLAUDE_IDE_TAB=<tabId>`**; spawned hooks inherit it as a fallback identifier.
4. **Reporting transport.** Each hook command forwards its **stdin JSON** to the app's **local status endpoint** — a **Windows named pipe** or **POSIX Unix domain socket** behind one transport interface. **Never a TCP/localhost port** (deliberate security decision; Faris's localhost-HTTP suggestion was rejected).
5. **Event → status mapping** (main-process `StatusServer`):
   - `UserPromptSubmit` fired and no terminal state reached → **working**
   - `Notification` with `notification_type ∈ {agent_needs_input, permission_prompt, idle_prompt, elicitation_dialog}` → **waiting** (surface `message`)
   - `Stop` **OR** `Notification` with `notification_type = agent_completed` → **done**
   - `StopFailure` **OR** non-zero PTY exit → **error**
   - `notification_type = auth_success` → informational only (no state change)
6. **Routing.** Resolve the tab by `session_id` (primary), falling back to `tabId` (from `CLAUDE_IDE_TAB`) then `cwd`. Unknown/malformed messages are dropped and logged. If the endpoint is unavailable or a hook never fires, the tab shows **unknown** and the terminal still works fully.
7. **Surfacing.** Renderer badges the tab; when the target window/tab is not focused, `NotificationService` raises an OS toast that focuses the correct window + tab on click.

> Hooks are **observation-only** — they cannot gate Claude, which is exactly right here since Weft only reads state.

### 4.5 File explorer

- Main exposes `listDir`/`stat`/`revealInOs`/`openWithDefault` over IPC. One `chokidar` watcher per opened root emits **debounced** (100–200 ms) `add`/`change`/`unlink` events, ignoring `node_modules` and `.git` by default.
- Renderer renders a **virtualized** tree; children load lazily on expand.

### 4.6 Named technologies

TypeScript, pnpm, Electron, electron-vite, React, Vite, `@xterm/xterm` (+ `addon-fit`, `addon-webgl`, `addon-search`, `addon-serialize`), `node-pty`, `chokidar`, `electron-store`, `zustand`, `monaco-editor`, `dockview`, `vitest` + `@vitest/coverage-v8`, `@playwright/test` (Electron).

### 4.7 Session resilience across renderer reload (hot-reload & UI crashes)

**A first-class guarantee: a renderer reload never terminates a live `claude` session, and sessions are recoverable after a UI error.** This falls out of PTY-in-main, but is made explicit here so it is deliberately built and tested — not assumed:

- **PTY lifecycle is decoupled from the renderer.** A PTY is killed only on explicit `closeSession` (tab close) or process exit — **never** on window reload, Vite HMR update, or renderer crash. Renderer unmount/dispose unsubscribes its listeners and disposes the xterm instance, but the main-process PTY keeps running.
- **Main keeps a bounded per-session output ring buffer** (default 8k lines — same cap as inactive-tab scrollback). `attachSession(tabId)` replays this snapshot to a freshly mounted xterm, then streams live `session:data`. After any reload the terminal re-hydrates with prior output and stays interactive.
- **Idempotent re-attach.** Attaching is safe to call repeatedly (HMR re-runs module code); each attach tears down the prior subscription so there are no duplicate writes or listener leaks.
- **Renderer error boundary.** A React error boundary wraps the workbench: a render error shows a fallback with a *reload* action instead of a white screen, and does not touch main — after reload, every session re-attaches from its ring buffer.
- **Dev caveat — main-process edits.** Under `pnpm dev`, editing *renderer* code hot-updates with sessions intact; editing *main-process* code triggers an electron-vite **main restart**, which **does** kill PTYs (a child process cannot outlive its parent). v1 mitigation: prefer renderer edits while sessions are live. A detached PTY host that survives main restarts is a possible future enhancement (see Open Questions), not a v1 default.

---

## 5. API contract

There is **no HTTP server**. The "API" is (a) the typed preload IPC bridge `window.api` and (b) the local status endpoint's message shape.

### 5.1 Preload bridge (`window.api`), typed

```ts
type Unsubscribe = () => void
type SessionStatus = 'working' | 'waiting' | 'done' | 'error' | 'unknown'

interface Api {
  // Terminal / session
  createSession(opts: { cwd: string; command: 'claude' | 'shell'; args?: string[] }): Promise<{ tabId: string }>
  writeToSession(tabId: string, data: string): void
  resizeSession(tabId: string, cols: number, rows: number): void
  closeSession(tabId: string): Promise<void>
  renameTab(tabId: string, title: string): Promise<void>
  reorderTabs(tabOrder: string[]): Promise<void>
  moveTabToWindow(tabId: string, targetWindowId: string | 'new'): Promise<{ windowId: string }>
  onSessionData(cb: (e: { tabId: string; data: string }) => void): Unsubscribe
  onSessionExit(cb: (e: { tabId: string; exitCode: number }) => void): Unsubscribe
  onSessionStatus(cb: (e: { tabId: string; status: SessionStatus; message?: string }) => void): Unsubscribe

  // Filesystem
  listDir(path: string): Promise<DirEntry[]>
  watchDir(path: string): Promise<{ watchId: string }>
  unwatchDir(watchId: string): Promise<void>
  onFsChange(cb: (e: { watchId: string; type: 'add' | 'change' | 'unlink'; path: string }) => void): Unsubscribe
  revealInOs(path: string): Promise<void>
  openWithDefault(path: string): Promise<void>

  // Diff / editor
  readFileText(path: string): Promise<{ path: string; content: string }>
  getDiff(path: string): Promise<{ path: string; original: string; modified: string }>

  // Persistence
  loadWorkspace(): Promise<WorkspaceState>
  saveWorkspace(state: WorkspaceState): Promise<void>
}

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
  windowBounds: Record<string, { x: number; y: number; width: number; height: number }>
}
```

### 5.2 Local status endpoint (named pipe / UDS)

- **Transport:** Windows named pipe `\\.\pipe\weft-status-<uuid>`; POSIX Unix domain socket `$XDG_RUNTIME_DIR/weft-status.sock` (fallback `os.tmpdir()`). **No `net.createServer` on a TCP port — ever.**
- **Framing:** newline-delimited JSON (one object per line). Each hook forwards its stdin payload plus the resolved event name.

```jsonc
{
  "event": "UserPromptSubmit | Stop | StopFailure | Notification | SessionStart | SessionEnd",
  "session_id": "…",          // primary key → tab (pinned via --session-id)
  "cwd": "…",
  "transcript_path": "…",
  "hook_event_name": "…",
  "permission_mode": "…",
  "notification_type": "agent_needs_input | agent_completed | permission_prompt | idle_prompt | elicitation_dialog | auth_success",  // Notification only
  "message": "…",             // Notification only
  "tabId": "…"                // redundant, from $CLAUDE_IDE_TAB
}
```

- The server resolves the tab by `session_id`, then `tabId`, then `cwd`; unresolved or malformed lines are dropped and logged; validation binds `tabId` to a known tab to reject spoofed status.

---

## 6. Data / persistence design

- **Store:** `electron-store` — a single JSON blob on disk (app-owned userData path). No relational DB in v1.
- **Versioned schema:** the blob carries `version: number`. On load, a **migration chain** upgrades older shapes to the current version. Before applying migrations, the prior config file is **backed up** (`config.bak`) so a failed upgrade can be restored. Migrations are backward-tolerant and never destructively rewrite without a backup.
- **Persisted shape:** the `WorkspaceState` interface (§5.1) — `version`, `tabs` (each `{tabId, sessionId, title, cwd, command, windowId}`), `tabOrder`, `explorerRoots`, `theme`, `windowBounds`.
- **Not persisted:** terminal scrollback is never written to disk by default; no secrets or env are persisted.
- **Restore-on-launch:** on start, the app reads `WorkspaceState`, recreates the tab strip and windows first, then spawns PTYs on demand (lazy for non-active tabs).

---

## 7. UI/UX

### 7.1 Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [proj-a ●working] [proj-b ‖waiting] [proj-c ✓done ⤢] [+]      │  ← tab strip
├───┬───────────────┬──────────────────────────────────────────┤     (⤢ tear-off)
│ E │  EXPLORER      │        xterm.js terminal (active proj)    │
│ X │  ▸ src/        │        running `claude` fullscreen TUI    │
│ P │  ▸ tests/      │  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│ L │    README.md   │        Monaco (on demand): file view /    │
│ R │                │        side-by-side diff of Claude edits   │
├───┴───────────────┴──────────────────────────────────────────┤
│ status bar: cwd · git branch · session status · notifs        │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Tab status badges (accessibility — not color alone)

Each status has **both a distinct color and a distinct shape/glyph**, so it is distinguishable without color perception:

| Status | Glyph / shape | Color (light/dark aware) | Motion |
|---|---|---|---|
| working | ● spinner (rotating dot) | blue/accent | animated (static when reduced-motion) |
| waiting | ‖ pause bars | amber | pulse (static when reduced-motion) |
| done | ✓ check | green | none |
| error | ✕ cross | red | none |
| unknown | ○ hollow circle | grey | none |

Each badge carries a screen-reader `aria-label` ("proj-b: waiting on input").

### 7.3 Themes

- `system` (default), `light`, `dark` — honors OS `prefers-color-scheme`; user override persists in `WorkspaceState.theme`.
- **Reduced-motion:** honors OS `prefers-reduced-motion` — spinner/pulse animations become static glyphs.

### 7.4 Keybindings (with terminal-key passthrough)

- `Ctrl+T` new tab, `Ctrl+W` close tab, `Ctrl+Tab` cycle tabs, `Ctrl+1..9` jump to tab N.
- **Passthrough rule:** terminal-bound keys (`Ctrl+C`, arrows, function keys, mouse) reach the active PTY and are **not** intercepted by app shortcuts. The keybinding router only claims the reserved app chords above.

### 7.5 Loading / empty / error states

- **Loading:** PTY starting → skeleton + "Starting session…".
- **Empty:** no tabs → centered "Open a project" CTA.
- **Error:** `claude` not found / PATH issue / spawn failure → an actionable message with a **Retry** button and a link to install/PATH help; the tab is not left blank and the app does not crash.

---

## 8. Edge cases & error handling

- **ConPTY quirks** (resize glitches, mouse reporting, fullscreen redraw) — primary risk; validated manually in the Phase-0 spike.
- **`claude` not on PATH / wrong version** — detected at spawn; the tab shows the actionable error state (§7.5), never crashes.
- **PTY exits unexpectedly** — tab marked `error`, exit code shown, offer restart in the same cwd. Non-zero exit sets `error`; zero exit is a clean close.
- **cwd deleted/renamed while open** — surface a warning; disable file-tree ops for that root; the terminal keeps running.
- **Status endpoint down / hook never fires** — degrade to `unknown`; the terminal is never blocked.
- **Resize storms** during drag — throttled to ≤ 1 `pty.resize` / 50 ms.
- **Huge single-line / binary output** — xterm guarded against pathological input; line length capped; flow control pauses the firehose.
- **Notification click when the app is closed** — relaunch the app and route to the tab; if the tab no longer exists, no-op gracefully.
- **Duplicate/spoofed status** — a `session_id`/`tabId` not bound to a known tab is dropped; two PTYs never claim one `tabId`.
- **Renderer reload / HMR / UI crash while sessions are live** — the PTY survives in main; the renderer re-attaches on mount and replays the ring buffer. A React render error is caught by an error boundary (fallback + reload), never killing a session. (Editing *main-process* code under `pnpm dev` is the one exception — it restarts main and kills PTYs; see §4.7.)

---

## 9. Testing strategy

Per global conventions: tests for every feature/bugfix, **95%+ coverage before commit**, a regression test for every bug.

- **Unit:** session/tab state reducer; IPC handlers with a mock PTY; hook-event → status parser (all four states + `auth_success` no-op); config-store migration chain; keybinding router (passthrough vs. reserved chords).
- **Integration:** fake-PTY round-trip (scripted process → IPC → headless xterm assertion); chokidar → `onFsChange` events; status endpoint receives a simulated hook line → correct tab status transition; tear-off preserving the PTY (move tab, assert same session_id, no respawn).
- **E2E:** **Playwright for Electron** — launch app, open a tab, run a command, assert output; add/close/rename/reorder tabs; restore-on-restart.
- **Manual (Windows, required):** fullscreen `claude` TUI in the embedded terminal — rendering, mouse, resize, paste, `Ctrl+C`. Phase-0 exit criterion; not fully automatable.
- **Fixtures:** fake-pty harness, sample project tree, canned hook payloads for each `notification_type`.

---

## 10. Open questions

- Should re-docking a torn-off tab restore its original strip position, or append to the end?
- Debounce window for chokidar on very large trees — is 100–200 ms adequate, or should it scale with tree size?
- Should `claude --continue` resume (v1 nice-to-have) reuse the persisted `sessionId`, or mint a new one?
- Named-pipe/UDS name collision strategy across concurrent Weft instances (per-instance UUID vs. per-user fixed name)?
- Do we surface `idle_prompt` as `waiting` immediately, or after a grace period to avoid noisy toasts?
- Windows toast action-center behavior when many notifications stack — coalesce per tab?
- Should PTYs be hosted in a **detached helper process/daemon** so they survive a main-process restart (dev main-code edits, and future main crashes/updates), rather than dying with main? Bigger architecture change; deferred past v1 but revisit if main-restart session loss proves painful in daily use.
- **Verification caveat (AC 11, OS notifications):** the toast policy (unfocused + waiting/done → toast; click → focus window + activate tab) is fully unit-tested and the Electron wiring is in place, but a real OS toast render/click cannot be driven by Playwright — needs one manual confirmation on Windows 11. All other 24 criteria are machine-verified (185 unit / 17 E2E).

---

## Acceptance Criteria

- [x] Creating a tab spawns `claude --session-id <uuid>` with the PTY `cwd` set to the selected directory, and `window.api.createSession` resolves with a `{ tabId }`.
- [x] Each spawned session's PTY environment contains `CLAUDE_IDE_TAB=<tabId>`, and the launch args include `--settings` whose inline JSON registers `UserPromptSubmit`, `Stop`, `StopFailure`, and `Notification` hooks (assert the user's `~/.claude/settings.json` file bytes are unchanged after launch).
- [x] Tabs can be created, renamed (`window.api.renameTab` updates `TabState.title`), and reordered (`window.api.reorderTabs` updates `tabOrder`); the strip order matches `tabOrder` after each operation.
- [x] Closing a tab calls `pty.kill()`, `window.api.closeSession` resolves, and the `tabId` is no longer present in the PtyManager registry.
- [x] Typed input sent via `window.api.writeToSession` reaches the PTY (a fake-PTY echo round-trips back through `onSessionData` with the same bytes), and `Ctrl+C` is delivered to the PTY rather than intercepted by an app shortcut.
- [x] Calling `window.api.resizeSession(tabId, cols, rows)` invokes `pty.resize(cols, rows)`, and rapid resize events are throttled to at most one `pty.resize` call per 50 ms.
- [x] Tearing a tab off into a new `BrowserWindow` (`window.api.moveTabToWindow(tabId, 'new')`) keeps the **same** `sessionId` with no PTY respawn (PtyManager process PID is unchanged), and the destination xterm re-attaches to the existing stream.
- [x] A `Notification` hook payload with `notification_type: "permission_prompt"` transitions the mapped tab's badge to `waiting` within 1s; `agent_needs_input`, `idle_prompt`, and `elicitation_dialog` also map to `waiting`.
- [x] A `UserPromptSubmit` hook payload transitions the mapped tab's badge to `working`; a `Stop` event OR `notification_type: "agent_completed"` transitions it to `done`; a `StopFailure` event OR a non-zero PTY exit transitions it to `error`.
- [x] Hook payloads are routed to the correct tab by `session_id` as the primary key, falling back to `tabId` (from `CLAUDE_IDE_TAB`) then `cwd`; a payload whose ids match no known tab is dropped and logged (no status change).
- [x] When the target window/tab is unfocused and a session enters `waiting` or `done`, an OS notification is raised whose click focuses the correct `BrowserWindow` and activates the correct `tabId`.
- [x] The status server binds a Windows named pipe (`\\.\pipe\weft-status-*`) on Windows or a Unix domain socket on POSIX, and never opens a TCP socket (assert no `net.createServer` is listening on any port).
- [x] The file explorer lists a directory via `window.api.listDir`, and an external file `add`/`change`/`unlink` produces a matching `onFsChange` event within ~1s (≤ 1000 ms).
- [x] `window.api.getDiff(path)` returns `{ original, modified }` and the Monaco diff pane renders a side-by-side view of Claude's changes for that file; `window.api.readFileText` opens a file read-only.
- [x] Closing and reopening the app restores the prior tabs, their `cwd`s, tab order, explorer roots, theme, and window bounds from electron-store (`loadWorkspace` returns the previously saved `WorkspaceState`).
- [x] Loading a persisted blob with an older `version` runs the migration chain to the current version, writes a `config.bak` backup first, and yields a valid current-shape `WorkspaceState`.
- [x] Each status badge renders a distinct shape/glyph in addition to color (working ●, waiting ‖, done ✓, error ✕, unknown ○), each with an `aria-label`; under OS reduced-motion the working/waiting animations render static.
- [x] The app honors the OS light/dark theme when `theme: 'system'`, and a `light`/`dark` override persists across restarts.
- [x] Spawning when `claude` is not on PATH shows the actionable error state with a Retry action and does not crash the tab or app (a subsequent successful Retry spawns the session).
- [x] If the status endpoint is unavailable or no hook fires, the affected tab shows `unknown` status while terminal input/output continues to function.
- [x] Overall statement coverage is >= 95% per the vitest `@vitest/coverage-v8` report, and the Playwright-for-Electron E2E suite passes (launch → open tab → run command → assert output → restore-on-restart).
- [x] A renderer window reload (or Vite HMR update) does not invoke `closeSession`: the PTY process PID in the PtyManager registry is unchanged, and after reload the xterm re-attaches to the same `sessionId`.
- [x] `window.api.attachSession(tabId)` replays the main-side per-session ring buffer (bounded, default 8k lines) to a freshly mounted xterm before streaming live data, so a reloaded terminal shows prior output and remains interactive.
- [x] Repeated attach/detach cycles (simulating HMR) leave exactly one active `session:data` subscription per mounted terminal — asserted listener count is stable across cycles (no duplicate writes, no leak).
- [x] A thrown error in a renderer component is caught by an error boundary that renders a fallback with a reload action and does not terminate any PTY; after reload, sessions re-attach and remain interactive (Playwright-for-Electron: force a render error, reload, assert the session still echoes input).

---

## Expansion 2 — Hardening sweep + shell tabs + terminal search

Cycle-2 scope (budget-aware: leap 21/30 at planning): close every deferred
review item, then two small features with daily-driver value.

### New acceptance criteria

- [x] `FrameParser` caps its buffer (1 MB): a newline-less flood is dropped and reported via `onError`, never OOMing main.
- [x] On POSIX the status socket is created `0700`-dir/`0600` and unlinked on close; Windows named pipes unaffected. (Platform-guarded; unit via injected fs.)
- [x] `readFileText`/`getDiff` refuse files larger than 5 MB; the viewer shows a friendly "too large" error instead of hanging.
- [x] The git diff baseline resolves non-ASCII filenames (`-c core.quotepath=false`).
- [x] Dead API surface removed: `renameTab`/`reorderTabs` channels + WeftApi methods, `needsMigration`, `isOk`, the unused `_prev` parameter of `mapHookToStatus`; chokidar ignore regex anchors both alternatives; stale depth comment fixed.
- [x] The viewer header has a **Reveal** button that calls `revealInOs` for the open file.
- [x] Spawn-failure state lives in the zustand store (no module-level mutable listener).
- [x] E2E hygiene: specs strip inherited `WEFT_*` env vars; the persistence spec polls for the saved workspace instead of a bare 500 ms sleep.
- [x] Shift-clicking **+** opens a plain **shell** tab (PowerShell/bash) through the real UI, badge `unknown`, fully interactive.
- [x] `Ctrl+Shift+F` opens an in-terminal search bar (xterm search addon) that highlights matches in scrollback; Enter finds next, Esc closes and returns focus to the terminal.

---

## Expansion 3 — Open-source hygiene + packaging

Design-doc §17 obligations that code alone doesn't satisfy.

### New acceptance criteria

- [x] A `LICENSE` file (MIT, per the design doc) exists at the repo root.
- [x] `CONTRIBUTING.md` covers dev setup, the test commands, the architecture boundary rules (pure core vs adapters), and the coverage bar.
- [x] A GitHub Actions workflow (`.github/workflows/ci.yml`) runs typecheck + unit tests + coverage gate on push/PR (Windows + Linux matrix; E2E job on Windows with the native rebuild).
- [x] `pnpm package` produces a distributable Windows build via electron-builder (verified locally with an unpacked `--dir` build that launches).

---

## Expansion 5 — END GOAL: v0.2.0 "Daily Driver"

Declared end goal (operator-set, cycle 5): the release that makes Weft strictly
better than a bare terminal for daily Claude work. Budget extended to 40 leaps.

### New acceptance criteria

- [x] Each tab persists its REAL pinned `sessionId` (workspace schema v2 with a v1→v2 migration exercising the chain + config.bak backup).
- [x] With **Resume** enabled (status-bar toggle, persisted), a restored `claude` tab relaunches as `claude --resume <sessionId> --session-id <new-uuid>` style continuation (exact flags per CLI verification) so the conversation continues; with it disabled, restored tabs start fresh.
- [x] The status bar shows the active project's current **git branch** (updates on tab switch; blank for non-repos), backed by a unit-tested GitService.
- [x] The Monaco viewer gains an **Edit** mode: typing enabled, dirty indicator (●) on change, `Ctrl+S` writes the file to disk through a validated IPC (`saveFile`), and the explorer/diff reflect the save. E2E: edit → save → file content on disk changed.
- [x] `saveFile` refuses paths outside any open project root (boundary validation) and files >5 MB.
- [x] Unused dependencies removed from package.json (`dockview`, `@xterm/addon-webgl`, `@xterm/addon-serialize`) — install + full suite still green.
- [x] v0.2.0 stamped with an updated CHANGELOG; full suite (unit + E2E incl. packaged) green.

---

## Manual addendum (post-v0.2.0, 2026-07-18) — whole-tab state coloring

Done **manually, outside the `/dmail` loop** (which is parked at `el-psy-kongroo`).
Recorded here so the spec stays complete; intentionally **not** numbered
"Expansion 6" so it doesn't collide with the next autonomous cycle. Full design:
`documents/completed/tab-state-colors.md`.

### New acceptance criteria

- [x] Each tab's Claude Code `SessionStatus` colors the **whole tab** (a colored top stripe + background tint), not just the status glyph: `working` blue, `waiting` amber, `done` green, `error` red, `unknown` neutral.
- [x] The active tab stays visually distinct from inactive tabs within the same status (stronger tint).
- [x] An `onSessionStatus` update recolors only the targeted tab, not the others.
- [x] The tab tint and the status glyph share one color source (`--st-*` CSS variables) so they can never drift; color remains redundant with the distinct glyph shapes + `aria-label` (no color-only signal).
- [x] Covered by `src/renderer/App.test.tsx` (status→class transitions + per-tab scoping); renderer suite green, typecheck clean.

---

## Expansion 6 — Mouseless / keyboard-only navigation

Operator-declared end goal (cycle 6): Weft must be fully operable with the
keyboard alone — every mouse action gains a keyboard path, focus moves
deliberately between regions, and the shortcuts are discoverable in-app — while
the terminal-key passthrough invariant is preserved. **Out of scope this cycle:**
macOS/Linux platform work (stay Windows-first); split panes / LSP unless they
serve navigation. Budget extended to 50 leaps. Full design:
`documents/keyboard-navigation.md`.

### New acceptance criteria

- [x] All new app chords are added to the **pure** `keybinding-router` (`routeKey`) as the single source of truth; the App-level `window` keydown listener and xterm's `attachCustomKeyEventHandler` both consult it. A regression test asserts the protected passthrough set still routes to `passthrough`: `Ctrl+C/R/D/Z/L/A/E`, plain keys, arrow keys, function keys, and all Alt/Meta combos — and that no new chord collides with them.
- [x] The previously out-of-band terminal-search chord (`Ctrl+Shift+F`) is routed through `routeKey` (not special-cased in `TerminalPane`), so the router and terminal handler agree; terminal search still opens and Esc still returns focus to the terminal.
- [x] A **command palette** opens on `Ctrl+Shift+P`: a fuzzy-filtered, keyboard-only list of every registered app command, each row showing its shortcut hint; typing filters, ↑/↓ move the highlight, Enter runs the highlighted command, Esc closes. It uses accessible `role="listbox"`/`option` with `aria-activedescendant`, and on close restores DOM focus to the region that was active before it opened.
- [x] The palette is backed by a single **pure command registry** (`core/commands`) with unique ids and a title + shortcut hint per command; a unit test asserts id uniqueness and that every shortcut hint referenced by the help overlay corresponds to a real router chord (no drift).
- [x] A **keyboard help overlay** opens on `Ctrl+Shift+/` (Ctrl+?), listing all shortcuts grouped by category (Tabs / Focus / Explorer / Viewer / General); Esc closes it. (May be implemented as a distinct overlay or a palette mode.)
- [x] A **region-focus system** moves DOM focus between the main regions (tab strip, explorer, terminal, viewer/editor, status bar): `Ctrl+F6` / `Ctrl+Shift+F6` cycle regions forward/back (skipping absent regions), `` Ctrl+` `` focuses the terminal (xterm textarea, so typing reaches the PTY), and `Ctrl+Shift+E` focuses the explorer. Each focus move calls `.focus()` on the region's target element (verified by asserting `document.activeElement`).
- [x] A **visible, theme-aware focus indicator** (`:focus-visible`) is present on every interactive element — tabs, explorer nodes, viewer toolbar buttons, status-bar controls, and overlay options — including a cyberpunk-theme variant; any focus transition respects `prefers-reduced-motion`. (Asserted via the rendered class/style and an E2E focus-ring check.)
- [x] The **explorer tree** is fully keyboard-navigable per the WAI-ARIA tree pattern via **pure** `core/explorer/tree-nav` logic + a roving-tabindex view: exactly one node is a tab stop; ↑/↓ move between visible nodes, → expands (or moves to first child), ← collapses (or moves to parent), Enter/Space opens a file or toggles a directory, Home/End jump to first/last node; nodes expose `aria-level` and `aria-selected`. Unit tests cover the nav transitions; an E2E opens a file using only the keyboard.
- [x] Tab management is keyboard-complete: the active tab can be **reordered** (`Ctrl+Shift+PageUp`/`PageDown` move it left/right, updating `tabOrder`), **renamed** from the keyboard (`F2` enters the inline rename input; Enter commits, Esc cancels), and the **tab type** (claude vs plain shell) can be chosen without the mouse (a command-palette entry and/or chord), replacing the mouse-only Shift+Click.
- [x] The Monaco viewer's **View / Edit / Diff** mode switches plus **Reveal** and **Close** are reachable by keyboard (command palette and/or chords), not mouse-only; and **`Ctrl+S` saves whenever the viewer region is focused** (app-level fallback through the existing root-confined, ≤5 MB `saveFile` IPC), not only when the Monaco editor itself holds focus.
- [x] The status-bar **theme cycle** and **resume toggle** are triggerable from the keyboard (command-palette entries and/or chords), not only by tabbing to the buttons.
- [x] While the command palette, help overlay, or an inline text input is open, **terminal passthrough is suspended** (keys operate the overlay, Esc closes) and is restored on close; modal overlays **trap focus** (Tab cycles within) and restore focus on close. Overlays expose correct roles/aria and are screen-reader operable.
- [x] A **Playwright-Electron E2E completes a full mouseless journey using keyboard input only (no `.click()`)**: open a project via the palette → focus the explorer → arrow-navigate and Enter to open a file in the viewer → focus and type into the terminal → switch tabs → cycle the theme — asserting each outcome; plus assertions that a focus ring is visible and that terminal-bound keys still reach the PTY. Overall statement coverage remains ≥ 95%.

---

## Manual addendum (post-v0.2.0, 2026-07-18) — clear `waiting` after a permission prompt

Done **manually, outside the `/dmail` loop** (parked at `el-psy-kongroo`).
Recorded here so the spec stays complete; intentionally **not** numbered
"Expansion N" so it doesn't collide with the next autonomous cycle.

**Bug:** A tab correctly turned `waiting` (amber) when Claude asked for input,
but stayed amber after the user answered a **permission prompt**. Approving a
tool fires no `UserPromptSubmit` — the only event that mapped back to `working`
— so nothing reached Weft after approval and the tab held `waiting` until the
next `Stop` (→ `done`). It never showed the "running again" color.

**Fix:** Weft now also reports the `PostToolUse` hook and maps it to `working`.
`PostToolUse` fires when the approved tool executes — i.e. the moment the agent
resumes — so it clears `waiting` → `working`. The status server already dedups
against the prior status, so the extra per-tool events collapse to no-ops during
normal work. (Refines AC "A `UserPromptSubmit` hook payload transitions … to
`working`" above.)

### New acceptance criteria

- [x] The `--settings` inline JSON registers a `PostToolUse` hook in addition to `UserPromptSubmit`, `Stop`, `StopFailure`, and `Notification` (the user's `~/.claude/settings.json` bytes stay unchanged).
- [x] A `PostToolUse` hook payload transitions the mapped tab's badge to `working`; a tab in `waiting` after a `permission_prompt` returns to `working` once the approved tool runs, without needing a new `UserPromptSubmit`.
- [x] Regression test in `status-mapper.test.ts` (`PostToolUse` → `working`); `hook-settings` tests assert the full reported-event set; typecheck clean and the unit suite green (aside from the documented `hook-forwarder.integration.test.ts` env-leak that only fails when the suite runs inside a live Weft/Claude session).

---

## Manual addendum (post-v0.2.0, 2026-07-18) — notifications on/off switch

Done **manually, outside the `/dmail` loop**. Full design:
`documents/completed/notifications-toggle.md`. A persisted global switch for OS
toasts, enforced centrally in main (`NotificationService.isEnabled`), surfaced
as a status-bar button + `general.toggleNotifications` command. Workspace schema
bumped **v2 → v3** (`notificationsEnabled`, default `true`).

### New acceptance criteria

- [x] `WorkspaceState` gains `notificationsEnabled` (default `true`), persisted and round-tripped; a v2 blob migrates to v3 via `v2ToV3`, and the full v0→v3 chain yields a valid current-shape state.
- [x] With the flag off, `NotificationService` raises no toast for any `waiting`/`done` change (suppressed before the cooldown check, so muting never consumes a cooldown slot); with it on, behavior is unchanged. A toggle takes effect on the next event without a restart.
- [x] A status-bar toggle (`🔔 notify on` / `🔕 notify off`, `aria-label`d) and a `general.toggleNotifications` command flip and persist the flag; the in-app tab color/badge is unaffected when toasts are muted.
- [x] Covered by service/migration/sync/store unit tests and `App.test.tsx` (palette + status-bar toggle); typecheck clean, 27/27 E2E green.

---

## Expansion 7 — Remappable keybindings + dispatch unification (operator-prepped plan)

**Operator END GOAL (cycle 7):** make Weft's keyboard shortcuts **user-remappable**,
and in doing so **eliminate the dual-dispatch drift** that caused Cycle 6's one
real bug. Fold in the small keyboard-nav follow-ups Cycle 6 deferred near-budget.
This section is the **operator plan for the next autonomous `/dmail` cycle**; the
loop should execute and check these off (append refinements under this heading).

**In scope**
- A single source of truth mapping **chord → command**, consumed by both the
  window key listener and xterm's `attachCustomKeyEventHandler`, replacing the
  two parallel `KeyAction`/`CommandId` switches.
- A persisted, user-editable keymap with reset-to-defaults, a keyboard-operable
  editor UI, conflict detection, and an unbreakable PTY-passthrough guard.
- The three deferred palette no-ops + one Explorer dedup.

**Out of scope (unchanged from prior cycles)**
- macOS/Linux platform work; split panes; LSP.
- Multi-key chord *sequences* (e.g. `Ctrl+K Ctrl+S`) unless they fall out for free.

### New acceptance criteria

- [x] **Dispatch unified:** command chords and palette/command invocations resolve through one pure mapping (chord → `CommandId` → single handler). A regression test proves every chord-reachable command and its palette entry invoke the **same** handler (the drift that displaced `viewer.save` in Cycle 6 is structurally impossible). The old parallel `KeyAction`-switch / `CommandId`-switch duplication is removed. *(Leap 49: `core/commands/action-dispatch.ts` + bidirectional no-drift test; `App.onKey` now routes via `commandIdForAction` → `runCommand`.)*
- [x] **User keymap:** a keymap overriding the built-in defaults is editable at runtime and **persisted** (round-trips through save/load; schema-migrated if stored in `WorkspaceState`). A **Reset to defaults** action restores the shipped bindings. *(Leap 52: `WorkspaceState.keymapOverrides`, schema v3→v4, `buildKeymap` merge fed to `routeKey`, `general.resetKeybindings`. Leap 53: the editor drives it live.)*
- [x] **Protected passthrough is unbreakable:** the reserved terminal set (`Ctrl+C/R/D/Z/L/A/E`, arrows, function keys, Alt/Meta combos, plain keys) can never be bound to an app command — an attempt is rejected with a clear reason — and a regression test asserts these still reach the PTY after arbitrary remaps. *(Leap 51: `isProtectedChord` + `bindChord` refuses protected chords; test proves the chord never enters the map so routeKey still passes it through.)*
- [x] **Conflict detection:** binding a chord already in use surfaces the conflict and applies a defined resolution rule (reject or reassign-with-warning); covered by unit tests. *(Leap 51: `bindChord` reassigns and returns the displaced action for a warning.)*
- [x] **Keybindings editor UI:** an accessible, fully keyboard-operable editor (opened via a command; palette-reachable) lists each command with its current chord, lets the user capture a new chord and reset one/all, traps focus while open, and restores focus on close (ARIA-correct, motion-safe, themed incl. cyberpunk). *(Leap 53: `KeybindingsEditor` overlay — listbox + `aria-activedescendant`, Enter-to-capture via `chordOf`, `bindChord`/protected/conflict from leap 51, Backspace reset + Reset all, live-region status.)*
- [x] **`terminal-search-palette-noop` fixed:** the "Search in Terminal" palette command actually opens the in-terminal search bar (via a `TerminalPane` open-search signal, mirroring the viewer's save-tick pattern), not just focusing the terminal. *(Leap 54: `terminal-store.searchTick`; runCommand bumps it, TerminalPane opens search on a genuine increment.)*
- [ ] **`tab-rename-palette-noop` fixed:** the "Rename Tab" palette command triggers inline rename of the active tab (active-tab rename signal); `F2` on the focused tab keeps working.
- [ ] **`expand-collapse-dup` folded:** the Explorer's `expandPath`/`collapsePath` become one pure toggle helper with unchanged behavior and retained coverage.
- [ ] **Purity + coverage:** keymap resolution, conflict checks, and the protected-set guard live in pure `core/` with injected fakes; overall statement coverage stays ≥ 95% (branches ≥ 90%).
- [ ] **E2E remap journey (no `.click()` where avoidable):** open the editor, rebind a command to a new chord, invoke it via that chord and observe the effect, reset to defaults, and confirm a protected chord still reaches the PTY. The custom keymap survives an app restart.
