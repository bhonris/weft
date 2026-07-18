# Feature: Mouseless / keyboard-only navigation

> Status: **In progress** — `/dmail` Expansion Cycle 6 (operator-declared end goal).
> Spec criteria live in `documents/steiner-spec.md` → `## Expansion 6`.
> Scope constraint for this cycle: **macOS/Linux platform work is out of scope**
> (stay Windows-first); split panes / LSP are deprioritized unless they serve
> keyboard navigation.

## 1. Feature specification

Make Weft fully operable with the keyboard alone. A user should be able to open a
project, navigate the file tree, open and edit files, drive the terminal, switch
and manage tabs, and reach every status-bar control **without ever touching the
mouse** — and discover how to do so from inside the app.

The two pillars:

1. **Reachability** — every action currently bound to a mouse click gains a
   keyboard path (a chord, or an entry in a command palette), and DOM focus can
   move deliberately between the app's regions.
2. **Discoverability + visibility** — a command palette and a keyboard help
   overlay teach the shortcuts, and a visible focus indicator always shows where
   keyboard focus is.

All of this must respect Weft's #1 invariant: **terminal-bound keys still reach
the PTY.** New app chords route through the single pure `keybinding-router` so the
App-level listener and the xterm `attachCustomKeyEventHandler` never disagree,
and the protected passthrough set (`Ctrl+C/R/D/Z/L/A/E`, arrows, plain keys,
Alt/Meta, TUI function keys) is regression-tested.

### Why

Weft's audience lives in the terminal and in Claude Code — a keyboard-first
crowd. Today the terminal itself is keyboard-driven, but the *shell around it*
(tabs, explorer, viewer, status bar) is mouse-only: there is no way to move focus
between regions, the explorer tree has ARIA roles but no arrow-key navigation,
viewer mode switches are click-only, and there is no visible focus ring anywhere.
A mouseless flow removes the single biggest friction in daily use.

## 2. Scope & out of scope

### In scope

- A central, discoverable **command palette** (fuzzy-filtered, keyboard-run).
- A **keyboard help overlay** (cheat sheet of all shortcuts, grouped).
- A **region-focus system**: move DOM focus between tab strip, explorer,
  terminal, viewer/editor, and status bar via chords; cycle regions.
- **Explorer** keyboard navigation per the WAI-ARIA tree pattern (roving
  tabindex; ↑/↓/←/→/Enter/Space/Home/End).
- **Tab** management by keyboard: reorder the active tab, rename (F2), and pick
  the tab type (claude vs shell) — replacing mouse-only drag / Shift+Click.
- **Viewer/editor** mode switching (View/Edit/Diff), Reveal, Close, and an
  app-level **Ctrl+S** that saves whenever the viewer region is focused.
- **Status-bar** controls (theme cycle, resume toggle) triggerable by command.
- A **visible, theme-aware focus indicator** (`:focus-visible`) on every
  interactive element, including the cyberpunk theme.
- Overlays are accessible (roles/aria, focus trap + restore) and respect
  `prefers-reduced-motion`.
- A single **command registry** as the source of truth shared by the palette,
  help overlay, and (where applicable) the router — so nothing drifts.
- A Playwright-Electron E2E that completes a full journey using **keyboard input
  only** (no `.click()`).

### Out of scope (this cycle)

- macOS/Linux platform compatibility / builds (explicitly deferred by operator).
- Split panes, multi-session-per-project, LSP (deferred unless they serve nav).
- User-customizable/remappable keybindings (a fixed, documented map ships now;
  remapping is a future cycle).
- Vim-style modal editing inside Monaco (Monaco keeps its own bindings; we only
  add app-level chords around it).
- Theming the torn-off window's new chrome beyond what it already inherits.

## 3. User stories

- As a keyboard-first developer, I want to move focus between the explorer,
  terminal, and editor with a chord so that I never reach for the mouse.
- As a user who forgets shortcuts, I want a command palette that lists every
  action with its shortcut so that I can run anything by typing its name.
- As a screen-reader / assistive-tech user, I want the file tree and overlays to
  follow ARIA patterns so that I can operate Weft non-visually.
- As a user sensitive to motion, I want overlay animations to stop under
  `prefers-reduced-motion` so the UI stays comfortable.
- As a terminal power user, I want my `Ctrl+C`/arrows/`Ctrl+R` to keep reaching
  the PTY so that new app shortcuts never break my shell.

