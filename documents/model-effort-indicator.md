# Status-bar model + effort indicator

## Feature specification

Show, in the bottom status bar, the **model** and **reasoning effort level** the
active tab's Claude Code session is currently using — e.g. `✦ Opus 4.8 · High`.
It sits alongside the existing left-side readouts (cwd/branch, token usage,
plan-limit) and updates live as turns happen.

Both values are read from the session's own transcript
(`~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`), the same source weft
already parses for token usage — so this is authoritative (what Claude Code
actually recorded), never scraped from terminal output:

- **model** — `message.model` on the latest assistant turn (e.g.
  `claude-opus-4-8`), mapped to a display name ("Opus 4.8").
- **effort** — the top-level `effort` field on that turn (`"high"`, `"low"`,
  and the other reasoning-effort tiers), shown title-cased.

## Scope

In scope:

- A per-active-tab model+effort readout in the status bar (claude tabs only).
- Deriving both from the latest assistant turn of the transcript.
- A model-id → display-name map with a graceful fallback for unknown ids.
- Live refresh on tab switch and on session-status changes (turn boundaries).

Out of scope:

- Showing model/effort for **shell** tabs (they have no model).
- A per-tab badge on the tab strip (status bar only).
- Letting the user **change** the model/effort from weft (read-only display).
- Historical model/effort or a timeline (Usage panel already covers history).
- Inferring effort/model when the transcript has no assistant turn yet — the
  readout is simply hidden until the first turn is recorded (`unknown` ethos:
  never claim a value that hasn't been observed).

## User stories

- As a user juggling several project tabs, I want to see at a glance which model
  and effort the active session is on, so I don't mistake an Opus session for a
  Haiku one (or a high-effort run for a low-effort one).
- As a cost-conscious user, I want the model shown next to the token/plan
  readouts, so the cost context is all in one place.

## Acceptance criteria

- [ ] For a claude tab with a recorded assistant turn, the status bar shows the
  mapped model name and (when present) the title-cased effort.
- [ ] Known ids map to friendly names (`claude-opus-4-8` → "Opus 4.8",
  `claude-haiku-4-5-20251001` → "Haiku 4.5"); unknown `claude-*` ids fall back to
  a cleaned-up name; a non-claude id is shown verbatim.
- [ ] `<synthetic>` turns are ignored — the readout reflects the last real model.
- [ ] Shell tabs and tabs with no transcript/turn show no indicator (hidden).
- [ ] The readout updates on tab switch and when a session status changes, and a
  stale in-flight fetch never overwrites a newer tab's value.
- [ ] `pnpm typecheck` clean; `pnpm test:cov` green at the gate.

## Architecture & technical design

Layer boundary: parsing/mapping is pure `core`; main is a thin transcript
adapter; renderer mirrors a single value.

- **core (`src/core/usage/transcript.ts`)** — extend the parsed
  `TranscriptEntry` with `effort: string | null`, read from the line's top-level
  `effort`. `parseTranscriptUsage` is unchanged (ignores it).
- **core (`src/core/usage/session-info.ts`, new)** — `latestSessionInfo(detail)`
  returns `{ model, effort }` for the last non-`<synthetic>` assistant turn, or
  null.
- **core (`src/core/model/model-name.ts`, new)** — `modelDisplayName(id)` (map +
  fallback parser: strip `claude-`, drop a trailing date segment, Title-case the
  family, join the version with dots) and `effortLabel(effort)` (title-case /
  null).
- **main (`src/main/services/usage-service.ts`)** — a `sessionInfo(session)`
  method that reuses the existing transcript-location logic (deterministic
  encoded dir + fallback scan) and the (mtime,size) cache, now storing the parsed
  detail's latest info alongside `byModel` so a poll re-parses at most once per
  change.
- **shared** — `SessionInfo { model: string; effort: string | null }`, a
  `usage:session-info` channel, and `getSessionInfo(cwd, sessionId)` on
  `WeftApi` + the bridge `Pick`.
- **main IPC (`register-usage.ts`)** — handler validating args → `sessionInfo`.
- **preload** — bridge method.
- **renderer** — `usage-store` gains `sessionInfo` + `setSessionInfo`; a
  module-level `refreshSessionInfo()` reads the active claude tab from the session
  store and fetches (guarding against tab-switch races). Called on `activeTabId`
  change and inside the existing `onSessionStatus`/`onSessionExit` handlers
  (turn boundaries — exactly when model/effort can change). The `<footer>`
  renders `✦ {modelDisplayName} · {effortLabel}` when `sessionInfo` is set.

Data flow: active claude tab → `getSessionInfo(cwd, sessionId)` → main locates &
parses transcript → `latestSessionInfo` → renderer store → footer (mapped to
display names by the pure core helpers).

## API contract

```ts
getSessionInfo(cwd: string, sessionId: string): Promise<SessionInfo | null>
// SessionInfo = { model: string; effort: string | null }  (raw id + raw effort)
```

Channel `usage:session-info`. Returns null for a missing/unreadable transcript or
a session with no assistant turn (never throws). Display mapping happens in the
renderer via the pure core helpers.

## UI/UX considerations

- Left group of the status bar, after the token-usage readout, before the
  spacer. A muted `span.status-bar__model` (`data-testid="status-model"`) with a
  distinct glyph (`✦`) and a `title` tooltip spelling out "Model … · effort …".
- States: hidden when no info (shell tab, no transcript, no turn yet). No
  loading flash — it just appears once the first turn is recorded.
- a11y: text content (not color-only); tooltip for the full label.

## Security considerations

Read-only transcript reads under `~/.claude/projects` (weft already does this for
usage). No new write surface. `cwd`/`sessionId` come from the tab's own state.

## Performance considerations

Event-driven refresh (tab switch + status events), not a tight poll. The
(mtime,size) cache means an unchanged transcript is parsed at most once; a turn
that changes the file is re-parsed once. Reuses the single existing parse path.

## Edge cases & error handling

- No assistant turn yet / missing file → null → hidden.
- `<synthetic>` last turn → skipped; shows the last real model.
- Transcript located only via the fallback scan (path-encoding edge) → still
  works (same locator as usage).
- Tab switched mid-fetch → race guard drops the stale result.
- Effort field absent (older transcripts) → model shown without effort.

## Testing strategy

- **core:** `transcript` effort parsing; `session-info` latest/skip-synthetic/
  empty; `model-name` map + fallback (date strip, version dots, non-claude,
  effort label + null).
- **main/ipc:** `usage-service.sessionInfo` (direct + fallback + null + cache);
  `register-usage` handler + arg validation; `create-bridge` route;
  `usage-store` setter.
- **E2E/manual:** the readout appears for a claude tab (E2E uses shell tabs, so
  this is primarily a manual/screenshot check).

## Dependencies

None new.

## Migration & rollback plan

Additive (new channel/method/field/UI). Rollback = revert; no persisted state.

## Open questions

- Should effort be hidden when it equals a default? (No — always show what the
  transcript recorded; it's the point of the feature.)

## Todo list

- [x] core: transcript effort + `session-info.ts` + `model-name.ts` + tests
- [x] shared: `SessionInfo`, channel, `WeftApi`/bridge
- [x] main: `UsageService.sessionInfo` + shared cache + register handler + tests
- [x] preload bridge + test
- [x] renderer: store field, `refreshSessionInfo`, footer + CSS, refresh wiring
- [x] docs: CHANGELOG / USAGE
- [x] `pnpm typecheck` + `pnpm test:cov` green (681 tests; 100% on new files)
- [x] verified in the real built app: real `getSessionInfo` IPC returned
  `{model: claude-opus-4-8, effort: high}`; footer rendered `✦ Opus 4.8 · High`
- [ ] Move this doc to `documents/completed/` when the branch merges
