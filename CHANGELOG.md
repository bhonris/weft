# Changelog

## Unreleased

- **Model & effort in the status bar.** A Claude Code tab now shows which model
  and reasoning-effort tier the session is running — e.g. `✦ Opus 4.8 · High` —
  read from the session's own transcript (authoritative, not scraped). It
  updates on turn boundaries and tab switches, and is hidden for shell tabs or
  before the first turn.
- **Go to File (`Ctrl+Shift+O`).** A VS Code-style fuzzy file finder over the
  active project: type part of a filename or path, **↑/↓** to move, **Enter** to
  open it in the viewer, **Esc** to cancel. Also runnable from the command
  palette ("Go to File…"). It lives on `Ctrl+Shift+O`, not `Ctrl+P`, because
  plain `Ctrl+P` is reserved for the terminal (shell / Claude Code history) and
  always passes through; like every chord it's rebindable. The index skips
  `node_modules`/`.git`, never follows symlinks, and is confined to the open
  project root.
- **`Ctrl+W` now closes the open file, not the project.** Intra-project: `Ctrl+W`
  closes the active editor file (a no-op when none is open). Closing a whole
  project tab — which terminates its Claude session — moves to `Ctrl+Shift+W` and
  now asks for confirmation first (as does the tab's `×` button), so a stray
  keystroke can't kill a running session.
- **In-project split workspace.** Open multiple files as editor tabs, with the
  Claude CLI now always visible in a dock pane beside them (it no longer gets
  hidden when you open a file). The dock is moveable (bottom / right / left via
  the **Move CLI Dock** command), resizable (drag the divider or arrow-key it),
  and its placement persists across restarts (workspace schema v4 → v5). With no
  file open the CLI fills the whole area, as before.
- **Remappable keybindings.** Open the command palette → **Edit Keybindings…** to
  rebind any shortcut: press a new key combo, and it applies live and persists
  across restarts (workspace schema v3 → v4). Reserved terminal keys (`Ctrl+C`,
  arrows, function keys, …) can never be bound — they always reach the shell;
  conflicts warn and reassign; **Reset all** / per-command reset restore defaults.
  Under the hood the keyboard dispatch was unified (chords resolve to a single
  command handler) and made data-driven over an editable keymap.
- **Notifications on/off switch.** A status-bar toggle (`🔔 notify on` /
  `🔕 notify off`) and a **Toggle Notifications** command mute or restore Weft's
  OS toasts (the "session needs you / finished" popups). The choice persists
  across restarts (workspace schema v2 → v3) and defaults to on. The tab
  color/badge signal stays live even when toasts are muted. Enforced centrally
  in the main process, so all windows honor one setting and a toggle takes
  effect without a restart.
- **Fix: tab stuck on `waiting` (amber) after approving a permission prompt.**
  Answering a permission prompt fires no `UserPromptSubmit`, so the tab never
  returned to `working` until the next `Stop`. Weft now also reports the
  `PostToolUse` hook and maps it to `working`, so the tab flips back to the
  running color the moment the approved tool executes.

## 0.2.0 — "Daily Driver" — 2026-07-18

The declared end-goal release: Weft becomes strictly better than a bare
terminal for daily Claude work. 229 unit/integration + 24 Playwright-Electron
E2E tests, all green.

- **Conversation resume** — each tab persists its real pinned `sessionId`
  (workspace schema v2, migrated automatically with backup). With the
  status-bar **↻ resume** toggle on (opt-in, persisted), restored Claude tabs
  relaunch with `--resume <sessionId>` and continue the prior conversation.
  Resume ids are strictly validated so flag-shaped strings can never reach
  claude's argv.
- **Edit in the viewer** — the Monaco pane gains an **Edit** mode: type, see a
  dirty ● indicator, `Ctrl+S` saves through a guarded IPC that only writes
  inside open project roots (path-containment check defeats
  `C:/proj-evil`-style lookalikes) and caps content at 5 MB.
- **Git branch in the status bar** — ⎇ branch for the active project (blank
  outside repos, `(detached)` at a detached HEAD).
- **Leaner dependencies** — removed unused `dockview`,
  `@xterm/addon-webgl`, `@xterm/addon-serialize`.

## 0.1.0 — 2026-07-18

First working release. Built autonomously by the Future Gadget Lab (D-Mail loop),
25 leaps across 4 expansion cycles. 214 unit/integration tests + 23
Playwright-Electron E2E tests (including one that drives the packaged
`Weft.exe`), ~98% statement coverage.

### Core

- **Tabbed Claude Code sessions** — one project per tab; each tab runs a real
  interactive `claude` CLI in its own ConPTY pseudo-terminal (node-pty + xterm.js).
- **Hook-driven status badges** (the differentiator) — ○ unknown · ● working ·
  ‖ waiting-on-you · ✓ done · ✕ error, derived from Claude Code lifecycle hooks
  delivered over a local **named pipe** (UDS on POSIX; never a TCP port; the
  user's `~/.claude/settings.json` is never touched).
- **Session resilience (§4.7 guarantee)** — PTYs live in the main process; a
  renderer reload/HMR/crash never kills a session. On reload the app
  *reconciles*: live sessions re-attach (same PID, scrollback replayed from a
  ring buffer), dead ones respawn, unclaimed live ones are adopted.
- **Tear-off windows** — move a tab to its own OS window with the same PTY;
  re-docks on close; a main window is revived if needed.
- **App-owned OS notifications** — waiting/done while unfocused → toast; click
  focuses the exact window and tab; rate-limited per tab.
- **File explorer** — lazy tree, live chokidar watching (~1s reflection),
  node_modules/.git hidden.
- **Monaco viewer + Diff vs HEAD** — read-only view, side-by-side git diff,
  Reveal-in-OS, 5 MB guard, non-ASCII filename support.
- **Workspace persistence** — tabs/titles/order/theme/window-bounds in a
  versioned electron-store blob with migrations, `config.bak` backups, save
  validation, and display-aware bounds clamping.
- **Keyboard layer** — Ctrl+T/W/Tab/1..9 chords with strict PTY passthrough for
  everything else; Ctrl+Shift+F in-terminal search; Shift+Click + for plain
  shell tabs.
- **Themes** — system/light/dark, persisted; reduced-motion respected.
- **Error states** — claude-not-found banner with Retry; unknown badges when
  the status endpoint is down; exited-session notices; spawn-arg validation at
  every IPC boundary.

### Tooling

- electron-vite build; vitest (95%+ coverage gate); Playwright-for-Electron E2E
  driving the real app and the packaged exe; electron-builder NSIS packaging
  (node-pty asar-unpacked); GitHub Actions CI (win+linux matrix); MIT license;
  reproducible node-pty Electron rebuild (`pnpm rebuild:native`) with a
  committed Spectre-flag patch.

### Notable engineering decisions

- WebGL terminal rendering was trialled and **rejected**: it removes terminal
  text from the DOM, breaking assistive-technology access and automated
  verification alike (all text-assertion E2E went dark). DOM renderer retained.
- Status endpoint is a named pipe/UDS by design — never TCP.
- The E2E suite tests through the real UI path after an api-level reload test
  masked a session-respawn bug (worldline 1 review).