## 4. Acceptance criteria

The authoritative, machine-checkable list is in `documents/steiner-spec.md`
under `## Expansion 6 — Mouseless / keyboard-only navigation`. Summary:

- Command palette (`Ctrl+Shift+P`): fuzzy filter, ↑/↓ + Enter, Esc restores
  focus; lists commands with their shortcuts; accessible listbox.
- Keyboard help overlay: grouped cheat sheet, Esc closes.
- Region focus: cycle (`Ctrl+F6` / `Ctrl+Shift+F6`) + direct chords (focus
  terminal, focus explorer); visible focus ring everywhere.
- Explorer: full ARIA tree keyboard nav with roving tabindex.
- Tabs: reorder + rename (F2) + shell-vs-claude selection by keyboard.
- Viewer: View/Edit/Diff/Reveal/Close reachable by keyboard; app-level Ctrl+S.
- Status bar: theme + resume by command.
- PTY passthrough preserved and regression-tested; overlays suspend passthrough.
- Full mouseless E2E journey (no `.click()`); coverage ≥ 95%.

## 5. Architecture & technical design

Follows Weft's layer boundary (pure `core/` + thin adapters).

- **`src/core/keybindings/keybinding-router.ts`** — extend the pure `routeKey`
  with the new `KeyAction`s (`command-palette`, `help-overlay`, `focus-region`,
  `focus-cycle{dir}`, `move-tab{dir}`, `rename-tab`, `save-file`, and route the
  existing `terminal-search` through it instead of the current out-of-band
  special case). Terminal-bound keys still map to `passthrough`. This is the one
  place chord→action lives; both the App listener and the xterm handler consult
  it, so they can never disagree.
- **`src/core/commands/registry.ts`** (new, pure) — the command catalog:
  `{ id, title, category, shortcutHint, when? }`. The palette renders it, the
  help overlay groups it, and it declares the canonical shortcut label for each
  command. Pure + unit-tested; the `run` handlers are injected by the renderer
  (kept out of core).
- **`src/core/commands/fuzzy.ts`** (new, pure) — the palette's fuzzy match/rank
  (subsequence match + score). Pure + unit-tested.
- **`src/core/explorer/tree-nav.ts`** (new, pure) — given the flattened list of
  visible tree nodes and the current index + key, return the next index and/or
  an expand/collapse/open intent. WAI-ARIA tree semantics live here, unit-tested;
  `Explorer.tsx` becomes a thin view that renders roving tabindex + calls it.
- **`src/renderer/`** — new `CommandPalette.tsx` and `KeyboardHelp.tsx` overlays
  (focus-trapped, aria roles, reduced-motion aware); a `useRegionFocus` hook /
  small focus manager that owns region refs and `.focus()`; wire the router's new
  actions in `App.tsx`; roving-tabindex + `onKeyDown` in `Explorer.tsx`;
  keyboard mode switches + app-level Ctrl+S in `ViewerPane.tsx`.
- **`src/renderer/styles.css`** — a global `:focus-visible` indicator using the
  existing `--st-*`/theme variables (and a cyberpunk-specific neon variant),
  respecting `prefers-reduced-motion` for any focus transition.

### Keymap (finalized against real ConPTY/TUI verification during implementation)

