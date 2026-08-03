# CLAUDE.md — weft

Project-specific guidance for Claude Code. The user's global conventions in
`~/.claude/CLAUDE.md` still apply; this file adds what's specific to weft and
**overrides** the global defaults where they differ (e.g. package manager, test
layout).

## What weft is

A cross-platform (Windows-first) Electron desktop app: a VS Code-style shell
around **browser-style tabs of Claude Code CLI sessions** — one tab per project,
each a live interactive `claude` process in its own pseudo-terminal
(node-pty + xterm.js). Adds a VS Code-style activity bar with swappable sidebar
panels — **Explorer**, **Source Control** (git), **GitHub Issues**, **Usage** —
a format-aware Monaco read-only + diff + edit viewer (syntax-highlighted via
`basic-languages`, theme-following, with a rendered Markdown preview),
tear-off tabs into separate OS windows, workspace persistence, and the
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
  router, fs helpers, git-status parsing (`scm/porcelain.ts`), viewer kind/URL/
  delimited/workbook logic (`viewer/*`), GitHub parsers (`github/*`). No Electron,
  no `node:*` side effects.
- `src/main/` — thin Electron adapters over core: `services/` (pty-manager,
  status-server, watch/diff/git/fs/notification, spreadsheet, file-protocol,
  github/github-auth), `ipc/` (channel registration), `platform/` (named-pipe vs
  UDS seam), `container.ts` (DI). **The PTY and all authoritative session state
  live here.**
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
- **Every tab's terminal stays mounted; switching tabs only toggles visibility.**
  `App.tsx` renders one `TerminalPane` per tab (not `key={activeTabId}`) and hides
  the inactive ones via the `hidden` attribute (`.terminal-pane[hidden]`), so a
  tab switch never disposes+rebuilds xterm from the lossy ring-buffer snapshot —
  that replay path is reserved for genuine reload/HMR recovery. `applyFit` no-ops
  while a host is hidden (0-sized) and an activation effect re-fits + `resizeSession`
  when a tab becomes visible. Guarded by `e2e/terminal-keepalive.spec.ts`.
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
- **Terminal file links are Ctrl+Click, existence- and root-guarded**
  (`documents/completed/terminal-file-links.md`). `TerminalPane` registers an
  xterm `registerLinkProvider` that offers links **only while Ctrl/⌘ is held**
  and **only** for tokens that resolve to a real file **inside the active tab's
  cwd**. Detection/resolution are the pure, unit-tested
  `core/terminal/file-link.ts` (`parseFileLinks`) + `core/fs/path-resolve.ts`
  (`resolveClickedPath`); existence is the root-guarded `fs:path-exists` channel
  (an injected `exists` fn in `container.ts`, like `reveal`/`open`, returns
  `false` — never throws — outside a root). Ctrl+Click calls
  `viewer-store.openFileAt(path, name, line?, col?)`, which opens the file and
  sets a transient `reveal` target that `ViewerPane` applies to Monaco
  (`revealLineInCenter` + `setPosition`) for `file:line:col` jumps. The wiring is
  E2E-only (`e2e/terminal-links.spec.ts`), like the rest of `TerminalPane`.
- **The viewer is format-aware** (`documents/rich-file-viewer.md`).
  `core/viewer/file-kind.ts` maps a filename to a `ViewerKind`
  (`text|image|pdf|spreadsheet|csv|audio|video|binary`); unknown → `text`, so
  text viewing never regresses. `ViewerPane` renders text in Monaco and every
  other kind on its own surface (`ImageView`/`PdfView`/`MediaView`/`CsvView`/
  `SpreadsheetView`/`UnsupportedView`, the latter offering "open with default
  app"/"reveal" instead of dumping bytes). Image/PDF/audio/video bytes stream
  from the **`weft-file://` custom scheme** (registered privileged in `index.ts`;
  request logic is the pure, unit-tested `handleFileRequest` in
  `services/file-protocol.ts`, wired via `protocol.handle` in `container.ts`) —
  **path-guarded to open project roots** (`isInsideAnyRoot`), never `bypassCSP`;
  the CSP in `index.html` allows it for `img/media/frame/object-src`. URL
  build/decode lives in `core/viewer/file-url.ts`. **Parsing splits by kind:**
  spreadsheets (xlsx/xls/xlsm/xlsb) parse in **main** (`SpreadsheetService` +
  `core/viewer/workbook.ts` caps, 25 MB guard) over the `readSpreadsheet` IPC
  channel — SheetJS is **optional, dynamically imported only in `container.ts`**
  (absent → `readSpreadsheet` rejects with an actionable message; every other
  kind still works); CSV/TSV parse in the **renderer** (pure
  `core/viewer/delimited.ts` over the existing `readFileText`). Never route
  binary bytes through Monaco.
- **Source control is shelled-out git, guarded per root**
  (`documents/completed/source-control-panel.md`). The `scm` sidebar panel shows
  the active tab's working-tree changes (staged/unstaged/untracked/conflict
  groups, commit, push/pull, discard). All git runs through `GitService` over an
  **injected `ExecFn`** — no libgit2/isomorphic-git. `git status --porcelain=v2
  -z` parsing lives only in the pure `core/scm/porcelain.ts` (`parseStatus`,
  `changeCount`); `main/ipc/register-scm.ts` owns the `scm:*` channels.
  **Two error contracts by design:** reads degrade (a non-repo cwd resolves
  `{ isRepo: false }`, never rejects) so the panel renders an empty state;
  **mutations reject with git's stderr** and every mutating channel confines
  `cwd` and each affected path to an open project root (`isInsideAnyRoot` /
  `isPathInside`, same guard as `saveFile`). Per-side diffs come from
  `DiffService.gitFileDiff(path, side)` (`unstaged`→index-vs-working,
  `staged`→HEAD-vs-index, `untracked`→empty-vs-disk). Status is polled while the
  panel is active plus an eager refresh after each mutation (no git watcher);
  single-root only. **Discard is irreversible — gate it behind `ConfirmDialog`.**
- **GitHub Issues + device-flow OAuth keep the token in main only**
  (`documents/completed/github-issues-panel.md`). The `issues` panel lists the
  active repo's issues (repo detected from the `origin` remote) and can **create
  a new issue** (title/body/labels) via a `POST /repos/{owner}/{repo}/issues`
  from `GithubService.createIssue` over the `github:create` channel
  (`documents/completed/create-github-issue.md`) — auth-required, returns
  `{ issue } | { error }` (never throws, like the rest of the service), and
  invalidates the per-repo cache on success. Sign-in runs the
  **entire device flow in the main process** (`GithubAuthService`): it opens
  github.com via `shell.openExternal`, background-polls for the token, persists
  it in electron-store (`githubToken`), and pushes a `github:auth` event to the
  renderer — **the token is never sent over IPC**. Auth resolves `gh auth token`
  → `GITHUB_TOKEN` env → stored OAuth token → unauthenticated. The OAuth **client
  id is public and committed** (`core/github/client-id.ts`; device grant carries
  no secret, so shipping it is expected) and overridable via
  `WEFT_GITHUB_CLIENT_ID`. All GitHub JSON goes through defensive pure parsers
  (`core/github/*`) that skip malformed entries and never throw; `openExternal`
  is restricted to `http(s)` via `isSafeExternalUrl`.
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
