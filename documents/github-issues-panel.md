# Feature: GitHub Issues sidebar panel

Status: **implemented — blocked on OAuth client ID for sign-in** · Owner: (weft) · Created 2026-07-20

> Built, typechecked, and unit-tested (coverage gate green at 98.8%/96.9%). The
> `gh` / `GITHUB_TOKEN` / unauthenticated paths and all read/filter features are
> fully functional. The device-flow **"Sign in with GitHub"** button reports "not
> configured" until a GitHub OAuth App client ID is supplied via
> `WEFT_GITHUB_CLIENT_ID` (see Open questions). Not yet moved to
> `documents/completed/` for that reason.

## Feature specification

Add a third vertical activity-bar tab — **GitHub Issues** — alongside the existing
Explorer and Usage panels. When the active project tab's `cwd` is a git repo whose
`origin` remote points at GitHub, the panel lists that repo's issues (open, closed,
or all) with title, number, author, labels, and comment count, and lets the user
filter by state, by label, and by free-text search. Clicking an issue opens it in
the default browser.

Authentication follows a **resolver chain** in the main process:
`gh auth token` → `GITHUB_TOKEN` env → stored OAuth token → unauthenticated. The
panel shows which source is in use. When nothing is found, an in-panel
**"Sign in with GitHub"** button runs the OAuth **device flow** (show a code, open
the browser, poll, store the token) so private repos and the 5,000/hr rate limit
become available without a backend server.

The panel is a pure view over a zustand store, mirroring the Usage panel exactly:
the renderer never touches the network — everything goes
`renderer → window.api → IPC → main service`.

## Scope & out of scope

**In scope (this cycle)**
- New `issues` activity-bar tab + panel, persisted as the active panel.
- Repo detection from `git remote get-url origin` (https + ssh forms).
- Fetch issues via GitHub REST `GET /repos/{owner}/{repo}/issues?state=all`
  (pull requests filtered out).
- Client-side filter: state (open / closed / all), label, text search.
- Auth resolver chain (`gh` → env → stored → none) with a status banner.
- OAuth device-flow "Sign in with GitHub" + "Sign out".
- Open an issue in the default browser.

**Out of scope (explicitly NOT this cycle)**
- Creating, commenting on, closing, or otherwise mutating issues (read-only).
- Pull requests as first-class items (they're filtered out of the list).
- Issue detail view / inline body rendering (list only; body opens in browser).
- Pagination beyond the first page (cap at 50 most-recently-updated).
- Multi-remote / non-`origin` remotes; GitHub Enterprise custom hosts.
- Caching issues to disk; offline mode beyond "serve last-known, flagged stale".
- Webhook / push-based live updates (polled, like Usage).

## User stories

- As a developer, I want to see my repo's open issues next to my code so I can
  triage without leaving the app.
- As a developer on a private repo, I want to sign in to GitHub from inside Weft
  so the panel can read private issues and I'm not throttled.
- As a developer who already uses the `gh` CLI, I want Weft to reuse that login
  automatically with no extra step.
- As a developer, I want to filter issues by state, label, and text so I can find
  the one I care about quickly.

## Acceptance criteria

1. A third activity-bar icon labeled "GitHub Issues" appears; selecting it shows
   the Issues panel; the choice persists across restart.
2. When the active tab's cwd is a GitHub repo, the panel lists issues (title,
   `#number`, author, labels with colour, comment count); PRs are excluded.
3. When the cwd is not a git repo, or `origin` is not GitHub, the panel shows a
   clear "not a GitHub repository" empty state (no error).
4. State toggle (open / closed / all), a label filter, and a text search box all
   filter the visible list client-side; combining them ANDs the predicates.
5. Clicking an issue opens its `html_url` in the default browser.
6. The panel shows the active auth source: "Authenticated via gh CLI",
   "…via GITHUB_TOKEN", "…signed in", or "Public access only (unauthenticated)".
7. When unauthenticated, a "Sign in with GitHub" button starts the device flow:
   it shows the user code, opens the browser to `verification_uri`, and on
   approval the panel re-fetches as authenticated. "Sign out" clears the stored
   token.
8. All main-process failures (no repo, network error, rate limit, 404) degrade
   gracefully: the service never throws; it returns last-known data flagged
   `stale`, or an empty list with a human-readable `error`.
9. The GitHub token never crosses to the renderer.
10. Unit coverage stays green at the gate (95% statements/functions/lines, 90%
    branches) over new core/services/ipc/store code.

## Architecture & technical design

Follows weft's inward-only layering (see `CLAUDE.md`). New code:

**`src/core/` (pure, framework-free, fully unit-tested)**
- `github/repo-url.ts` — `parseRepoSlug(remoteUrl) → { owner, repo } | null`
  (handles `https://github.com/o/r(.git)`, `git@github.com:o/r.git`,
  `ssh://git@github.com/o/r.git`; returns null for non-GitHub hosts).
