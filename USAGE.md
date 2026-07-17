# weft — Lab Member Operating Manual

## Installation

> Weft runs **from source** (no packaged installer yet). First-time setup needs:
> **Node.js 20+** (nodejs.org) → `npm install -g pnpm` → the **Claude Code CLI**
> (claude.com/claude-code; check with `claude --version`) → and on Windows the
> **VS Build Tools 2022** with the *Desktop development with C++* workload
> (visualstudio.microsoft.com/downloads) + Python 3.x. Then, from a terminal
> **inside the weft folder** (git clone or downloaded source):

```bash
pnpm install          # installs deps; downloads the Electron binary
pnpm rebuild:native   # rebuilds node-pty for Electron's ABI (run once after install)
pnpm dev              # launch the app in development (electron-vite)
pnpm build            # production build of main + preload + renderer
pnpm test             # unit/integration suite (vitest) — 229 tests
pnpm test:cov         # with the 95% statement coverage gate (currently ~98%)
pnpm test:e2e         # builds, then drives the REAL Electron app (24 Playwright tests)
```

> **Prerequisite:** a working `claude` CLI on your PATH (Windows 10+ for ConPTY).

### Native build (node-pty)

`node-pty` is a native module and must be built for Electron's ABI before the app
can spawn terminals:

```bash
pnpm rebuild:native
```

Requirements on Windows: **Visual Studio Build Tools** with the *Desktop
development with C++* workload, plus Python 3.x. Two quirks are handled for you:
- The script clears `NoDefaultCurrentDirectoryInExePath` for the build
  (otherwise node-pty's winpty step can't run `GetCommitHash.bat`).
- A committed patch (`patches/node-pty@1.1.0.patch`) disables node-pty's
  Spectre-mitigation flag, so the Spectre-mitigated VS libraries aren't required.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/shared/` | Pure IPC contract & data types (no electron/node/dom). |
| `src/core/` | Pure business logic (status mapper, correlator, migrations, throttle, parsers). |
| `src/main/` | Electron main: PtyManager, status server, fs/watch/diff services, notifications. |
| `src/preload/` | Typed `window.api` bridge (contextIsolation on). |
| `src/renderer/` | React + zustand UI: tabs, explorer, terminal, viewer. |
| `e2e/` | Playwright-for-Electron suite driving the built app. |

## Features

### Tabs — one project per tab

Click **+** (or `Ctrl+T`) and pick a folder: Weft spawns `claude --session-id <uuid>`
rooted there and shows it as a tab with a live status badge. The terminal inside
the tab is a normal Claude Code session — type your prompt and press Enter,
exactly as you would running `claude` in a terminal yourself.

**Shell tabs:** hold **Shift** while clicking **+** to open a plain shell
(PowerShell/bash) in the chosen folder instead of Claude — handy for running
builds or git alongside your Claude sessions.

- **Rename:** double-click the tab title, type, Enter (Esc cancels).
- **Reorder:** drag a tab onto another.
- **Close:** the tab's `×` (or `Ctrl+W`) — this terminates the session.
- **Switch:** click, `Ctrl+Tab` / `Ctrl+Shift+Tab` cycle, `Ctrl+1`–`Ctrl+9` jump.
- All other keys — including `Ctrl+C`, arrows, `Ctrl+R` — pass through to the terminal.

### Live status badges (the differentiator)

Each tab shows what its Claude session is doing, derived from **Claude Code's own
lifecycle hooks** — never output scraping:

| Badge | Meaning | Driven by |
| --- | --- | --- |
| ○ unknown | No hook has reported yet (or endpoint down) | default |
| ● working | Claude is processing | `UserPromptSubmit` |
| ‖ waiting | **Blocked on you** (permission, input, idle) | `Notification` types |
| ✓ done | Turn finished | `Stop` / `agent_completed` |
| ✕ error | Failure or non-zero exit | `StopFailure` / PTY exit |

Mechanics: each session is spawned with inline `--settings` JSON registering
observation-only hooks (your `~/.claude/settings.json` is **never modified**).
Hooks run a Weft-generated relay that writes one JSON line to a **local named
pipe** (Unix socket on POSIX) — no TCP, no network. The badge updates within a
second. The working badge pulses; under OS reduced-motion it stays static.

### OS notifications

When a session enters **waiting** or **done** while Weft is unfocused, an OS
toast appears ("my-proj — needs you"); clicking it focuses the window and
activates that tab. Toasts are rate-limited to one per tab per 10s.

### Terminal sessions & reload-safe recovery

The main process owns every PTY; the renderer is a **detachable view**:

- A PTY dies **only** on tab close or process exit — never on renderer reload,
  HMR, or a UI crash. After any reload the app **reconciles**: live sessions are
  re-attached under their original tabs (same process, scrollback replayed from a
  main-side ring buffer, default 200k chars), dead ones are respawned, and any
  live session no tab claims is adopted rather than orphaned.
- A React error boundary catches UI crashes with a reload action — sessions
  keep running behind it.
- Exited sessions render a `[process exited: N]` notice and ignore input safely.
- Drag-resize storms are throttled to ≤1 `pty.resize` per 50ms.

### Tear-off windows

Click a tab's **⤢** to move that project into its own OS window — the PTY stays
in main, so the session never restarts (same PID, scrollback replayed). Closing
the torn-off window re-docks the tab into the main strip; if the main window is
gone, one is revived so a live session is never stranded.

### File explorer

The left panel shows the active project's tree: lazy-expanding directories,
`node_modules`/`.git` hidden. It watches the filesystem (chokidar) — external
creates/deletes/changes appear within ~1s. Single-click a file to open it in
the viewer; double-click to open with the OS default app.

### Monaco viewer & "Diff vs HEAD"

Single-clicking a file opens a read-only Monaco pane over the terminal area.
The **Diff vs HEAD** toggle shows a side-by-side diff of the working file
against its last git commit — untracked files render as all-additions
("Claude created this file"); non-ASCII filenames work. **Reveal** shows the
file in the OS file manager. Files over 5 MB are refused with a friendly error
(use double-click → OS default app for those). Close with `×`; the terminal
beneath is untouched.

### Find in terminal

`Ctrl+Shift+F` opens a search bar over the active terminal (searches scrollback
as you type). **Enter**/↓ next match, ↑ previous, **Esc** closes and puts focus
back in the terminal.

### Workspace persistence

Tabs (title, cwd, command, order), the theme, and the window geometry are saved
to a versioned `electron-store` blob and restored on launch. Restored window
bounds are clamped to the current displays (an unplugged monitor can't strand
the window off-screen). Older blobs migrate through a versioned chain with a
`config.bak` backup written before any upgrade — and also before falling back
from a corrupt blob, so nothing is ever silently lost. Invalid save payloads
are rejected rather than persisted.

### Conversation resume (v0.2.0)

The status-bar **↻ resume** toggle (off by default — resuming spends tokens)
makes restored Claude tabs continue their previous conversation after an app
restart via `claude --resume <sessionId>`. Shell tabs always start fresh.

### Editing files (v0.2.0)

In the viewer, click **Edit**: the file becomes editable, a ● marks unsaved
changes, and `Ctrl+S` writes to disk. Saves are only permitted inside open
project folders and up to 5 MB. The status bar also shows the active
project's git branch (⎇).

### Themes

The status-bar toggle cycles **system → light → dark**. `system` follows the OS
preference live; the choice persists across restarts.

### Error handling

If `claude` isn't on your PATH (or fails to spawn), a banner explains the
problem with a **Retry** button — the app never crashes. If the status endpoint
is unavailable, badges show ○ unknown and the terminal keeps working.
