# Source Control (Git) panel

A VS Code-style Source Control side tab: a sidebar panel, selectable from the
activity bar, that shows the active project's git working-tree changes and lets
the user stage, unstage, discard, commit, and sync — driven entirely by shelling
out to `git`.

## Feature specification

Add a fourth sidebar panel (`scm`) alongside Explorer / Issues / Usage. When the
active tab's `cwd` is a git repo it renders, faithfully to VS Code:

- **Header** — current branch, ahead/behind vs upstream, and Sync / Push / Pull
  + Refresh buttons.
- **Commit box** — a multiline message input with **Commit** and **Commit &
  Push** (disabled when there is no staged change or the message is empty).
- **Change groups** — collapsible sections **Merge Changes** (conflicts),
  **Staged Changes**, **Changes** (unstaged tracked), **Untracked**, each with a
  count and group-level actions (stage all / unstage all / discard all).
- **File rows** — a colored single-letter status decoration (M/A/D/R/U/?), the
  file name + dir, and inline actions (open diff, stage/unstage, discard).
  Clicking a row opens the correct diff in the Monaco viewer.
- **Activity-bar badge** — the count of changed files (VS Code's number bubble).

## Scope & out of scope

**In scope:** everything above — status, staging model (a file can be in both
Staged and Changes), commit, push/pull/sync, discard (with confirmation),
per-side diffs (working-vs-index, index-vs-HEAD, empty-baseline for untracked).

**Out of scope** (separate VS Code features, not the SCM side tab):

- 3-way merge editor for in-file conflict *regions* (conflict *files* are listed
  and resolvable by staging).
- Editor gutter change decorations, blame, inline annotations.
- Commit history / graph / timeline views.
- Multi-root repositories (one repo = the active tab's cwd).

## User stories

- As a developer, I want to see what changed in my project without leaving weft,
  so that I don't context-switch to a terminal or another app.
- As a developer, I want to stage specific files, write a message, and commit
  from the panel, so that I can complete the core git loop in-app.
- As a developer, I want to click a changed file and see its diff, so that I can
  review before committing.
- As a developer, I want push/pull with ahead/behind counts, so that I can keep
  in sync with the remote.

## Acceptance criteria

- [x] A Source Control icon appears in the activity bar; selecting it shows the
      panel; the choice persists across reloads (`WorkspaceState.activePanel`).
- [x] For a non-repo cwd the panel shows a "Not a git repository" empty state.
- [x] Changes are grouped Merge/Staged/Changes/Untracked with correct counts and
      status letters; a file modified both staged and unstaged shows in both.
- [x] Stage / unstage (per file and per group) update the lists.
- [x] Discard prompts via ConfirmDialog before reverting/deleting.
- [x] Commit with a message and ≥1 staged change clears the staged list; empty
      message or no staged change disables the button. Errors surface in-panel.
- [x] Branch name + ahead/behind render; Push / Pull run and refresh; failures
      surface in-panel.
- [x] Clicking a file opens a diff: unstaged → working-vs-index, staged →
      index-vs-HEAD, untracked → empty baseline.
- [x] Activity-bar badge shows the number of changed files.
- [x] `pnpm typecheck` clean; `pnpm test:cov` holds the 95%/90% gate.

## Architecture & technical design

Follows weft's layer boundary and mirrors the GitHub Issues feature end-to-end:

- `src/core/scm/porcelain.ts` (pure) — parse `git status --porcelain=v2 -z
  --branch` into `{ branch, upstream, ahead, behind, changes }`; plus
  `changeCount` (distinct files). Fully unit-tested.
- `src/main/services/git-service.ts` — thin adapter: `status`, `stage`,
  `unstage`, `discard`, `commit`, `push`, `pull` (injected `ExecFn`). Reads
  degrade to a non-repo/empty result; **mutations reject with git stderr** so the
  panel can surface failures.
- `src/main/services/diff-service.ts` — `gitFileDiff(path, side)` produces the
  per-side `DiffPayload` (reuses the existing rel-resolution + size guard).
- IPC: new `scm:*` channels; `register-scm.ts` handles status + mutations with
  `isInsideAnyRoot` guards on writes; `getGitFileDiff` rides in `register-fs.ts`
  next to `getDiff` (read-only). Wired in `container.ts`.
- Preload: new methods added to the `WeftBridge` Pick.
- Renderer: `scm-store.ts`, `SourceControlPanel.tsx`, an `ActivityBar` item +
  badge, an `App.tsx` panel case + poll-while-active effect, and a viewer-store
  extension so a change row opens the right diff side.

## API contract (IPC)

- `getGitStatus(cwd: string | null): Promise<GitRepoStatus>`
- `stageFiles(cwd, paths: string[]): Promise<void>`
- `unstageFiles(cwd, paths: string[]): Promise<void>`
- `discardChanges(cwd, paths: string[], untracked: boolean): Promise<void>`
- `gitCommit(cwd, message: string): Promise<void>`
- `gitPush(cwd): Promise<void>` / `gitPull(cwd): Promise<void>`
- `getGitFileDiff(path: string, side: GitDiffSide): Promise<DiffPayload>`

## Security considerations

Mutating channels confine `cwd` (and each path) to an **open project root** via
`isInsideAnyRoot(getWritableRoots(), …)` — the same guard `saveFile` uses — so
the semi-trusted renderer cannot run git anywhere on disk.

## Testing strategy

- Unit: `porcelain` parse cases (M/A/D/R/untracked/conflict, ahead/behind,
  rename source, empty); `git-service` (each op + non-repo + error propagation);
  `diff-service.gitFileDiff` (each side + deleted file); `register-scm` (arg +
  root guards); `scm-store`; `create-bridge` routing.
- E2E: open a repo project, switch panel, stage → commit, click a file → diff.

## Dependencies

None new — uses the system `git` already relied on by `GitService`/`DiffService`.

## Migration & rollback plan

`activePanel` gains `'scm'` — a backward-compatible enum widening (like
`'issues'`), no schema-version bump. Rollback is removing the panel; persisted
`activePanel: 'scm'` would fall back to the default on validation.

## Open questions

- None blocking. Live refresh uses poll-while-active + post-mutation refresh
  (in-pattern with Issues/Usage) rather than a dedicated git watcher.

## Todo

- [x] core/scm/porcelain.ts + tests
- [x] shared contract + channels + schema widening
- [x] git-service ops + diff-service.gitFileDiff + tests
- [x] register-scm.ts + register-fs getGitFileDiff + container wiring + tests
- [x] preload bridge methods
- [x] scm-store + SourceControlPanel + ActivityBar badge + App wiring + styles
- [x] viewer-store/ViewerPane git-diff sides
- [x] typecheck + coverage green (780 unit tests; gate held)
- [x] E2E happy path (e2e/source-control.spec.ts — passing)
