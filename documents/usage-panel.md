# Feature: Usage panel (activity bar + plan limits, weekly & session usage)

## Feature specification

Add a **dedicated Usage panel** to weft's sidebar, reachable from a new VS
Code-style **activity bar** (a narrow vertical icon strip on the far left of the
workbench). The activity bar has an **Explorer** icon at the top and a **Usage**
icon pinned at the bottom; clicking an icon swaps the sidebar's content between
the existing file tree and the new Usage panel.

The Usage panel shows three sections:

1. **Plan limits** (the headline) — the same meters as Claude Code's `/usage`:
   the **5-hour** rolling window, the **weekly (7-day)** cap, and the
   **weekly Opus** cap, each as a percent-used bar with its reset time. Sourced
   from Anthropic's `/api/oauth/usage` endpoint (the same one `/usage` calls).
2. **Weekly usage (computed)** — cost + token totals over the last 7 days,
   aggregated across **all** projects, computed locally from transcripts. This
   is the reliable, always-available number that complements the (fragile) plan
   meter.
3. **Recent sessions** — a scrollable list of recent Claude sessions across all
   projects, each with cost, tokens, model, project, and last-active time.

## Scope & out of scope

In scope:

- New activity bar (Explorer + Usage) and a sidebar that swaps panel content.
- Plan-limit meters from `/api/oauth/usage`, cached and degrading gracefully.
- Computed 7-day cost/token totals across all projects (local transcripts).
- Recent-sessions list across all projects with per-session cost/tokens/model.
- Reuse of the existing pure cost core (`core/usage/pricing|transcript|summary`).

Out of scope (intentionally NOT covered):

- **OAuth token refresh.** weft reads the existing access token read-only and
  never writes `~/.claude/.credentials.json`. If the token is expired (401), the
  plan meter degrades to "unavailable / last-known" — it does not attempt a
  refresh (that risks corrupting Claude Code's credentials).
- Historical charts / persistence of usage across weft restarts (beyond the
  60-minute plan-limit cache and the transcript parse cache).
- Sub-agent transcript accounting (top-level session transcript only, as today).
- Per-message drill-down; editing or resetting limits.
- The existing status-bar readout is **kept** (small, complementary); this panel
  does not remove it.

## User stories

- As a developer on a Max/Pro plan, I want to see how much of my 5-hour and
  weekly limits I've used, with reset times, so I can pace my work without
  running `/usage` in a session.
- As a cost-conscious user, I want a reliable local 7-day cost total across all
  my projects even when the plan endpoint is unavailable.
- As someone juggling many sessions, I want a list of recent sessions with their
  individual cost so I can see where spend is going.

## Acceptance criteria

- [x] A vertical **activity bar** renders with an Explorer icon (top, active by
      default) and a Usage icon (bottom); clicking swaps the sidebar content;
      keyboard-focusable with `aria-label`s and an `aria-selected` active state.
- [x] The active panel choice persists in workspace state across reloads.
- [x] The Usage panel shows **plan-limit meters** (5h, 7d, 7d-Opus) with
      percent-used bars and reset times when `/api/oauth/usage` succeeds.
- [x] When the endpoint fails or the token is missing/expired, the plan section
      shows a clear "unavailable" (or last-known within 60 min) state and the
      rest of the panel still works. It never throws, never blocks the UI, and
      never kills/touches a PTY.
- [x] The panel shows **computed 7-day** cost + token totals across all projects.
- [x] The panel shows a **recent-sessions list** (cost, tokens, model, project,
      last-active), newest first, across all projects.
- [x] The OAuth access token is read **read-only**; weft never writes under
      `~/.claude`. The token never crosses IPC to the renderer — only derived
      percentages/summaries do.
- [x] Plan-limit responses are cached ~60 min (endpoint is rate-limited); the
      weekly/session scan uses the existing mtime+size parse cache.
- [x] Pure logic is unit-tested; the 95%/90% coverage gate stays green. Panel
      wiring in App.tsx is covered by E2E per project convention.

## Architecture & technical design

Follows weft's layer boundary (pure `core/` ← thin `main/` adapter ← `preload`
bridge ← `renderer` view). Reuses the existing `core/usage/*` cost core.

### core/ (pure, unit-tested)

- `core/usage/transcript.ts` — extend parsing to expose, per transcript:
  per-entry **timestamp** and the session's **last-active time** + **model(s)**,
  so weekly windowing and the session list can be computed purely. Keep the
  existing `parseTranscriptUsage` for the status-bar path (or layer a richer
  `parseTranscriptDetail` alongside it).
