# Terminal file links — Ctrl+Click a path to open it in the viewer

## Feature specification

Claude Code (and most CLI tools) frequently print file paths in the terminal —
often with a line/column suffix, e.g. `src/core/status/status-mapper.ts:42:7`.
Today those are inert text. This feature makes them **clickable, like VS Code**:
hold **Ctrl** (⌘ on macOS) and the recognized path underlines; **Ctrl+Click**
opens that file in Weft's Monaco viewer and, when a `:line[:col]` suffix is
present, scrolls to and places the cursor at that position.

## Scope

In scope:

- Detect file-path tokens in terminal output: absolute (`C:\a\b.ts`, `C:/a/b.ts`,
  `/usr/a/b.ts`) and relative (`src/x.ts`, `./x.ts`, `..\y\z.ts`, bare
  `README.md`), each with an optional `:line` or `:line:col` suffix.
- Resolve relative tokens against the **active tab's cwd** (the terminal's
  project root).
- Only tokens that resolve to a **real file inside the tab's project root**
  become links (existence-validated, root-guarded) — random words never light up.
- Underline + pointer cursor appear **only while Ctrl/Cmd is held** (VS Code
  behaviour); normal terminal use, selection, and passthrough are unaffected.
- **Ctrl/Cmd+Click** opens the file in the viewer and jumps to `line:col`.

Out of scope (explicitly):

- URLs / http links in the terminal (a separate concern; not added here).
- Paths outside the project root (system files) — rejected by design, matching
  Weft's existing trust model (reads/writes are confined to open roots).
- Line/col jumping in non-text viewer surfaces (image/pdf/csv/etc.) — only the
  Monaco text path reveals a position; other kinds just open.
- Multi-line / wrapped-path reconstruction — a token must lie on one buffer row.
- Quoted paths containing spaces — v1 matches unspaced tokens only.

## User stories

- As a developer, I want to Ctrl+Click a path Claude printed so that I jump
  straight to that file without retyping it into quick-open.
- As a developer, I want `file:line:col` to land me on the exact line so I can
  see the code Claude is referring to.
- As a keyboard-and-mouse user, I want paths to only become clickable while I
  hold Ctrl, so ordinary click-to-select in the terminal still works.

## Acceptance criteria

- [x] Hovering a printed, existing project path **with Ctrl held** underlines it
      and shows a pointer cursor; releasing Ctrl removes the affordance.
- [x] Ctrl+Click on `src/x.ts` opens `<cwd>/src/x.ts` in the viewer.
- [x] Ctrl+Click on `src/x.ts:42:7` opens the file and reveals line 42, col 7.
- [x] A plain (no-modifier) click never opens a file and never steals selection.
- [x] A token that does not resolve to an existing file inside the tab's root is
      not a link (no underline, no-op on click).
- [x] Absolute paths inside the project resolve and open; absolute paths outside
      any project root do not become links.
- [x] Pure parsing/resolution logic lives in `core/` with full unit tests;
      `TerminalPane` stays a thin adapter (E2E-covered, per repo convention).
- [x] `pnpm typecheck` clean; coverage gate (95/90) stays green.

## Architecture & technical design

Respects the strict layer boundary (decisions in `core/`, `main/` a thin
adapter, renderer a view).

### core/ (pure, unit-tested)

- **`core/terminal/file-link.ts`** — `parseFileLinks(line: string): FileLinkMatch[]`.
  Scans a single terminal-buffer row for path-like tokens and returns, for each,
  `{ start, end, path, line?, column? }` (0-based half-open char offsets into the
  row; `path` is the raw token minus any `:line:col` suffix and trailing
  punctuation). Deliberately liberal about *shape* (accepts relative, absolute,
  Windows/POSIX separators, bare `name.ext`); **truth about existence is decided
  later** by the main-process check, so the parser never needs a filesystem.
  A token must contain a path separator **or** a dotted filename to qualify, to
  keep the candidate set small.