- `github/issues.ts` — `parseIssues(body) → GithubIssue[]` (drops entries with a
  `pull_request` field), and `filterIssues(issues, {state,label,query}) →
  GithubIssue[]`, plus `collectLabels(issues)` for the label dropdown.
- `github/device-flow.ts` — `parseDeviceCode(body)` and `parseTokenPoll(body)`
  returning discriminated results (`authorized` / `pending` / `slow_down` /
  `error`).
- `net/external-url.ts` — `isSafeExternalUrl(url)` (http/https only).

**`src/main/services/`**
- `git-service.ts` — add `remoteUrl(cwd) → string | null` (`git remote get-url
  origin`, degrades to null).
- `github-service.ts` — mirror of `plan-limits-service.ts`: injected `fetch`,
  `resolveRepo`, `getAuth`, `now`, `cacheMs`; fetches + caches issues; never
  throws; returns `IssuesPanelData`.
- `github-auth-service.ts` — token resolver (`gh auth token` via injected exec →
  `GITHUB_TOKEN` → stored token → none) and device-flow orchestration (start →
  open browser → background poll with `interval`/`expires_in` → store token →
  emit result). Injected: `fetch`, `exec`, `env`, `store` (get/set/delete),
  `openExternal`, `now`, `sleep`, `clientId`, `emit`.

**`src/main/ipc/register-github.ts`** — wires:
- `github:get` → `githubService.panel(cwd)`
- `github:sign-in` → `authService.beginDeviceFlow()` (returns code + URI or error)
- `github:sign-out` → `authService.signOut()`
- `github:auth` (main→renderer event) → `{ state, message? }`
- `app:open-external` → guarded `shell.openExternal(url)`

**`src/preload/create-bridge.ts`** — add the five bridge methods.

**`src/renderer/`**
- `store/issues-store.ts` — `{ panel, auth, setPanel, setAuth }`.
- `components/IssuesPanel.tsx` — pure view: repo header + auth banner +
  filter controls + list; mirrors `UsagePanel.tsx`.
- `components/ActivityBar.tsx` — add the `issues` item.
- `App.tsx` — extend the sidebar switch, poll `getIssues(activeTab.cwd)` while
  the panel is active, subscribe to `onGithubAuth`.
- `styles.css` — `.issues-*` blocks near the usage styles.

## API contract

New `WeftApi` methods (added to the `WeftBridge` Pick):
- `getIssues(cwd: string | null): Promise<IssuesPanelData>`
- `githubSignIn(): Promise<GithubSignInResult>`
- `githubSignOut(): Promise<void>`
- `onGithubAuth(cb: (e: GithubAuthEvent) => void): Unsubscribe`
- `openExternal(url: string): Promise<void>`

Shapes (in `api-contract.ts`):
```ts
type GithubAuthSource = 'gh' | 'env' | 'oauth' | 'none'
interface GithubLabel { name: string; color: string }        // hex, no '#'
interface GithubIssue {
  number: number; title: string; state: 'open' | 'closed'
  author: string; labels: GithubLabel[]; comments: number
  htmlUrl: string; updatedAt: string
}
interface IssuesPanelData {
  repo: { owner: string; repo: string } | null
  issues: GithubIssue[]
  authSource: GithubAuthSource
  fetchedAt: string; stale: boolean; error: string | null
}
type GithubSignInResult =
  | { userCode: string; verificationUri: string; expiresInSec: number }
  | { error: string }
type GithubAuthEvent = { state: 'authorized' | 'pending' | 'error'; message?: string }
```

## Database changes

Persistence is the electron-store workspace blob. The only change is widening
`SidebarPanel` (and the zod `activePanel` enum) with `'issues'`.

**No schema-version bump / migration is required.** A widened enum is backward
compatible: existing v6 blobs (`activePanel` = `'explorer'` | `'usage'`) still
validate, and a newly-saved `activePanel: 'issues'` validates under the same v6
schema. (A downgrade to an older build would reject `'issues'` and fall back to
the default panel — the existing corruption-fallback path handles that safely.)

## UI/UX considerations

- Reuses the activity-bar item styling; new glyph 🐙.
- Panel sections: repo header (`owner/repo` or empty state), auth banner
  (source + Sign in / Sign out), filter row (state segmented control, label
  `<select>`, search `<input>`), scrollable issue list.
- Loading / empty / error / not-a-repo / unauthenticated states all explicit.
- Theme-aware via existing CSS custom properties; label chips use the GitHub
  label colour with a readable foreground.
- a11y: list is a `<ul>`; issue rows are buttons (keyboard-openable);
  progress/announcements mirror Usage panel patterns; not colour-only.

## Security considerations

- Token never sent to the renderer; lives only in main (resolver + electron-store).
- `openExternal` is guarded by `isSafeExternalUrl` (http/https only) to prevent
  `file:`/`javascript:`/custom-scheme abuse.
