# CLAUDE.md — weft

Project-specific guidance for Claude Code. The user's global conventions in
`~/.claude/CLAUDE.md` still apply; this file adds what's specific to weft and
**overrides** the global defaults where they differ (e.g. package manager, test
layout).

## What weft is

A cross-platform (Windows-first) Electron desktop app: a VS Code-style shell
around **browser-style tabs of Claude Code CLI sessions** — one tab per project,
each a live interactive `claude` process in its own pseudo-terminal
(node-pty + xterm.js). Adds a file explorer, a Monaco read-only + diff + edit
viewer, tear-off tabs into separate OS windows, workspace persistence, and the
defining differentiator: **per-tab Claude session status (working / waiting /
done / error) driven by Claude Code's own lifecycle hooks — not output
scraping** — plus app-owned OS notifications that focus the right tab.

## Architecture — the layer boundary is the #1 rule

Chosen "Beta worldline": strict separation of pure logic from I/O adapters.
Dependencies point inward only.

- `src/shared/` — pure IPC contract & types (`api-contract.ts`, `channels.ts`,
  `status/hook-events.ts`). No runtime I/O.
- `src/core/` — **pure, framework-free logic**, fully unit-tested via injected
  fakes: status mapping (`status/status-mapper.ts`), correlation, persistence
  schema/migrations/validation, frame parser, ring buffer, throttles, keybinding
  router, fs helpers. No Electron, no `node:*` side effects.
- `src/main/` — thin Electron adapters over core: `services/` (pty-manager,
  status-server, watch/diff/git/fs/notification), `ipc/` (channel registration),
  `platform/` (named-pipe vs UDS seam), `container.ts` (DI). **The PTY and all
  authoritative session state live here.**
- `src/preload/` — the typed `window.api` bridge (a `Pick` of `WeftApi`, so it
  can't drift from the contract). `contextIsolation` is on.
- `src/renderer/` — React 19 + zustand view. **A view over main's truth** — it
  mirrors tabs but never owns PTY state.

**When adding logic, put the decision in `core/` (pure + tested) and keep
`main/` a thin adapter.** Don't reach across the boundary (e.g. no Electron
imports in `core/`, no business rules baked into IPC handlers).

Path aliases (tsconfig + vitest): `@shared/*` → `src/shared/*`,
`@core/*` → `src/core/*`.

### Key invariants (don't regress these)

- **Renderer reload must never kill a PTY.** Terminals `attachSession` /
  `detachSession`; `closeSession` is the only thing that kills a process. See
  spec §4.7 and the reload E2E.
- **Status is hook-driven.** Flow: Claude Code hook → `forward.cjs` →
  `status-server` (named pipe on Windows / UDS on POSIX — **never TCP**) →
  `session-correlator` (by `session_id`, then `tabId`, then `cwd`) →
  `mapHookToStatus` → renderer `setStatus`. Never infer status by scraping
  terminal output.
- **Tab status = `working | waiting | done | error | unknown`.** `unknown` means
  "not observed yet" — never claim a state a hook hasn't reported. The whole tab
  is colored by status (see `documents/completed/tab-state-colors.md`); glyph
  shapes + `aria-label` keep it non-color-only, and animations respect
  `prefers-reduced-motion`.
- **No WebGL xterm renderer** — it removes terminal text from the DOM, breaking
  a11y and all text-based E2E. DOM renderer only (see STEINER_LOG leap 25).
- **Never touch the user's `~/.claude/settings.json`** — hooks are registered
  per-session via inline `--settings` on the `claude` launch.

## Commands

pnpm is the package manager (not npm).

- `pnpm dev` — run the app (electron-vite).
- `pnpm test` / `pnpm test:watch` — vitest.
- `pnpm test:cov` — vitest with coverage (the gate).
- `pnpm test:e2e` — build + Playwright-for-Electron.
- `pnpm typecheck` — `tsc -b` (strict; must be clean).
- `pnpm package` / `pnpm package:dir` — electron-builder (Windows).
- `pnpm rebuild:native` — rebuild node-pty for Electron (needed on Windows; the
  script unsets `NoDefaultCurrentDirectoryInExePath` and a committed patch drops
  the Spectre-mitigation flag — see `reading-steiner.md` lessons).

## Testing conventions

- vitest with two projects: **node** env for `src/{shared,core,main}`, **jsdom**
  for `src/{renderer,preload}` (`*.test.tsx` allowed there).
- Business logic is pure and tested with injected fakes (FakePty, fake platform,
  fake store) — fast, no real I/O.
- Coverage gate (`vitest.config.ts`): **95% statements/functions/lines, 90%
  branches**, over `core/**`, `main/services/**`, `main/ipc/**`, stores, and a
  couple of renderer components. Native/IO adapters (`pty-factory`,
  `platform/**`) and bootstrap/type-only files are excluded — they're covered by
  E2E, not the unit gate.
- Per global conventions: **add tests with every feature/bug fix; add a
  regression test for every bug; keep the suite green before committing.** For
  DOM/xterm-bound UI, prefer E2E over brittle unit tests (`TerminalPane` is
  deliberately E2E-only).
- `hook-forwarder.integration.test.ts` runs the real forwarder in a child
  process; it now deletes `CLAUDE_IDE_TAB` from the child env before applying any
  per-test override, so the suite is hermetic even when run **inside a live
  weft/Claude Code session** (which used to leak a real `CLAUDE_IDE_TAB` and fail
  the null-stdin case). Keep that delete when editing `runRelay`.

## Documents & the /dmail "Steiner" workflow

This project is built via the `/dmail` autonomous loop. Some markdown files are
**live loop state — do not move or rename them**, or a future `/dmail` run breaks:

- `reading-steiner.md` — loop state (25+ required fields). Don't hand-edit its
  mechanics (`leap_count`, `current_focus`, `spec_path`, …) for manual work.
- `documents/steiner-spec.md` — the authoritative spec + acceptance criteria,
  read via `spec_path`. Append checked criteria for shipped work; number new
  autonomous sections `## Expansion N` (N = cycle). Manual, out-of-loop work goes
  in a clearly-labeled addendum, **not** an `Expansion N` heading.
- `STEINER_LOG.md` — running log, newest on top.
- `DOSSIER.md` — status + acceptance snapshot. `USAGE.md` — operating manual.

Human feature docs follow the global New Feature Workflow: created under
`documents/`, moved to `documents/completed/` when done (e.g.
`documents/completed/design-doc.md`, `documents/completed/tab-state-colors.md`).
The loop is currently parked at `el-psy-kongroo` (v0.2.0 shipped); next-worldline
candidates: split panes, LSP, macOS/Linux builds.

## Maintaining this file

Update CLAUDE.md when architecture, the layer boundary, scripts, the coverage
gate, or the invariants above change.
