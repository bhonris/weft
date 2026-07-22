# Quick File Open (VS Code-style "Go to File")

## Feature specification

A keyboard-driven fuzzy file finder — the analogue of VS Code's `Ctrl+P` — that
lets the user jump to any file in the active project without leaving the
keyboard. Pressing the shortcut opens a modal over the workbench; typing
fuzzy-filters the project's files by their path; ↑/↓ move the highlight; Enter
opens the highlighted file in the read-only/diff/edit viewer; Esc closes.

It reuses the existing command-palette machinery almost wholesale: the same
overlay + combobox/listbox a11y model, the same pure `fuzzyFilter` ranker (whose
separators already include `/`, `.`, `_`, `-`, so it scores paths well), and the
same `viewer-store.openFile(path, name)` the Explorer already uses to open a
file. The one genuinely new capability is a **recursive directory walk** — today
`FsService` only lists one level (`listDir`).

### Why not `Ctrl+P`?

VS Code binds this to `Ctrl+P`, but weft **cannot**: plain-`Ctrl` chords are
reserved for the terminal/PTY (readline + Claude Code use `Ctrl+P` for "previous
history", `Ctrl+R` for reverse-search, etc.). The keybinding router's
`isProtectedChord` (`src/core/keybindings/keymap.ts`) refuses to bind any plain
`Ctrl+<key>` outside a tiny allowlist, precisely to preserve the spec §7.4
passthrough invariant. All app chords live on `Ctrl+Shift+*`, which the terminal
never consumes. The command palette is `Ctrl+Shift+P`; the file finder is the
sibling **`Ctrl+Shift+O`** ("Open file"), and it is fully rebindable through the
existing keybindings editor.

## Scope

In scope:

- A `Ctrl+Shift+O` global chord + a `general.quickOpen` command (also runnable
  from the command palette).
- A `QuickOpen` overlay component (fuzzy file finder).
- A recursive, ignore-pruned file index for the **active tab's project root**.
- Open the chosen file via the existing viewer store.

Out of scope (explicitly NOT covered by this feature):

- Searching across **all** open project roots (scoped to the active tab only).
- Searching file **contents** (this is filename/path only — no ripgrep).
- Symbol search (VS Code's `Ctrl+Shift+O` go-to-symbol) or line jumps (`:123`).
- A persistent/cached index or a filesystem watcher keeping it fresh — the index
  is rebuilt each time the palette opens (fast enough for typical projects;
  bounded by caps below).
- Recently-opened ordering / MRU boosting.
- Respecting `.gitignore` beyond the existing `DEFAULT_IGNORES` set.

## User stories

- As a developer with a large project open, I want to press `Ctrl+Shift+O`, type
  a few characters of a filename, and open it, so that I don't have to expand the
  Explorer tree by hand.
- As a keyboard-only user, I want the finder to be fully navigable and
  screen-reader friendly (combobox + listbox, arrow keys, focus restore), so that
  it matches the rest of weft's a11y model.
- As a user who dislikes the default shortcut, I want to rebind it, so that it
  fits my muscle memory.

## Acceptance criteria

- [ ] `Ctrl+Shift+O` opens the finder when no overlay is already open; it does not
  fire while the terminal-focused user is mid-keystroke of a plain-Ctrl combo
  (i.e. `Ctrl+P`, `Ctrl+R`, … still reach the PTY untouched).
- [ ] `general.quickOpen` appears in the command palette as "Go to File…" with the
  `Ctrl+Shift+O` hint, and running it opens the finder.
- [ ] Typing fuzzy-filters the file list by path; best matches rank first.
- [ ] ↑/↓/Home/End move the highlight; Enter opens the highlighted file; Esc
  closes without opening anything; clicking the backdrop closes.
- [ ] Opening a file shows it in the viewer (same as double-clicking in Explorer).
- [ ] The index excludes `node_modules`, `.git`, `.hg`, `.svn` (the existing
  `DEFAULT_IGNORES`).
- [ ] With no project open, the finder shows a clear empty state rather than
  erroring.
- [ ] The recursive walk cannot hang on symlink cycles and is bounded in both
  depth and file count.
- [ ] Reads are confined to open project roots (main rejects a walk rooted
  outside any open project).
- [ ] `pnpm typecheck` clean; `pnpm test:cov` green at the 95%/90% gate.

## Architecture & technical design

Respecting the layer boundary (decision in `core`, thin adapter in `main`):

- **core (`src/core/fs/dir-sort.ts`)** — reuse `isIgnored` for pruning.
- **main (`src/main/services/fs-service.ts`)** — new
  `listFilesDeep(root, opts?)` orchestrates the recursive `readdir` walk over the
  injected `FsLike`. Prunes ignored dir names, does **not** follow symlinks
  (lists them as plain openable entries, never recurses through them — cycle
  safety), and caps at `maxDepth` (default 24) and `maxFiles` (default 20000).
  Returns `IndexedFile[]` = `{ name, path, rel }`, sorted by `rel`
  case-insensitively. Tested with a fake `FsLike`.
- **shared (`src/shared/ipc/*`)** — new `IndexedFile` type, `fs:list-deep`
  channel, `listFilesDeep(root)` on `WeftApi` + the `WeftBridge` `Pick`.
- **main IPC (`src/main/ipc/register-fs.ts`)** — `CH.listFilesDeep` handler,
  arg-validated and confined to `getWritableRoots()` (mirrors the `saveFile`
  guard) so the semi-trusted renderer can't walk arbitrary directories.
- **preload (`src/preload/create-bridge.ts`)** — bridge method.
- **keybinding/command (`core`)** — `ctrl+shift+o → { kind: 'quick-open' }`,
  a `quick-open` `KeyAction`, a `general.quickOpen` command, and both directions
  of `action-dispatch`. The exhaustive `commandIdForAction` switch turns the new
  action kind into a compile error until it's mapped — the intended extension
  path.
- **renderer** — `QuickOpen.tsx` (near-clone of `CommandPalette.tsx`) fetches the
  index on open (injectable `loadFiles` for tests), fuzzy-filters over `rel`,
  and calls `onOpen(path, name)`. `App.tsx` adds `'quickOpen'` to the overlay
  union, a `runCommand` case, and renders the component wired to
  `viewer-store.openFile`.

Data flow: `Ctrl+Shift+O` → `routeKey` → `{kind:'quick-open'}` →
`commandIdForAction` → `general.quickOpen` → `runCommand` → `setOverlay('quickOpen')`
→ `QuickOpen` fetches `window.api.listFilesDeep(activeTab.cwd)` → fuzzy filter →
Enter → `viewer.openFile`.

## API contract

New IPC method on `WeftApi` (request/response, `invoke`/`handle`):

```ts
listFilesDeep(root: string): Promise<IndexedFile[]>
// IndexedFile = { name: string; path: string; rel: string }
```

Channel: `fs:list-deep`. Main rejects (`throw`) when `root` is not a string or
is outside every open project root. On success returns the capped, sorted list.

## Database changes

None. No persistence; `WorkspaceState` is unchanged (the binding, if rebound, is
already covered by the existing `keymapOverrides`).

## UI/UX considerations

- Reuses the `.palette-*` overlay styling; adds a `.palette__opt-path` muted
  secondary line for the directory path. File name is the primary label.
- States: **loading** ("Indexing files…"), **empty/no-match** ("No matching
  files"), **no project** ("Open a project to search its files").
- a11y: combobox + listbox, `aria-activedescendant`, focus trap on the input,
  focus restore on close, backdrop click to dismiss — identical to the palette.
- Respects the modal-owns-keyboard rule (`overlayOpenRef`) so the global chord
  listener stands down while it's open.

## Security considerations

- Reads confined to open project roots via `isInsideAnyRoot(getWritableRoots())`
  — the renderer cannot enumerate arbitrary directories.
- No content is read (paths only). Symlinks are not followed, so the walk can't
  escape the root via a symlink to `/` or cycle forever.

## Performance considerations

- Rebuilt per-open; bounded by `maxDepth` (24) and `maxFiles` (20000) so a
  pathological tree can't hang the main process. Ignored dirs (`node_modules`)
  are pruned before recursion, which removes the dominant cost in JS projects.
- Fuzzy filtering is synchronous over the in-memory list; sized for tens of
  thousands of entries, consistent with the palette's approach.

## Edge cases & error handling

- No active project → `cwd` is null → finder shows the "open a project" state,
  never calls IPC.
- Symlink cycles → not followed; listed as leaf entries.
- Very large / deep trees → capped silently at the limits above.
- Reopening while a previous fetch is in flight → a request token discards stale
  results.
- Root outside open projects → main throws; the finder surfaces an empty state.

## Testing strategy

- **Unit (core/main, under the gate):** `FsService.listFilesDeep` — recursion,
  ignore pruning, `showIgnored`, symlink non-recursion, `maxFiles`/`maxDepth`
  caps, rel-path + sorting. `register-fs` — handler returns the list, guard
  rejects out-of-root and non-string args. `create-bridge` — routes to
  `fs:list-deep`. `action-dispatch` + `keymap`/`registry` no-drift tests updated
  for the new command/action.
- **Component (jsdom):** `QuickOpen.test.tsx` — loading→list, fuzzy filter, arrow
  nav, Enter opens, Esc closes, empty + no-project states, focus restore.
  (Not added to the coverage-gate `include`, mirroring `CommandPalette`.)
- **Manual/E2E:** `Ctrl+Shift+O` opens the finder; `Ctrl+P` still reaches the
  terminal; opening a file shows it in the viewer.

## Dependencies

None new. Pure reuse of existing modules.

## Migration & rollback plan

Additive only — new channel, new command, new component. Rollback = revert the
commit; no persisted state or schema depends on it.

## Open questions

- Should we later add MRU/recently-opened boosting? (Deferred — out of scope.)
- Should the index respect `.gitignore`? (Deferred — `DEFAULT_IGNORES` only.)

## Todo list

- [x] `FsService.listFilesDeep` + tests
- [x] `IndexedFile` type, `fs:list-deep` channel, `WeftApi`/`WeftBridge`
- [x] `register-fs` handler + confinement guard + tests
- [x] preload bridge method + test
- [x] keymap `ctrl+shift+o`, `quick-open` KeyAction, `general.quickOpen` command,
  action-dispatch both ways + updated no-drift tests
- [x] `QuickOpen.tsx` + CSS + component tests
- [x] App overlay wiring (`runCommand`, render)
- [x] Docs: keyboard-navigation, USAGE, CHANGELOG
- [x] `pnpm typecheck` + `pnpm test:cov` green (662 tests; 98.8%/96.6% coverage)
- [ ] Manual/E2E smoke in the running app (then move this doc to
  `documents/completed/`)