- Device flow uses the OAuth **device** grant (no client secret shipped — safe for
  a distributed desktop app). Client ID is public by design.
- Stored token key is namespaced in electron-store; "Sign out" deletes it.
- Requested scope: `repo` (needed to read private-repo issues). Documented so the
  user understands the consent screen.

## Performance considerations

- Main caches issues per repo for `cacheMs` (default 60s) — the renderer may poll
  faster (15s while the panel is active) but real GitHub hits are bounded.
- Fetch caps at 50 most-recently-updated issues (`per_page=50`), single page.
- Filtering is O(n) client-side over ≤50 items — trivial.
- `gh auth token` exec result is cached briefly to avoid spawning a process per poll.

## Edge cases & error handling

- cwd null / not a repo / non-GitHub remote → `repo: null`, empty state.
- Repo has 0 issues → empty list, "No issues" note.
- Rate limited (403 with `x-ratelimit-remaining: 0`) → `error` explains it and
  suggests signing in; last-known list flagged `stale`.
- 404 (private repo, unauthenticated) → `error` suggests signing in.
- Device flow: `authorization_pending` (keep polling), `slow_down` (back off),
  `expired_token` / `access_denied` / timeout → emit `error`.
- `gh` not installed / not logged in → exec fails → fall through the chain.
- Client ID unconfigured → `githubSignIn` returns `{ error: 'not configured' }`;
  the rest of the panel still works unauthenticated.

## Testing strategy

- **core** unit tests: `repo-url` (all URL forms + rejects), `issues`
  (parse drops PRs, filter AND semantics, label collection), `device-flow`
  (each response shape), `external-url` (allow/deny schemes).
- **services** unit tests (injected fakes): `github-service` (fetch/parse/cache/
  stale/error branches, mirrors `plan-limits-service.test.ts`), `github-auth-
  service` (resolver order, gh→env→stored→none, device-flow happy + pending +
  slow_down + expiry + unconfigured), `git-service.remoteUrl`.
- **ipc** test: `register-github` (each channel dispatches; `open-external`
  rejects unsafe URLs).
- **store** test: `issues-store`.
- `IssuesPanel.tsx` is DOM-bound; light render coverage + rely on the existing
  E2E harness for interaction (per the project's "prefer E2E for DOM UI" rule).

## Dependencies

- No new npm packages. Uses global `fetch`, `child_process.execFile` (for `gh`),
  `electron.shell.openExternal`, and existing electron-store.
- **External prerequisite (open question):** a registered **GitHub OAuth App**
  to obtain a public **client ID** for the device flow. Supplied via
  `WEFT_GITHUB_CLIENT_ID` (falls back to a build-time constant). Until set, the
  Sign-in button reports "not configured"; `gh`/env/unauth paths work regardless.

## Migration & rollback plan

- No data migration (enum widening is backward compatible — see Database changes).
- Rollback = revert the feature commit; a persisted `activePanel: 'issues'` on an
  older build falls back to the default panel via the existing validation path.

## Open questions

- [ ] **Client ID**: which GitHub OAuth App client ID ships as the default? (Needs
  a registered app; until then device-flow sign-in is "not configured".)
- [ ] Token-source precedence: `gh` before stored OAuth (current choice) vs. the
  reverse? Chosen `gh → env → stored → none` to honour an existing gh login.
- [ ] Should GitHub Enterprise (custom host) be supported later? (Out of scope now.)

## Todo list

- [x] core: `github/repo-url.ts` (+test)
- [x] core: `github/issues.ts` (+test)
- [x] core: `github/device-flow.ts` (+test)
- [x] core: `net/external-url.ts` (+test)
- [x] shared: `api-contract.ts` types + `WeftApi`/`WeftBridge`; `SidebarPanel`
- [x] shared: `channels.ts` channels
- [x] main: `git-service.remoteUrl` (+test)
- [x] main: `github-service.ts` (+test)
- [x] main: `github-auth-service.ts` (+test)
- [x] main: `ipc/register-github.ts` (+test)
- [x] main: `container.ts` wiring + `open-external` handler
- [x] preload: `create-bridge.ts` methods
- [x] renderer: `store/issues-store.ts` (+test)
- [x] renderer: `components/IssuesPanel.tsx`
- [x] renderer: `ActivityBar.tsx` item
- [x] renderer: `App.tsx` render + poll + auth subscribe
- [x] renderer: `styles.css` `.issues-*`
- [x] persistence: widen `SidebarPanel` enum in `schema.ts`
- [x] typecheck clean; unit suite + coverage gate green (98.8% / 96.9%)
- [ ] **blocked:** register a GitHub OAuth App → set `WEFT_GITHUB_CLIENT_ID` to
      enable device-flow sign-in
- [ ] E2E: add a Playwright case for the Issues tab (deferred — DOM/UI per project
      convention; unit-tested pieces are covered)