- **`core/fs/path-resolve.ts`** — `resolveClickedPath(cwd, token): string`.
  Returns the token unchanged when it is absolute (drive-letter, or leading
  `/`\`\`); otherwise joins it onto `cwd` and collapses `.`/`..` segments. Pure
  string logic, separator-aware (mirrors `path-guard.ts`), so it runs in the
  renderer without `node:path`.

- Reuses **`core/fs/path-guard.ts`** `isPathInside(cwd, resolved)` for the
  in-root gate.

### main/ (thin adapter)

- New IPC channel **`fs:path-exists`** (`CH.pathExists`). Handler in
  `register-fs.ts` confines the path to open roots and returns a boolean via an
  injected `exists: (path) => Promise<boolean>` dependency (same pattern as the
  existing `reveal`/`open` callbacks — no change to `FsService`/`FsLike`). The
  container passes `(p) => fsp.stat(p).then(s => s.isFile(), () => false)`.
  Returns `false` (not a rejection) for a missing path or one outside any root,
  so it is a clean predicate for link display.

### preload/

- `WeftApi.pathExists(path): Promise<boolean>` added to the contract and the
  `WeftBridge` `Pick`; `create-bridge.ts` routes it to `CH.pathExists`.

### renderer/

- **`viewer-store.ts`** — new action `openFileAt(path, name, line?, column?)`
  (opens via the same core reducer as `openFile`, clearing any git side) and a
  new transient field `reveal: { path, line, column, tick } | null` set when a
  position is supplied. `openFile` is unchanged (Explorer/quick-open keep using
  it). A `tick` makes repeat jumps to the same file distinct.

- **`ViewerPane.tsx`** — after the Monaco editor mounts for the active file, and
  whenever `reveal` changes for the currently-active text file, call
  `editor.revealLineInCenter(line)` + `setPosition({ lineNumber, column })` +
  `focus()`. Guarded to `mode==='view'` text (not diff/preview/rich kinds).

- **`TerminalPane.tsx`** — in the mount effect, `term.registerLinkProvider(...)`:
  - `provideLinks(y, cb)`: if Ctrl/Cmd is **not** currently held, return no links
    (so no work and no affordance). Otherwise read the row text
    (`buffer.active.getLine(y-1).translateToString()`), run `parseFileLinks`, and
    for each candidate `resolveClickedPath(tabCwd, token)` → `isPathInside(tabCwd,
    resolved)` → `await window.api.pathExists(resolved)`. Return an `ILink` per
    surviving match with `range` (1-based xterm coords), `decorations:
    { pointerCursor: true, underline: true }`, and an `activate` that opens via
    `useViewerStore.getState().openFileAt(resolved, basename, line, column)` only
    when `event.ctrlKey || event.metaKey`.
  - A window `keydown`/`keyup` listener tracks Ctrl/Cmd in a ref and, on change,
    re-dispatches a synthetic `mousemove` at the last pointer position so xterm
    re-queries the provider and the underline appears/disappears without moving
    the mouse.
  - `tabCwd` is read from `useSessionStore.getState().tabs` by `tabId`.

## Data flow

```
Claude prints "src/x.ts:42:7"
  → user holds Ctrl, hovers
    → xterm provideLinks(row) → parseFileLinks → resolveClickedPath(cwd)
      → isPathInside(cwd, resolved) → window.api.pathExists (fs:path-exists, root-guarded)
        → ILink underlined
  → Ctrl+Click → activate → useViewerStore.openFileAt(resolved, "x.ts", 42, 7)
    → ViewerPane mounts Monaco → revealLineInCenter(42) + setPosition(42,7)
```

## Security considerations

- The existence check is **root-guarded** in main (`isInsideAnyRoot`), so the
  renderer cannot probe arbitrary paths for existence; and the link gate itself
  restricts candidates to the tab's own cwd. Opening reuses the existing
  (unguarded-read but display-only) `readFileText` path already used by the
  Explorer, so no new read surface is introduced.
- No new external I/O, no shell, no network.

## Performance considerations

- Existence checks only fire while Ctrl is held **and** the mouse is over a row —
  a handful of `stat`s per hovered line, not per keystroke or per frame.
- Parsing is a single regex pass over one buffer row.

## Edge cases & error handling

- Token with trailing punctuation (`(src/x.ts)`, `src/x.ts.`, `"src/x.ts"`) —
  parser strips wrapping/trailing punctuation before resolving.
- `:line` with no column → column defaults to 1. Non-numeric suffix → treated as
  part of the path (e.g. Windows `C:` drive colon is not a line suffix).
- Out-of-range line number → Monaco clamps (no throw).
- File deleted between hover and click → `openFileAt` opens, `readFileText`
  rejects, ViewerPane shows its existing "Cannot open file" error.
- Terminal reload/detach → provider is torn down with the terminal; no leak
  (listeners removed in cleanup).

## Testing strategy

- **Unit (core):** `file-link.test.ts` — relative/absolute/Windows/POSIX, bare
  `name.ext`, `:line`/`:line:col` suffixes, trailing punctuation, Windows drive
  colon not mistaken for a line suffix, non-path words rejected, multiple tokens
  per line with correct offsets. `path-resolve.test.ts` — absolute passthrough,
  relative join, `.`/`..` collapsing, separator styles.
- **Unit (main):** `register-fs.test.ts` — `pathExists` returns the injected
  result inside a root, `false` outside a root, `false` on stat failure.
- **Unit (preload):** `create-bridge.test.ts` — `pathExists` routes to the channel.
- **Unit (renderer):** `viewer-store.test.ts` — `openFileAt` opens the file and
  sets `reveal` (with/without a position; tick increments).
- **E2E / manual:** Ctrl+hover underline, Ctrl+Click open + line jump, plain
  click no-op (TerminalPane is E2E-only per repo convention).

## Dependencies

None new. Uses xterm's built-in `registerLinkProvider` (no `addon-web-links`).

## Migration & rollback plan

Purely additive: new channel, new store action/field, new core modules. No
persistence/schema change. Rollback = revert the commit.

## Open questions

- None blocking. (Resolved with the user: jump to line/col = yes; links limited
  to inside the project root; underline only while Ctrl held.)

## Todo

- [x] `core/terminal/file-link.ts` + tests
- [x] `core/fs/path-resolve.ts` + tests
- [x] `fs:path-exists` channel + contract + bridge + main handler + tests
- [x] `container.ts` wire `exists`
- [x] `viewer-store` `openFileAt` + `reveal` + tests
- [x] `ViewerPane` reveal-on-mount / reveal-on-change
- [x] `TerminalPane` link provider + modifier tracking
- [x] typecheck + full test suite green; update CLAUDE.md invariants
- [x] E2E: `e2e/terminal-links.spec.ts` (Ctrl+Click opens the file)

**Status: complete.** All acceptance criteria met; 893 unit tests + the new E2E
green; `pnpm typecheck` clean; coverage gate held (98.94% st / 96.49% br).