- `core/usage/weekly.ts` (new) — pure: given parsed per-session detail + a "now"
  timestamp, produce a 7-day `UsageSummary` (cost + tokens) and a today bucket.
  "now" is injected (no `Date.now()` in core).
- `core/usage/sessions.ts` (new) — pure: build the sorted recent-session list
  (cost/tokens/model/project/lastActive) from parsed per-session detail.
- `core/usage/plan-limits.ts` (new) — pure: `parsePlanLimits(json)` →
  `PlanLimits` (five_hour/seven_day/seven_day_opus → `{ utilization, resetsAt }`),
  tolerant of missing fields; plus formatters (`formatResetIn`, bar %).

### shared/

- `api-contract.ts` — add `PlanLimits`, `UsagePanelData` wire types and
  `getUsagePanel()` (and/or `getPlanLimits()`) on `WeftApi`/`WeftBridge`.
- `channels.ts` — `usage:panel` (and/or `usage:planLimits`).

### main/ (thin adapters)

- `services/usage-history-service.ts` (new) — I/O over injected fs: scan **all**
  dirs under `~/.claude/projects`, parse each transcript via core (mtime+size
  cache), compute weekly totals + session list. Owns no PTY state.
- `services/plan-limits-service.ts` (new) — read the OAuth token read-only from
  `~/.claude/.credentials.json` (`claudeAiOauth.accessToken`); `GET`
  `https://api.anthropic.com/api/oauth/usage` with
  `Authorization: Bearer …`, `anthropic-beta: oauth-2025-04-20`,
  `anthropic-version`; parse via core; cache ~60 min; on any error (missing
  token, 401, network, non-2xx, bad JSON) return last-known-within-60-min or
  `null`. Injected `fetch`/`fs`/`clock` for tests. **Never writes credentials.**
- `ipc/register-usage.ts` — extend with the new channel(s), wiring the two
  services; feed session refs as today.
- `container.ts` — construct + register the new services.

### preload/ & renderer/

- `preload/create-bridge.ts` — add the new bridge method(s).
- `renderer/store/activity-store.ts` (new) — active panel id
  (`'explorer' | 'usage'`), persisted via workspace-sync.
- `renderer/store/usage-store.ts` — extend to hold panel data (plan limits +
  weekly + sessions).
- `renderer/components/ActivityBar.tsx` (new) — the vertical icon strip.
- `renderer/components/UsagePanel.tsx` (new) — the three sections + meters.
- `renderer/App.tsx` — render the activity bar; swap `<Explorer>` /
  `<UsagePanel>` in the sidebar by active panel; poll `getUsagePanel()` on an
  interval + on status/exit; keep the existing status-bar readout.
- `renderer/styles.css` — activity bar, panel, meter-bar styling; theme-aware;
  respect `prefers-reduced-motion`.

## API contract

IPC (renderer → main, invoke):

```ts
interface PlanWindow { utilization: number; resetsAt: string | null } // 0..100
interface PlanLimits {
  fiveHour: PlanWindow | null
  sevenDay: PlanWindow | null
  sevenDayOpus: PlanWindow | null
  fetchedAt: string
  stale: boolean          // true when served from the 60-min last-known cache
}
interface SessionUsage {
  sessionId: string; project: string; model: string
  costUsd: number; totalTokens: number; lastActive: string
}
interface UsagePanelData {
  planLimits: PlanLimits | null   // null when unavailable
  weekly: UsageSummary            // computed 7-day, all projects
  sessions: SessionUsage[]        // recent, newest first
}
// usage:panel  -> Promise<UsagePanelData>
```

## Data source & auth

- Plan limits: `GET https://api.anthropic.com/api/oauth/usage`
  (endpoint + headers verified from the Claude Code binary). Bearer token from
  `~/.claude/.credentials.json` → `claudeAiOauth.accessToken`. Response fields:
  `five_hour`, `seven_day`, `seven_day_opus` (each `utilization` + `resets_at`).
- Weekly + sessions: local transcripts under `~/.claude/projects/**`, priced by
  the existing bundled pricing table.

## Security considerations

- OAuth token read **read-only**; never written, never logged, never sent to the
  renderer. Only derived percentages/summaries cross IPC.
- Read-only access to `~/.claude`; weft never writes there.
- Endpoint is undocumented/unstable — isolated behind one service that degrades
  to "unavailable"; a change upstream can't break the rest of the app.

