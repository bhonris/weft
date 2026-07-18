# Cyberpunk theme

Implements the `Weft Cyberpunk.dc.html` design concept (from the claude.ai/design
"App redesign concept" project) as a real, selectable theme in the weft shell.

## Feature specification

Add a fourth theme, **cyberpunk**, to the existing `system | light | dark` theme
cycle. Selecting it restyles the entire shell chrome — tab strip, explorer,
terminal host frame, and status bar — into a neon "CRT terminal" aesthetic:

- **Palette**: primary neon pink `#ff2d78`, secondary cyan `#21e6ff`, near-black
  backgrounds (`#07070c` canvas, `#0d0d15` panels).
- **Typography**: `Chakra Petch` for display/chrome labels, `JetBrains Mono` for
  monospaced content — both self-hosted via `@fontsource/*` (the renderer CSP
  forbids CDN fonts).
- **Chrome details**: angled (clip-path) browser tabs with per-status neon glow,
  a diamond `WEFT` wordmark, an `EXPLORER // WEFT` header, panel corner accents,
  and a `WEFT` badge in the footer.
- **Ambient effects**: an animated panning grid behind the terminal, a horizontal
  scanline sweep, a full-shell CRT scanline overlay + vignette. All ambient
  motion is disabled under `prefers-reduced-motion: reduce`.

The theme is persisted in `workspace.json` exactly like the other three and
restored on launch.

## Scope & out of scope

In scope:

- New `cyberpunk` value across the theme type (shared contract, core zod schema,
  legacy-migration allow-list, renderer store) and the status-bar toggle.
- Cyberpunk CSS scoped to `:root[data-theme='cyberpunk']`, layered over the
  existing variables so light/dark are untouched.
- Self-hosted fonts bundled by Vite.
- Unit tests for the type/persistence/store/toggle changes.

Out of scope (mockup-only content that the real app owns differently):

- The fake terminal transcript, `PTY://` path bar, and `CLAUDE · sonnet` badge in
  the mockup — the real terminal is a live xterm surface; we frame it, we do not
  fabricate its contents.
- Any change to PTY/status/IPC behavior or the layer boundary.
- Theming the torn-off window (`TearOffApp` does not load the workspace/theme; it
  keeps the default look). Could follow later.
- New light-mode variant of the cyberpunk look — it is a dark aesthetic only.

## User stories

- As a developer who lives in the terminal, I want a high-contrast neon theme so
  that my weft sessions feel distinct and the active/working tab is obvious at a
  glance.
- As a user sensitive to motion, I want the ambient CRT/grid animation to stop
  when I set `prefers-reduced-motion` so that the theme stays usable.

## Acceptance criteria

- [x] The status-bar toggle cycles `system → light → dark → cyberpunk → system`,
      showing `⚡ cyberpunk` when active. (App.test.tsx)
- [x] Choosing cyberpunk sets `data-theme="cyberpunk"` on `<html>` and restyles
      the shell (fonts, palette, tabs, explorer, terminal frame, footer). (verified
      by rendering the real markup + styles.css — matches the concept.)
- [x] The choice survives a reload/restart (persisted + validated).
- [x] A workspace blob with `theme: "cyberpunk"` loads without error; an unknown
      theme is still rejected. (validate.test.ts)
- [x] Fonts load from the app origin (no CDN request; CSP unchanged).
- [x] Ambient animations are removed under `prefers-reduced-motion: reduce`; the
      per-tab working-badge pulse already respects it.
- [x] `pnpm typecheck` clean; `pnpm test:cov` green (98.09% stmt / 96.77% branch,
      above the 95/90 gate; 239 tests).

## Architecture & technical design

The theme is a pure presentation concern, so the change stays at the edges and
respects the layer boundary:

- `src/shared/ipc/api-contract.ts` — widen `WorkspaceState.theme` union.
- `src/core/persistence/schema.ts` — add `cyberpunk` to the zod enum (the
  `SchemaOutput extends WorkspaceState` assertion keeps them in lockstep).
- `src/core/persistence/migrations/v0-to-v1.ts` — add `cyberpunk` to the legacy
  theme allow-list so the set of valid themes is defined in one mental place.
- `src/renderer/store/session-store.ts` — extend `ThemeChoice`.
- `src/renderer/App.tsx` — extend the cycle + glyph. `data-theme` application is
  unchanged (already writes `theme` verbatim).
- `src/renderer/main.tsx` — import the `@fontsource` weight stylesheets once.
- `src/renderer/styles.css` — all cyberpunk visuals under
  `:root[data-theme='cyberpunk']`, using the existing class names plus a few
  pseudo-element overlays on `.weft-shell` / `.terminal-host`.

No `core/` logic depends on the theme value beyond validation; no main-process
change is needed.

## UI/UX considerations

- Overlays (scanlines, vignette, grid, sweep) are `pointer-events:none` and sit
  above the chrome but below interactive controls where it matters; the xterm
  surface stays fully interactive and its text stays in the DOM (no WebGL — see
  the invariant).
- Contrast: body text stays `#c8ccd8` on near-black; neon is reserved for accents
  and state, keeping AA-ish legibility.
- Accessibility: status is still glyph + `aria-label`, not color-only; all
  ambient motion honors `prefers-reduced-motion`.

## Security considerations

- No CSP relaxation. Fonts are bundled and served from `'self'`.
- No new IPC, no new file access, no change to the persisted-blob trust boundary
  (still validated by zod on load).

## Performance considerations

- Fonts: 7 woff2 files (~a few hundred KB) bundled locally, loaded once.
- Animations are GPU-friendly transforms/opacity; grid pan is a cheap
  `background-position` shift. Negligible cost, and off entirely under reduced
  motion.

## Edge cases & error handling

- Legacy/hand-edited blob with an unknown theme → rejected by zod → default
  workspace (existing behavior, still tested).
- Reduced-motion users → static theme (no sweep/grid/flicker).
- Torn-off window → default (non-cyberpunk) look; documented as out of scope.

## Testing strategy

- `core/persistence/validate.test.ts` — accept `theme: "cyberpunk"`, still reject
  unknown themes.
- `renderer/store/session-store.test.ts` — `setTheme('cyberpunk')`.
- `renderer/App.test.tsx` — toggle cycles into and past cyberpunk; `data-theme`
  reflects it. (CSS visuals are verified by running the app, not unit-asserted.)

## Dependencies

- `@fontsource/chakra-petch`, `@fontsource/jetbrains-mono` (self-hosted fonts).

## Migration & rollback plan

- Forward: no schema-version bump needed — only the enum widened, which is a
  superset, so older builds still read new blobs unless the theme is cyberpunk
  (in which case an older build would reject and fall back to default — acceptable).
- Rollback: remove the enum/type/CSS additions; persisted `cyberpunk` falls back
  to the default workspace on load.

## Open questions

- None blocking. Possible follow-up: propagate the theme to `TearOffApp`.

## Todo

- [x] Bundle fonts (`@fontsource/*`).
- [x] Widen theme type across shared/core/store.
- [x] Extend theme cycle + glyph in `App.tsx`.
- [x] Import fonts in `main.tsx`.
- [x] Write cyberpunk CSS.
- [x] Update/add tests.
- [x] `pnpm typecheck` + `pnpm test:cov` green.
- [x] Confirm the look matches the concept (rendered the real chrome + styles).
