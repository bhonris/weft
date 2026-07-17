# Feature: Whole-tab Claude Code state coloring

**Status:** ✅ Complete (2026-07-18)

## Feature specification

Extend Weft's per-tab Claude Code status awareness so the **entire project tab**
signals session state through color, not just the small status glyph. Each tab
already carried a hook-driven `SessionStatus` (`working | waiting | done |
error | unknown`) rendered as a colored glyph (● ‖ ✓ ✕ ○). This feature makes
the whole tab reflect that state — a colored top stripe plus a subtle background
tint — so the operator can read at a glance, across a full tab strip, which
sessions are running, which are blocked waiting on them, and which have finished.

**Why:** the glyph is easy to miss when scanning many tabs. Color across the
whole tab is the fastest possible "which session needs me?" signal, which is the
product's defining differentiator (hook-driven per-session status).

## Scope & out of scope

**In scope**
- A per-status modifier class (`tab--working`, `tab--waiting`, `tab--done`,
  `tab--error`) applied to the tab element.
- Whole-tab visual treatment: colored 2px top stripe + tinted background, with a
  stronger tint on the active tab.
- Shared CSS custom properties (`--st-working`, etc.) as the single source of
  truth for both the tab tint and the existing status glyph color.
- A regression test asserting each state maps to the right class and that a
  status event only colors the tab it targets.

**Out of scope**
- Changing the status pipeline itself (hooks → status server → `mapHookToStatus`
  → `setStatus`) — it already exists and is unchanged.
- New status values or new hook events.
- Animating the whole tab (only the glyph pulses for `working`; a full-tab pulse
  was tried and rejected as too distracting — it faded the title/buttons too).
- Theming beyond reusing existing dark/light conventions (tabs remain dark-styled
  as they already were).

## User stories

- As a developer running several Claude sessions, I want each tab tinted by its
  state so that I can spot a session that finished or is waiting on me without
  reading tiny glyphs.
- As a developer with a full tab strip, I want the waiting state (amber) to stand
  out so that I don't leave a blocked session idle.

## Acceptance criteria

- [x] A `working` session's tab shows the blue state color.
- [x] A `waiting` (needs-input / permission / idle / elicitation) session's tab shows amber.
- [x] A `done` / completed session's tab shows green.
- [x] An `error` session's tab shows red.
- [x] A fresh `unknown` tab stays visually neutral (no tint) until a hook reports.
- [x] The active tab remains distinguishable from inactive tabs within the same state.
- [x] A status event only recolors the tab it targets, not the others.
- [x] The glyph and the tab tint use one shared color source (no drift).
- [x] Covered by a renderer test; existing suite still green (aside from a
      pre-existing env-only failure — see Edge cases).

## Architecture & technical design

Purely a renderer-layer presentation change; no main-process or IPC changes.

- **`src/renderer/App.tsx`** — `TabButton` adds the status modifier to the tab
  element: `` className={`tab tab--${tab.status}${active ? ' tab--active' : ''}`} ``.
  Status still arrives via `window.api.onSessionStatus` / `onSessionExit` →
  `useSessionStore.setStatus` (unchanged).
- **`src/renderer/styles.css`**
  - New `:root` variables: `--st-working`, `--st-waiting`, `--st-done`,
    `--st-error`, `--st-unknown`.
  - `.tab` uses a `--st` custom property to drive a `border-top` stripe and a
    `color-mix()` background tint; `.tab--active` uses a stronger mix.
  - `.tab--<status>` rules set `--st`; `unknown` is left neutral (transparent).
  - Existing `.tab__badge--<status>` colors refactored to reference the same
    variables (single source of truth).

State → color mapping:

| Claude Code state | `SessionStatus` | Color |
|---|---|---|
| running | `working` | blue `--st-working` (glyph also pulses) |
| waiting for user response | `waiting` | amber `--st-waiting` |
| completed | `done` | green `--st-done` |
| errored / non-zero exit | `error` | red `--st-error` |
| no hook yet / endpoint down | `unknown` | neutral |

## UI/UX considerations

- Color is redundant with the existing distinct glyph shapes (● ‖ ✓ ✕ ○) and
  `aria-label`, preserving the spec's non-color-only accessibility guarantee.
- Reduced-motion: only the glyph animates (`working` pulse); it is already
  disabled under `prefers-reduced-motion`. The tab tint is static.
- Active vs inactive tabs stay distinguishable via a stronger tint mix.

## Security considerations

None — no new inputs, IPC surface, or data flows; presentation only.

## Performance considerations

Negligible — a className string and CSS `color-mix()`; no new renders or timers.

## Edge cases & error handling

- `unknown` renders neutral so freshly opened / endpoint-down tabs look ordinary
  (consistent with "never claim a state we haven't observed").
- Rapid status changes just swap the modifier class; the tint follows.
- **Known pre-existing failure (not introduced here):**
  `src/main/services/hook-forwarder.integration.test.ts` spreads
  `...process.env`, so when the suite runs *inside* a Weft/Claude Code session
  it inherits a real `CLAUDE_IDE_TAB` and one case gets an unexpected `tabId`.
  Unrelated to this feature (renderer-only). Fix would be pinning
  `CLAUDE_IDE_TAB: undefined` in that test's spawn env.

## Testing strategy

- **Unit/component:** `src/renderer/App.test.tsx` (new) — renders `App` with a
  mocked `window.api` (and a stubbed `TerminalPane`), drives `onSessionStatus`
  events, and asserts the tab's `classList` transitions
  unknown → working → waiting → done, plus a two-tab test proving the class is
  scoped to the targeted tab.
- **Manual:** visually confirm tint/stripe across states on Windows.

## Dependencies

None.

## Migration & rollback plan

Stateless CSS/markup change. Rollback = revert the `App.tsx` className and the
`styles.css` additions; no data or schema impact.

## Open questions

- Should `error` also raise/keep an OS toast the way `waiting`/`done` do? (Out of
  scope here; existing notification policy unchanged.)

## Todo list

- [x] Add `tab--<status>` modifier class in `TabButton`.
- [x] Add shared `--st-*` state-color variables.
- [x] Tint the whole tab (top stripe + background) via `--st`, stronger on active.
- [x] Refactor badge glyph colors to reuse the shared variables.
- [x] Add `App.test.tsx` regression tests.
- [x] Run renderer tests (green) and typecheck (clean).
- [x] Reconcile the stale `design-doc.md` todo list.
- [x] File this feature doc under `documents/completed/`.