## Performance considerations

- Plan-limit response cached ~60 min (endpoint is rate-limited).
- All-projects transcript scan uses the existing (mtime+size) parse cache;
  unchanged transcripts aren't re-read. Panel polls only while it's the active
  sidebar panel (don't scan when the file tree is showing) + on status/exit.

## Edge cases & error handling

- Missing/expired token, 401, network down, non-2xx, bad JSON → plan section
  "unavailable" (or last-known < 60 min); weekly/sessions still render.
- No transcripts / all-zero → weekly shows $0; sessions list empty state.
- Huge `~/.claude/projects` (many dirs) → bounded work via the parse cache;
  consider capping the session list length (documented if so).
- Clock/timezone: reset times shown relative ("resets in 3h 12m") from injected
  now.

## Testing strategy

- Unit: `weekly`, `sessions`, `plan-limits` parsers + formatters (fixtures incl.
  malformed/partial responses); `usage-history-service` (fake fs, cache, scan);
  `plan-limits-service` (fake fetch/fs/clock: success, 401, network error, cache
  hit, stale fallback, missing token); `register-usage` handler; extended
  preload bridge test; `activity-store` + `usage-store`.
- E2E: activity-bar switching, panel renders, persists across reload. App.tsx
  wiring is E2E-only per convention.

## Dependencies

None new (use Node's global `fetch` in the main process).

## Migration & rollback plan

- Workspace state gains an `activePanel` field — additive; bump the schema
  version with a migration defaulting to `'explorer'`. Rollback = hide the
  activity bar / default to explorer; no data loss.

## Open questions

- Exact `/api/oauth/usage` response shape for `resets_at` (epoch vs ISO) and
  whether `utilization` is 0–1 or 0–100 — confirm empirically on first
  integration and make the parser tolerant of both.
- Do we want the Usage icon to show a tiny badge (e.g. a dot when >80% of any
  window) on the activity bar? (Nice-to-have.)
- Cap on recent-sessions list length (e.g. 50)? 

## Todo list

- [x] core: extend transcript detail (timestamps/model/last-active) + tests
- [x] core: weekly.ts, sessions.ts, plan-limits.ts + tests
- [x] shared: PlanLimits/SessionUsage/UsagePanelData + channel
- [x] main: usage-history-service + plan-limits-service (+ tests, container wire)
- [x] main: extend register-usage (+ tests)
- [x] preload: bridge method (+ extend test)
- [x] renderer: activity-store + ActivityBar + UsagePanel + App wiring + CSS
- [x] renderer: usage-store extension (+ tests)
- [x] e2e: activity-bar switching + panel + persistence
- [x] typecheck + unit + e2e green; coverage gate holds

## Follow-up (2026-07-20): always-on 5-hour readout + 1-minute refresh

- The **5-hour plan-limit** is now shown in the **status bar at all times**
  (`status-bar__plan`, `data-testid="status-plan-5h"`), not only when the Usage
  panel is open. It's colored by level (ok/warn≥75/crit≥90), shows a `•` and a
  "(last known)" tooltip when the reading is stale, and hides entirely when plan
  limits are unavailable. Reset time is in the tooltip.
- The Usage-panel payload (which carries the plan limits) is now polled
  **continuously** — every 60s while the file tree is showing, every 15s while
  the Usage panel is the active sidebar — so the status-bar meter stays live.
- `PlanLimitsService` cache TTL dropped from 60 min to **60s** (container wiring)
  so the (rate-limited) `/api/oauth/usage` endpoint is actually re-hit ~once a
  minute. The main cache still bounds real network hits to one per minute even
  when the renderer polls faster.

## Implementation notes (shipped 2026-07-20)

- Persistence bumped WorkspaceState v5→v6 (`activePanel`), with `v5-to-v6`
  migration defaulting to `'explorer'`.
- Plan-limit endpoint + auth verified from the Claude Code binary:
  `GET https://api.anthropic.com/api/oauth/usage`, `Authorization: Bearer …`,
  `anthropic-beta: oauth-2025-04-20`. Token read read-only from
  `~/.claude/.credentials.json` → `claudeAiOauth.accessToken`.
- E2E seam `WEFT_DISABLE_PLAN_LIMITS=1` skips the real authenticated call so
  tests never hit the network; the plan section then renders "unavailable".
- The parser tolerates both 0–1 and 0–100 utilizations and ISO/epoch resets —
  confirm the real shape on first live run (see Open questions).
```
