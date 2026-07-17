# Weft

**A VS Code-style desktop workspace for running many Claude Code sessions at once — one browser-style tab per project, with live "which session needs me?" status driven by Claude Code's own hooks.**

Weft is an open-source Electron app (Windows-first, cross-platform-clean). Each tab hosts a real, interactive `claude` CLI session in its own ConPTY pseudo-terminal. Around the terminals: a live file explorer, a Monaco read-only + git-diff viewer, tear-off tabs into separate OS windows, workspace persistence, and app-owned OS notifications that focus the exact tab that needs you.

**The differentiator:** per-tab session status (● working · ‖ waiting-on-you · ✓ done · ✕ error) comes from **Claude Code lifecycle hooks over a local named pipe** — never from scraping terminal output. Your personal `~/.claude/settings.json` is never touched; hooks are injected per-session via `--settings` (which merges, session-only). No TCP ports, no telemetry.

## Quick start

> **Heads-up:** Weft currently runs **from source** — there's no packaged installer yet. The steps below assume a terminal (PowerShell on Windows).

**Prerequisites (install these first):**
1. **Node.js 20+** — https://nodejs.org (the installer adds `node` to your PATH).
2. **pnpm** — after Node is installed: `npm install -g pnpm`
3. **Claude Code CLI** — https://claude.com/claude-code · verify with `claude --version` (a version number means you're ready).
4. **Windows only, for the native terminal module:** [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/?q=build+tools) → in the installer, tick the **"Desktop development with C++"** workload (multi-GB download), plus Python 3.x (`winget install Python.Python.3.12`).

**Get and run Weft:**

```bash
git clone <this-repo-url> && cd weft   # or download + extract the source, then open a terminal in the weft folder
pnpm install          # deps + Electron binary
pnpm rebuild:native   # builds node-pty against Electron's ABI (one time)
pnpm dev              # launch
```

Then click **+**, pick a project folder, and a `claude` session opens in that tab — talk to Claude there exactly as you would in a normal terminal.

## Test coverage

**212 unit/integration tests + 19 Playwright-Electron E2E tests** · 97.9% statement / 96.3% branch coverage.
The E2E suite drives the real built app: PTY round-trips, hook-payloads-over-the-pipe → badge flips, renderer-reload session survival (same PID), tear-off/re-dock, restart persistence, and a live-relay integration test that executes the actual hook forwarder against a real named pipe.

```bash
pnpm test        # unit + integration (vitest)
pnpm test:cov    # with coverage gate (95% statements)
pnpm test:e2e    # builds, then drives the real Electron app (Playwright)
```

## Session resilience (the design guarantee)

PTYs live in the **main process**; the renderer is a detachable view. A UI reload, HMR update, or renderer crash **never** kills a session — the terminal re-attaches and replays its scrollback from a main-side ring buffer. Tear-off works the same way: the window moves, the PTY doesn't.

## Documentation

See [USAGE.md](USAGE.md) for the full manual and [DOSSIER.md](DOSSIER.md) for project status/decisions. The build spec lives in `documents/steiner-spec.md`.

## License

MIT
