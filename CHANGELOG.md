# Changelog

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
