# Feature: Claude Code usage in the status bar

## Feature specification

Show a live **Claude Code usage** readout in the bottom-left of weft's status
bar: the estimated **dollar cost** and **token count** aggregated across **all
open Claude sessions** in the window. The numbers come from Claude Code's own
per-message token usage, which it writes into transcript JSONL files under
`~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` — so weft reads them
directly with **no external dependency** (no `ccusage`, no API calls).

Example rendered label:

```
Weft  ·  my-project  ⎇ main    ✳ $0.42 · 128k tokens         … theme  notify  …
```

## Scope & out of scope

In scope:

- Aggregate cost + tokens across every live `claude` tab (all sessions total).
- Pure cost model from a bundled per-model pricing table (input / output /
  cache-read / cache-write, incl. 5-minute vs 1-hour ephemeral cache writes).
- Read transcripts from the local filesystem; incremental (mtime+size) cache so
  repeated polls don't re-parse unchanged files.
- Status-bar UI with a tooltip breakdown; theme-aware styling.

Out of scope (intentionally NOT covered):

- Per-tab / per-session breakdown UI (scope is the window total).
- Sub-agent transcripts (`.../subagents/*.jsonl`) — only the top-level session
  transcript is counted. Sub-agent turns are undercounted in v1.
- Plan/usage-limit meters (5-hour window %, weekly caps).
- Historical charts or persistence of usage across restarts.
- Shell tabs (usage only applies to `claude` sessions).

## User stories

- As a developer running several Claude sessions in weft, I want to see the
  running cost and token total at a glance so that I can stay aware of spend
  without opening a separate tool or typing `/cost` in each session.

## Acceptance criteria

- [x] The status bar shows `✳ $<cost> · <tokens> tokens` when at least one
      Claude session has recorded usage; it is hidden when the total is zero.
- [x] The figure aggregates across all open Claude tabs (all-sessions total).
- [x] Cost is computed per model from a bundled pricing table; unknown models
      fall back to a documented default rate.
- [x] Cache-read and cache-write tokens are priced at their reduced/premium
      multipliers (read 0.1×, 5m write 1.25×, 1h write 2× of base input).
- [x] The readout refreshes automatically (poll + on status change) without
      blocking the UI, and never kills or touches a PTY.
- [x] A tooltip shows the breakdown (sessions, cost, in/out/cache tokens).
- [x] Pure logic is unit-tested; the 95%/90% coverage gate stays green.

## Architecture & technical design

Follows weft's strict layer boundary (pure `core/` ← thin `main/` adapter ←
`preload` bridge ← `renderer` view).

- `src/core/usage/pricing.ts` — `TokenUsage` type, `emptyUsage`/`addUsage`/
  `mergeUsageInto`, the per-model pricing table, and `costForUsage`. Pure.
- `src/core/usage/transcript.ts` — `encodeProjectDir` (Claude Code's
  `[^A-Za-z0-9] → -` path encoding), `transcriptFileName`, and
  `parseTranscriptUsage` (JSONL text → per-model `TokenUsage`, deduped by uuid).
  Pure.
- `src/core/usage/summary.ts` — `summarize` (per-model usage → `UsageSummary`
  with cost + token totals) and the display formatters (`formatUsd`,
  `formatTokens`, `formatUsageLabel`, `formatUsageTooltip`). Pure.
- `src/shared/ipc/api-contract.ts` — `UsageSummary` wire type + `getUsage()` on
  `WeftApi`/`WeftBridge`. `channels.ts` — `usage:get`.
- `src/main/services/usage-service.ts` — I/O adapter over injected fs: resolves
  each session's transcript path (encoded dir, with a project-dir scan
  fallback), reads + parses via `core`, caches by mtime+size, merges, and
  summarizes. Owns no PTY state.
- `src/main/ipc/register-usage.ts` — wires `usage:get` to the service, feeding
  it the live `claude` sessions from `pty.tabRefs()`.
- `src/renderer/store/usage-store.ts` — holds the latest `UsageSummary`.
- `src/renderer/App.tsx` — polls `getUsage()` on an interval + on status/exit
  events, renders the readout in the status bar's left cluster.

## API contract

IPC (renderer → main, invoke): `usage:get` → `Promise<UsageSummary>` where

```ts
interface UsageSummary {
  costUsd: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  sessionCount: number // claude sessions with a transcript
}
```

## Data source & pricing

- Transcript path: `~/.claude/projects/<encode(cwd)>/<sessionId>.jsonl`, where
  `encode` replaces every non-alphanumeric char with `-` (verified against real
  project dirs, incl. dotted paths). Fallback: scan project dirs for
  `<sessionId>.jsonl` if the derived dir doesn't match.
- Per assistant line: `message.model` + `message.usage`
  (`input_tokens`, `output_tokens`, `cache_read_input_tokens`,
  `cache_creation_input_tokens`, and the `cache_creation.ephemeral_{5m,1h}`
  breakdown when present).
- Pricing per 1M tokens (bundled): Opus 4.5–4.8 $5/$25; Opus 4.0/4.1 & Opus 3
  $15/$75; Fable/Mythos 5 $10/$50; Sonnet (5/4.x/3.x) $3/$15; Haiku 4.5 $1/$5;
  Haiku 3.5 $0.80/$4; Haiku 3 $0.25/$1.25. Cache multipliers: read 0.1×, 5m
  write 1.25×, 1h write 2× of the model's base input rate. Unknown models fall
  back to $5/$25.

## Security considerations

- Read-only access to the user's `~/.claude/projects`; never writes there.
- Renderer only receives the aggregated summary (no transcript contents).

## Performance considerations

- Incremental parse cache keyed by file `mtimeMs`+`size`; unchanged transcripts
  are not re-read. Renderer polls at 4s and on status/exit events.

## Edge cases & error handling

- Missing/unreadable transcript, JSON parse errors, endpoint down → that session
  contributes 0; the readout degrades to hidden rather than throwing.
- Zero total → readout hidden.

## Testing strategy

- Unit: pricing/cost, transcript parse + path encoding, summary + formatting,
  usage-service (fake fs incl. cache + fallback scan), register-usage handler,
  usage-store, and the extended preload bridge test.
- App.tsx wiring is E2E-only per project convention.

## Dependencies

None new.

## Todo list

- [x] Core: pricing, transcript, summary (+ tests)
- [x] Shared contract + channel
- [x] Main: usage-service + register-usage (+ tests, wire in container)
- [x] Preload bridge (+ extend test)
- [x] Renderer: usage-store (+ test) + App status-bar UI + CSS
- [x] typecheck + tests green