| Chord | Action |
|---|---|
| `Ctrl+Shift+P` | Open command palette |
| `Ctrl+Shift+/` (`Ctrl+?`) | Open keyboard help overlay |
| `Ctrl+F6` / `Ctrl+Shift+F6` | Cycle focus region forward / back |
| `` Ctrl+` `` | Focus terminal |
| `Ctrl+Shift+E` | Focus explorer |
| `F2` | Rename active tab |
| `Ctrl+Shift+PageUp` / `PageDown` | Move active tab left / right |
| `Ctrl+S` | Save (when viewer region focused) |
| `Ctrl+T` / `Ctrl+W` / `Ctrl+Tab` / `Ctrl+1..9` | (existing) new / close / cycle / jump tab |
| `Ctrl+C`, arrows, `Ctrl+R/D/Z/L/A/E`, F-keys, Alt/Meta | (unchanged) passthrough to PTY |

Anything not on a dedicated chord (theme cycle, resume toggle, View/Edit/Diff,
Reveal, open project, new shell tab) is runnable from the command palette.

> Exact chords may shift slightly during implementation if a chord is found to
> collide with a key a real `claude` TUI needs — the router + registry keep such
> a change to a single edit.

## 6. UI/UX considerations

- **Focus ring**: a clear, theme-aware `:focus-visible` outline on tabs, tree
  nodes, buttons, inputs, and overlay options. Cyberpunk gets a neon variant.
- **Palette**: centered modal, search input auto-focused, results as an
  accessible `listbox`/`option` list, `aria-activedescendant` for the highlighted
  row; shows the shortcut on the right of each row; empty-state message.
- **Help overlay**: grouped table (Tabs / Focus / Explorer / Viewer / General),
  Esc to close.
- **Focus trap**: while an overlay is open, Tab cycles within it and Esc closes,
  restoring focus to the region that was active before it opened.
- **States**: overlays render nothing when closed; no layout shift.

## 7. Security considerations

- No new IPC that takes untrusted paths beyond the already-validated `saveFile`
  (root-confined, ≤5 MB). The app-level Ctrl+S reuses that guarded path.
- Command `run` handlers are renderer-local; the palette cannot invoke arbitrary
  main-process operations — only the registered, existing commands.

## 8. Performance considerations

- Fuzzy filtering runs over a small, fixed command list (dozens of entries) — no
  perf concern; pure and synchronous.
- Explorer nav operates on the already-rendered visible-node list; roving
  tabindex avoids N tab stops.

## 9. Edge cases & error handling

- Overlay open while terminal focused → passthrough suspended so the overlay
  gets keys; restored on close.
- `Ctrl+S` with no viewer open / viewer not dirty → no-op (no error).
- Region-focus chord when a region is absent (no viewer open, no tabs) → skip to
  the next available region.
- Explorer arrow nav at first/last node, or on a leaf with →/← → no-op / move to
  parent per ARIA spec.
- Rename (F2) with no active tab → no-op.
- Palette open, then the underlying state changes (tab closed) → palette command
  still resolves safely or is a no-op.

## 10. Testing strategy

- **Unit (pure core)**: router actions incl. the protected passthrough set;
  command registry integrity (unique ids, every command has a title; shortcuts
  referenced by the help overlay exist); fuzzy match/rank; tree-nav transitions
  (↑/↓/←/→/Home/End/Enter across a fixture tree).
- **Component (jsdom)**: palette (filter, keyboard select, Esc restore, aria
  roles); help overlay; Explorer roving tabindex + onKeyDown; ViewerPane keyboard
  mode switches + Ctrl+S; focus-region hook.
- **E2E (Playwright-Electron)**: one mouseless journey using keyboard input only
  (no `.click()`), asserting each outcome; plus a focus-ring visibility check and
  a passthrough check (typing `Ctrl+C`-style input still reaches the PTY).

## 11. Dependencies

- No new runtime dependencies expected (fuzzy matching is hand-rolled and pure).
  If a tiny, well-vetted fuzzy lib is chosen instead, it must be pure and tree-
  shakeable — decide during implementation; default is hand-rolled.

## 12. Migration & rollback plan

- Additive only: no persistence schema change (keymap is fixed/not stored this
  cycle). Rollback = revert the cycle's commits; no data migration involved.

## 13. Open questions

- Should region-focus cycle include the status bar as a stop, or keep it
  command-only? (Leaning: include it in the cycle for completeness.)
- Should the help overlay be a distinct surface or a mode of the palette?
  (Leaning: distinct, simpler; palette focuses on *running* commands.)
- Is `Ctrl+F6` ergonomic enough, or should we also accept plain `F6`? (Risk:
  plain `F6` breaks passthrough for TUIs that use it — default to `Ctrl+F6`.)

## 14. Todo list

- [ ] Extend `keybinding-router` with new actions; route terminal-search through
      it; regression-test the passthrough set.
- [ ] Pure command registry + fuzzy match (unit-tested).
- [ ] Command palette overlay (accessible, focus-trapped, reduced-motion).
- [ ] Keyboard help overlay.
- [ ] Region-focus system + visible `:focus-visible` styling (all themes).
- [ ] Explorer keyboard nav (pure `tree-nav` + roving tabindex view).
- [ ] Tab reorder / rename (F2) / shell-vs-claude by keyboard.
- [ ] Viewer mode switches + app-level Ctrl+S.
- [ ] Status-bar controls via commands.
- [ ] Full mouseless E2E journey; coverage ≥ 95%.
- [ ] Update USAGE.md (keyboard section) + README.
