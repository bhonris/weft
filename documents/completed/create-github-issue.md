# Create a GitHub issue from weft

## Feature specification

Add a **"New issue"** action to the GitHub Issues sidebar panel so a user can
file an issue on the active project's GitHub repo without leaving weft. The panel
was previously read-only (list + open-in-browser); this adds a compact inline
form (title + body + labels) that POSTs to the GitHub REST API. On success the
issue list refreshes and the new issue opens in the default browser.

## Scope & out of scope

**In scope**
- A "New issue" button in the panel header (disabled when unauthenticated).
- Inline form: required title, optional Markdown body, and label selection from
  the repo's existing labels (toggleable chips).
- Create requires a token; the per-repo issue cache is invalidated on success so
  the new issue appears on the next poll.
- After success: refresh the list **and** open the created issue in the browser.

**Out of scope**
- Assignees, milestones, projects.
- Editing, commenting on, or closing existing issues.
- Markdown preview of the body; image/attachment upload.
- Creating issues on a repo other than the active tab's `origin` repo.

## User stories

- *As a developer triaging while I work, I want to file a GitHub issue from the
  Issues panel so that I can capture a bug/idea without switching to the browser.*

## Acceptance criteria

- [x] A "New issue" button appears in the Issues panel when a GitHub repo is
  detected; it is disabled (with an explanatory tooltip) when `authSource` is
  `none`.
- [x] The form submits `{ title, body, labels }`; a blank title disables submit
  and is rejected by the service.
- [x] On success the new issue opens in the browser and the list refreshes to
  include it (cache invalidated).
- [x] On failure (no auth, not a repo, HTTP error, network error) a human message
  is shown inline and the form stays open.
- [x] The GitHub token never leaves the main process.
- [x] `pnpm typecheck` clean; `pnpm test:cov` green at the coverage gate.

## Architecture & technical design

Threads the existing layer boundary, mirroring the `getIssues` read and the
`githubSignIn` union-result convention:

- **`src/shared/ipc`** — new channel `github:create`; `CreateIssueInput`
  `{ title, body, labels }` and `CreateIssueResult = { issue } | { error }`;
  `createIssue` added to `WeftApi` and the `WeftBridge` `Pick`.
- **`src/core/github/issues.ts`** — `parseIssues` refactored to share
  `parseOneIssue`; new pure `parseCreatedIssue` for the single-object POST body.
- **`src/main/services/github-service.ts`** — `createIssue(cwd, input)`: detect
  repo via `parseRepoSlug`, require a token via the injected `getAuth`, POST to
  `/repos/{owner}/{repo}/issues`, reuse `httpError`, invalidate the repo cache,
  return `{ issue }` / `{ error }`. Never throws.
- **`src/main/ipc/register-github.ts`** — `github:create` handler forwarding
  `(cwd, input)`.
- **`src/preload/create-bridge.ts`** — `createIssue` bridge method.
- **`src/renderer/components/IssuesPanel.tsx`** — button + inline form; on
  success closes/resets, `refresh()`, and `openExternal(issue.htmlUrl)`. Styles
  in `styles.css` (`.issues-new__btn`, `.issue-form*`).

## Security considerations

- Token stays in main (resolved gh → env → stored OAuth), never sent over IPC.
- OAuth scope is already `repo` (write-capable) — no scope change.
- The created issue URL is opened via the existing `openExternal`, which is
  guarded to http(s) by `isSafeExternalUrl`.
- Create is impossible unauthenticated (button disabled + service rejects).

## Edge cases & error handling

- Not a GitHub repo / null cwd → `{ error: 'Not a GitHub repository.' }`.
- Blank/whitespace title → `{ error: 'Issue title is required.' }` (submit also
  disabled client-side).
- No token → `{ error: 'Sign in to GitHub to create an issue.' }`.
- Non-2xx → friendly message from `httpError` (rate limit / 404 / 401 / generic).
- Network failure or unexpected body → friendly error; form stays open.

## Testing strategy

- **Core**: `parseCreatedIssue` (valid / malformed / PR → null).
- **Service**: POST URL/method/headers/body, trimmed title, cache invalidation,
  and every error branch (no repo, null cwd, blank title, unauth, 404-authed,
  generic HTTP, unexpected body, network, getAuth throw).
- **IPC**: `github:create` forwards `(cwd, input)` and null-coerces cwd.
- **Preload**: `createIssue` invokes `CH.createIssue` with args.
- **Renderer**: form open/submit calls `createIssue` + `openExternal`; disabled
  when unauthenticated; error renders on `{ error }`; submit gated by title.

## Dependencies

None new — raw `fetch` via the existing `GithubFetchLike`.

## Migration & rollback plan

Additive across all layers; no persisted-state or schema changes. Rollback is a
straight revert of the diff.

## Open questions

None outstanding.

## Todo

- [x] Contract (channel, types, WeftApi/WeftBridge)
- [x] Core parser (`parseCreatedIssue`)
- [x] Main service (`createIssue`)
- [x] IPC handler
- [x] Preload bridge
- [x] Renderer form + styles
- [x] Tests across every layer
- [x] typecheck + coverage gate green
