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

---

## Acceptance Criteria

- [ ] Creating a tab spawns `claude --session-id <uuid>` with the PTY `cwd` set to the selected directory, and `window.api.createSession` resolves with a `{ tabId }`.
- [ ] Each spawned session's PTY environment contains `CLAUDE_IDE_TAB=<tabId>`, and the launch args include `--settings` whose inline JSON registers `UserPromptSubmit`, `Stop`, `StopFailure`, and `Notification` hooks (assert the user's `~/.claude/settings.json` file bytes are unchanged after launch).
- [ ] Tabs can be created, renamed (`window.api.renameTab` updates `TabState.title`), and reordered (`window.api.reorderTabs` updates `tabOrder`); the strip order matches `tabOrder` after each operation.
- [ ] Closing a tab calls `pty.kill()`, `window.api.closeSession` resolves, and the `tabId` is no longer present in the PtyManager registry.
- [ ] Typed input sent via `window.api.writeToSession` reaches the PTY (a fake-PTY echo round-trips back through `onSessionData` with the same bytes), and `Ctrl+C` is delivered to the PTY rather than intercepted by an app shortcut.
- [ ] Calling `window.api.resizeSession(tabId, cols, rows)` invokes `pty.resize(cols, rows)`, and rapid resize events are throttled to at most one `pty.resize` call per 50 ms.
- [ ] Tearing a tab off into a new `BrowserWindow` (`window.api.moveTabToWindow(tabId, 'new')`) keeps the **same** `sessionId` with no PTY respawn (PtyManager process PID is unchanged), and the destination xterm re-attaches to the existing stream.
- [ ] A `Notification` hook payload with `notification_type: "permission_prompt"` transitions the mapped tab's badge to `waiting` within 1s; `agent_needs_input`, `idle_prompt`, and `elicitation_dialog` also map to `waiting`.
- [ ] A `UserPromptSubmit` hook payload transitions the mapped tab's badge to `working`; a `Stop` event OR `notification_type: "agent_completed"` transitions it to `done`; a `StopFailure` event OR a non-zero PTY exit transitions it to `error`.
- [ ] Hook payloads are routed to the correct tab by `session_id` as the primary key, falling back to `tabId` (from `CLAUDE_IDE_TAB`) then `cwd`; a payload whose ids match no known tab is dropped and logged (no status change).
- [ ] When the target window/tab is unfocused and a session enters `waiting` or `done`, an OS notification is raised whose click focuses the correct `BrowserWindow` and activates the correct `tabId`.
- [ ] The status server binds a Windows named pipe (`\\.\pipe\weft-status-*`) on Windows or a Unix domain socket on POSIX, and never opens a TCP socket (assert no `net.createServer` is listening on any port).
- [ ] The file explorer lists a directory via `window.api.listDir`, and an external file `add`/`change`/`unlink` produces a matching `onFsChange` event within ~1s (≤ 1000 ms).
- [ ] `window.api.getDiff(path)` returns `{ original, modified }` and the Monaco diff pane renders a side-by-side view of Claude's changes for that file; `window.api.readFileText` opens a file read-only.
- [ ] Closing and reopening the app restores the prior tabs, their `cwd`s, tab order, explorer roots, theme, and window bounds from electron-store (`loadWorkspace` returns the previously saved `WorkspaceState`).
- [ ] Loading a persisted blob with an older `version` runs the migration chain to the current version, writes a `config.bak` backup first, and yields a valid current-shape `WorkspaceState`.
- [ ] Each status badge renders a distinct shape/glyph in addition to color (working ●, waiting ‖, done ✓, error ✕, unknown ○), each with an `aria-label`; under OS reduced-motion the working/waiting animations render static.
- [ ] The app honors the OS light/dark theme when `theme: 'system'`, and a `light`/`dark` override persists across restarts.
- [ ] Spawning when `claude` is not on PATH shows the actionable error state with a Retry action and does not crash the tab or app (a subsequent successful Retry spawns the session).
- [ ] If the status endpoint is unavailable or no hook fires, the affected tab shows `unknown` status while terminal input/output continues to function.
- [ ] Overall statement coverage is >= 95% per the vitest `@vitest/coverage-v8` report, and the Playwright-for-Electron E2E suite passes (launch → open tab → run command → assert output → restore-on-restart).
- [ ] A renderer window reload (or Vite HMR update) does not invoke `closeSession`: the PTY process PID in the PtyManager registry is unchanged, and after reload the xterm re-attaches to the same `sessionId`.
- [ ] `window.api.attachSession(tabId)` replays the main-side per-session ring buffer (bounded, default 8k lines) to a freshly mounted xterm before streaming live data, so a reloaded terminal shows prior output and remains interactive.
- [ ] Repeated attach/detach cycles (simulating HMR) leave exactly one active `session:data` subscription per mounted terminal — asserted listener count is stable across cycles (no duplicate writes, no leak).
- [ ] A thrown error in a renderer component is caught by an error boundary that renders a fallback with a reload action and does not terminate any PTY; after reload, sessions re-attach and remain interactive (Playwright-for-Electron: force a render error, reload, assert the session still echoes input).

---

*El Psy Kongroo.*
