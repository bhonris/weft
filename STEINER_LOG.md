# Steiner Log — weft

> Reading Steiner: the lab's memory across worldline shifts. Newest leap on top.

## EL PSY KONGROO — Leap 48 — the worldline is sealed (Cycle 6) — 2026-07-18

**Operator end goal — a fully mouseless, keyboard-only Weft — is complete.** Every part of the app is now reachable and operable from the keyboard alone, with the terminal-key passthrough invariant intact.

**Shipped this cycle (all 13 Expansion 6 ACs):** single pure `keybinding-router` (passthrough regression-tested) with `Ctrl+Shift+F` folded in; command palette (`Ctrl+Shift+P`, pure registry + fuzzy, accessible listbox, focus restore); keyboard help overlay (`Ctrl+?`); region focus (`Ctrl+``, `Ctrl+Shift+E`, `Ctrl+F6`) that skips absent regions; theme-aware `:focus-visible` rings incl. cyberpunk; WAI-ARIA explorer tree keyboard nav (pure `tree-nav` + roving tabindex); keyboard tab reorder / `F2` rename / shell-vs-claude; viewer View/Edit/Diff/Reveal/Close + app-level `Ctrl+S`; status theme/resume commands; focus-trapped overlays that suspend passthrough; and a Playwright-Electron **mouseless journey (no `.click()`)**.

**Final meter:** 324 unit + 27 Playwright-Electron E2E, 0 failures · 98.48% stmts / 96.47% branch · strict typecheck clean · 48 leaps, 6 cycles. Adversarial review (Future Okabe ×3) found and convergence fixed one real bug (viewer.save palette no-op) that 98% coverage had missed.

**Scope honored:** macOS/Linux and split panes/LSP were left out per the operator's directive.

**For the next worldline (re-invoke /dmail in weft/ for cycle 7):** user-customizable/remappable keybindings; unify the two dispatch switches (KeyAction vs CommandId) to prevent drift; palette-triggered terminal search + rename (need small signal stores); split panes; LSP; macOS/Linux; the one still-manual OS-toast check from v0.1.0.

*El Psy Kongroo.*

---

## Worldline 6 Stabilised — Leap 47 — steiner: worldline-6-stable — 2026-07-18

**Phase**: worldline-checkpoint → worldline-expansion
**Changed**: Cycle-6 checkpoint. Final meter: **324 unit + 27 Playwright-Electron E2E, 0 fail; coverage 98.48/96.47/97.15** (gate 95/90). Docs: USAGE gained a full **Keyboard navigation (mouseless)** section; README + DOSSIER refreshed (counts + Cycle-6 acceptance snapshot, all 13 boxes checked). **Mayuri (non-programmer) review** verdict: DOCUMENTATION gap, not a code gap — she could go mouseless but the docs assumed knowledge; fixed immediately: added a "start here", a plain-words definition of *focus*/*region*, how to **open a project by keyboard** (palette → Open Project → the OS folder dialog is keyboard-navigable), the backtick-key hint, terminal-search cross-ref, and reconciled F2-vs-double-click rename. Fixed a Playwright startup race in the mouseless spec (wait for the shell to mount before the first chord — `domcontentloaded` precedes React's listener attach); verified stable across repeats. All 25 v1 + Expansion 2/3/5/6 criteria met.
**SERN interference**: the E2E startup race (fixed with a shell-ready wait) — lesson recorded.
**Divergence meter**: 324 unit + 27 e2e, 0 fail; 98.48% stmts.
**Next target**: Phase 7 — Okabe budget check (leap 47/50 ≥ 0.9 → graceful EL PSY KONGROO).

---

## Leap 46 — steiner: fix(convergence) — all must-fix resolved — 2026-07-18

**Phase**: worldline-convergence
**Changed**: Fixed the review's must-fix. **viewer-save-noop + duplicate-keyboardhelp-case**: replaced the dead duplicate `case 'general.keyboardHelp'` in `runCommand` with the missing `case 'viewer.save': requestSave()` — "Save File" from the palette now saves (data-loss bug gone). Cleanups: `focusEl` returns void; dropped the unused `'Explorer'` entry from `CATEGORY_ORDER`. **Added the cycle-6 regression tests** the reviewers asked for: viewer.save via palette + app-level Ctrl+S (with negative Ctrl+Alt/Meta+S), overlay-stands-down (Ctrl+T ignored while palette open), passthrough neighbors (plain Ctrl+F/P/N/B/G/H), a real fuzzy-stability test (distinguishable equal-score items) + separator-bonus + query-longer-than-text, and Explorer Home/End + ArrowLeft-to-parent, and live region-cycle skipping absent regions (explorer→status with no tab/viewer). Larger nice-to-haves (unify the two dispatch switches, palette-triggered terminal search / rename, expand/collapse dedup) deferred near-budget.
**SERN interference**: none
**Divergence meter**: 324 unit pass (was 316), 0 fail; typecheck clean. All Expansion 6 acceptance criteria still met.
**Next target**: Phase 6 checkpoint — USAGE keyboard section + README/DOSSIER refresh + Mayuri review; final coverage + E2E; then Phase 7 (budget 46/50 → EL PSY KONGROO likely).

---

## Leap 45 — steiner: christina-review — 3 must-fix, 2 nice-to-have — 2026-07-18

**Phase**: christinas-analysis (Future Okabe ×3, parallel: simplicity / correctness+security / test-quality)
**Changed**: Adversarial review of the entire cycle-6 surface. All three reviewers independently found the same real defect: **`viewer.save` ("Save File") has no `runCommand` handler** — a duplicate `case 'general.keyboardHelp'` sits where the viewer.save case belongs, so the palette command is a silent no-op (data-loss risk in edit mode). Correctness verdict otherwise strong: the PTY-passthrough invariant holds (Ctrl+S is passthrough + viewer-region-local; no chord collides with terminal keys), focus trap/restore + stale-closure avoidance are sound, moveActiveTab/nextRegion/tree-nav edge cases correct. Recorded must-fix (viewer.save + the duplicate case + a batch of high-value missing regression tests) and 2 cheap nice-to-haves (focusEl unused return, dead 'Explorer' category). Larger items (unify the two dispatch switches; palette-triggered terminal search; palette-triggered rename; expand/collapse dedup) DEFERRED near-budget (leap 45/50) per the 0.8 budget rule.
**SERN interference**: none — the review working as designed (found a bug 98% coverage missed, exactly the cycle-1 lesson).
**Divergence meter**: 316 unit + 27 e2e, 0 fail; coverage 98.49/96.49/97.15 (gate 95/90).
**Next target**: Phase 5 convergence — fix viewer.save (+cleanups) and add the cycle-6 regression tests; keep green.

---

## Leap 44 — steiner: test(e2e) — mouseless keyboard journey (all 13 ACs done) — 2026-07-18

**Phase**: time-leap-development → christinas-analysis (all Expansion 6 criteria met)
**Changed**: `e2e/keyboard-nav.spec.ts` — a Playwright-Electron spec proving the whole experience with the KEYBOARD ONLY (zero `.click()`/mouse): open a tab via the command palette, Ctrl+Shift+E → arrow-nav → Enter to open a file into the viewer, Ctrl+` → type into the terminal (echo round-trips), Ctrl+C reaches the PTY (tab not closed, terminal still interactive), Ctrl+Shift+P → Cycle Theme flips `<html data-theme>`; plus a focus-ring test (keyboard focus yields a non-zero `outlineWidth`). Both pass against the real app. Fixed two PRE-EXISTING E2E theme assertions that assumed a `system` default — they broke when cyberpunk became the default theme (committed before this cycle; E2E hadn't been run since): spawn-error now expects cyberpunk→system→light→dark; persistence clicks 3× to reach dark. Marked all Expansion 6 ACs `[x]` in the spec and completed the feature-doc todo list.
**SERN interference**: the two stale theme E2E assertions (cyberpunk-default fallout) — fixed; lesson: run the full E2E after any default-changing manual commit.
**Divergence meter**: 316 unit + **27 Playwright-Electron E2E, all pass**; typecheck clean. Full mouseless journey machine-verified in the real Electron app.
**Next target**: Phase 4 — Future Okabe ×3 adversarial review (simplicity / correctness+security / test quality) of the cycle-6 surface.

---

## Leap 43 — steiner: feat(terminal-search-routing + status-commands) — 2026-07-18

**Phase**: time-leap-development (cycle 6) — AC2 closed
**Changed**: Folded the out-of-band `Ctrl+Shift+F` terminal-search into the pure router: added `{kind:'terminal-search'}` to `routeKey`, and `TerminalPane.attachCustomKeyEventHandler` now decides via `routeKey` (terminal-search → open + swallow; passthrough → to PTY; else swallow) instead of the hardcoded `isSearchChord` (removed). The router is now the SINGLE source both consumers agree on — the cycle-6-planning anti-pattern is gone. `general.terminalSearch` command gained `routes:'terminal-search'` (no-drift test still green) and dispatches to focusRegion('terminal') (search bar state stays TerminalPane-local; opens on the chord there). App window listener leaves terminal-search to `default:return` so it reaches the focused terminal. Updated the router test (Ctrl+Shift+F → terminal-search) and added an App palette test for Toggle Resume (status-bar command).
**SERN interference**: none
**Divergence meter**: 316 unit pass (was 315), 0 fail; typecheck clean.
**Next target**: Leap 44 — the mouseless E2E: a Playwright-Electron spec driving a full journey with keyboard input ONLY (no .click()) — palette open project, focus explorer, arrow-nav + Enter to open a file, focus terminal + type, switch tabs, cycle theme — plus a focus-ring-visible check and a Ctrl+C-reaches-PTY passthrough check. Then Phase 4 review.

---

## Leap 42 — steiner: feat(viewer-keyboard-control) — modes + app Ctrl+S — 2026-07-18

**Phase**: time-leap-development (cycle 6)
**Changed**: Made the Monaco viewer fully keyboard-operable. Lifted edit mode into the viewer-store (`editing`, `setEditing` — implies view mode; `setMode('diff')` drops editing; `saveTick` + `requestSave()`). ViewerPane now reads editing from the store and exposes a single `doSaveRef` save routine used by BOTH Monaco's Ctrl+S command (editor-focused) and a new saveTick effect (app-level). Wired `viewer.view/edit/diff/reveal/close` palette commands and an **app-level Ctrl+S** on the viewer-region wrapper: when focus is anywhere in the viewer region and a file is open+editing, it saves via the existing root-confined `saveFile` IPC — not only when Monaco holds focus. Commands are no-op-safe with no file open. Tests: viewer-store editing/saveTick/diff-resets-editing/close-resets; App runs viewer.diff via the palette.
**SERN interference**: none
**Divergence meter**: 315 unit pass (was 311), 0 fail; typecheck clean. 4 new tests.
**Next target**: Leap 43 — status-bar controls via commands (general.cycleTheme + general.toggleResume already dispatch — verify + add App palette tests) and fold the out-of-band Ctrl+Shift+F terminal-search through the router (AC2): add terminal-search to routeKey, route it in TerminalPane via routeKey instead of the special-case, keep App standing down while... actually terminal-search stays terminal-local; ensure the router + TerminalPane agree. Then Leap 44 mouseless E2E.

---

## Leap 41 — steiner: feat(keyboard-tab-management) — reorder + F2 rename — 2026-07-18

**Phase**: time-leap-development (cycle 6)
**Changed**: Keyboard-complete tab management. Store `moveActiveTab(dir)` reorders the active tab one slot L/R, clamping at ends (+2 unit tests). Wired the router `move-tab` action (Ctrl+Shift+PageUp/PageDown) and the `tab.moveLeft/moveRight` palette commands to it. F2 rename: a LOCAL `onKeyDown` on the focused tab-label button enters the existing inline rename input (kept out of the global router so F2 still reaches a TUI when the terminal is focused). Verified shell-vs-claude new-tab is keyboard-reachable via the palette (`tab.new` → openProject, `tab.newShell` → openProject('shell')). App tests: Ctrl+Shift+PageUp/PageDown reorder; F2 → inline rename → Enter commits.
**SERN interference**: one test-only fix — the tab exposes three buttons matching /proj/ (label/tear-off/close); targeted the label by its exact accessible name.
**Divergence meter**: 311 unit pass (was 307), 0 fail; typecheck clean. 4 new tests.
**Next target**: Leap 42 — viewer keyboard control: make View/Edit/Diff/Reveal/Close reachable by keyboard (lift viewer edit-mode into the viewer store so palette viewer.* commands work) + app-level Ctrl+S that saves when the viewer region is focused (guarded saveFile IPC), not only when Monaco holds focus.

---

## Leap 40 — steiner: feat(explorer-keyboard-nav) — ARIA tree — 2026-07-18

**Phase**: time-leap-development (cycle 6)
**Changed**: Pure `core/explorer/tree-nav.ts` (`treeNav(nodes, index, key) → intent`: ↑/↓ clamp, Home/End, →/← expand-or-first-child / collapse-or-parent, Enter/Space activate; 11 tests over a fixture tree). Rewrote `Explorer.tsx` from per-node local state into a **flattened roving-tabindex tree**: centralized `expanded` Set + `childrenByPath` cache, a memoized `visible` flatten, exactly one node with `tabIndex=0`, `onKeyDown`→`treeNav`→apply (move focus / expand / collapse / open-file-or-toggle), and `aria-level`/`aria-selected`/`aria-expanded`. Lazy-load stays (expanded dirs fetched, refetched on fs-change version bump). `focusRegion('explorer')` now targets the roving node. Click/dblclick behavior preserved. Existing 9 Explorer tests stayed green through the rewrite; added 4 keyboard tests (arrow roving + tabindex, right/left expand/collapse, Enter opens file, aria-level).
**SERN interference**: none — the pre-existing Explorer suite passing unchanged validated the refactor kept behavior.
**Divergence meter**: 307 unit pass (was 293), 0 fail; typecheck clean. 15 new tests.
**Next target**: Leap 41 — keyboard tab management: reorder active tab (Ctrl+Shift+PageUp/PageDown → move-tab), rename via F2 (local key on the focused tab), and shell-vs-claude new tab by keyboard (palette 'tab.newShell'/'tab.new' already dispatch; verify + a chord if needed). Add store `moveActiveTab(dir)`.

---

## Leap 39 — steiner: feat(region-focus + focus-rings) — 2026-07-18

**Phase**: time-leap-development (cycle 6)
**Changed**: Keyboard focus movement between UI regions. Pure `core/focus/region-cycle.ts` (`RegionId`, `REGION_ORDER`, `nextRegion(present, current, dir)` — canonical order, skips absent regions, wraps; 8 tests). In App: region refs (tab strip / explorer / terminal / viewer / status) + `focusRegion(id)` (focuses the best target: active tab label, first treeitem, xterm textarea, viewer control, first status button — with focusable-shell fallbacks) + live `presentRegions()` (reads store/viewer via getState to dodge stale closures) + `cycleRegion(dir)`. Wired the router's `focus-region` (Ctrl+` terminal, Ctrl+Shift+E explorer) and `focus-cycle` (Ctrl+F6 / Ctrl+Shift+F6) plus the `focus.*` palette commands. Restructured `terminal-host` into a `.terminal-region` (absolute-fill, tabIndex -1) + layout-transparent `.viewer-region` (display:contents) so the viewer still overlays exactly as before. Fixed a focus ordering bug: the palette now restores focus synchronously inside `run()` and suppresses its close-effect restore, so a Focus-* command run from the palette keeps its focus while non-focus commands still land focus sensibly. Added theme-aware `:focus-visible` rings (cyberpunk neon variant, motion-free) across buttons/inputs/treeitems/options/regions.
**SERN interference**: none
**Divergence meter**: 293 unit pass (was 283), 0 fail; typecheck clean. 11 new tests (8 region-cycle + 3 App region-focus).
**Next target**: Leap 40 — pure `core/explorer/tree-nav` (ARIA tree: ↑/↓/→/←/Home/End/Enter over a flattened visible-node list) + Explorer roving tabindex + onKeyDown + aria-level/aria-selected; keyboard file-open. Then Leap 41 tab reorder/rename(F2)/type.

---

## Leap 38 — steiner: feat(keyboard-help) — Ctrl+Shift+/ cheat sheet — 2026-07-18

**Phase**: time-leap-development (cycle 6)
**Changed**: `KeyboardHelp.tsx` — a modal, focus-trapped cheat sheet (Ctrl+Shift+/) listing every shortcut-bearing command grouped by `CATEGORY_ORDER` (two-column `<dl>` with `<kbd>` labels), Esc + × close, focus restored on close. Refactored App's overlay state from a lone `paletteOpen` boolean to a single `overlay: 'none'|'palette'|'help'` union (mutually exclusive), with each overlay's `onClose` using a functional guard (`o === 'palette' ? 'none' : o`) so running a command that opens the OTHER overlay from the palette isn't clobbered by the palette's own close. Wired `help-overlay` (router chord) + `general.keyboardHelp` (dispatch). Added help CSS (theme-agnostic + cyberpunk).
**SERN interference**: none
**Divergence meter**: 283 unit pass (was 276), 0 fail; typecheck clean. 7 new tests (6 help + 1 App Ctrl+Shift+/).
**Next target**: Leap 39 — region-focus system (Ctrl+F6/Ctrl+Shift+F6 cycle, Ctrl+` terminal, Ctrl+Shift+E explorer) via a focus manager + refs, wired to focus-region/focus-cycle actions; plus theme-aware `:focus-visible` rings on tabs/tree/buttons/options (incl. cyberpunk), reduced-motion-safe. First real DOM-focus movement between regions.

---

## Leap 37 — steiner: feat(command-palette) — Ctrl+Shift+P + robust dispatch — 2026-07-18

**Phase**: time-leap-development (cycle 6, first renderer leap)
**Changed**: `CommandPalette.tsx` — an accessible, focus-trapped modal combobox+listbox backed by `COMMANDS` + `fuzzyFilter`: autofocused search input, ↑/↓/Home/End move the highlight (aria-activedescendant), Enter runs, Esc closes, backdrop-click closes, Tab trapped, and DOM focus RESTORED to the prior element on close. Wired into `App.tsx`: added `paletteOpen` state + an `overlayOpenRef` so the stable window keydown listener can stand down while an overlay owns the keyboard; a renderer-owned `runCommand(id)` dispatch (tab new/shell/open/close/next/prev, cycle theme, toggle resume wired now; focus/viewer/move/rename/help/search are safe no-ops until their leaps). **Hardened the App listener**: it now preventDefaults/acts ONLY on handled KeyActions and `default: return`s for passthrough + not-yet-wired chords, so they reach the PTY instead of being swallowed. Extracted `nextTheme`/`THEME_CYCLE` into the store and reused them for both the status-bar toggle and the Cycle-Theme command. Added palette CSS (theme-agnostic + cyberpunk variant).
**SERN interference**: none. (Avoided a jest-dom trap: repo has no `@testing-library/jest-dom`, so tests use `document.activeElement` instead of `toHaveFocus`.)
**Divergence meter**: 276 unit pass (was 267), 0 fail; typecheck clean. 9 new tests (8 palette + 1 App Ctrl+Shift+P→open→run→close).
**Next target**: Leap 38 — KeyboardHelp overlay (Ctrl+Shift+/): grouped shortcut cheat-sheet from COMMANDS/CATEGORY_ORDER, Esc closes, focus-trap + restore; wire help-overlay action + guard it under overlayOpenRef.

---

## Leap 36 — steiner: feat(commands) — pure registry + fuzzy match — 2026-07-18

**Phase**: time-leap-development (cycle 6)
**Changed**: The pure command layer (no UI, no I/O). `core/commands/registry.ts`: a `Command` type ({id, title, category, shortcutHint?, routes?}) + the canonical 24-command catalog (tabs, focus, viewer, general) + `CATEGORY_ORDER` for help grouping; `run` handlers stay in the renderer. `core/commands/chord.ts`: `parseChord("Ctrl+Shift+P")→KeyLike` (modifier aliases, null on empty/modifier-only). `core/commands/fuzzy.ts`: case-insensitive subsequence `fuzzyMatch` (word-boundary + consecutive-run scoring, leading-gap penalty) + stable `fuzzyFilter`. Tests (29 new across 3 files): registry id-uniqueness + **no-drift guard** — every `routes` command's `shortcutHint` really produces that KeyAction via `routeKey`, and every local-shortcut command (F2/Ctrl+S/Ctrl+Shift+F) routes to passthrough by design; chord parsing; fuzzy ranking/stability. Caught two bugs in-leap: a bad test fixture ('new' isn't a subsequence of 'Rename Tab') and two `noUncheckedIndexedAccess` typecheck errors.
**SERN interference**: none (both issues fixed inline)
**Divergence meter**: 267 unit pass (was 241), 0 fail; typecheck clean
**Next target**: Leap 37 — CommandPalette overlay (Ctrl+Shift+P): accessible listbox, fuzzy filter, ↑/↓/Enter/Esc, focus restore; make the App listener robust (act only on handled KeyActions) and wire palette + the already-routed chords. First renderer leap of the cycle.

---

## Leap 35 — steiner: feat(keybinding-router) — cycle-6 chords + passthrough guard — 2026-07-18

**Phase**: time-leap-development (cycle 6)
**Changed**: Extended the pure `keybinding-router` (`routeKey`) with the Expansion-6 global chords — `command-palette` (Ctrl+Shift+P), `help-overlay` (Ctrl+Shift+/ or Ctrl+?), `focus-region` (Ctrl+` → terminal, Ctrl+Shift+E → explorer), `focus-cycle` (Ctrl+F6 / Ctrl+Shift+F6), `move-tab` (Ctrl+Shift+PageUp/PageDown) — plus a new `FocusRegion` type. Deliberately kept region-LOCAL keys OUT of the global router (F2-rename on a focused tab, explorer arrows, Ctrl+S while viewer-focused) so they only act in context and otherwise pass through to the PTY. Left `Ctrl+Shift+F` as passthrough so the existing TerminalPane in-terminal search keeps working (fold-in deferred to the consumer-wiring leap). Rewrote the router test into an 11-case suite with a hardened **passthrough regression**: Ctrl+C/R/D/Z/L/A/E/S/Q/K/U/0, plain keys, Alt/Meta, all function keys except Ctrl+F6 (incl. plain F2), arrows, Home/End, plain+Ctrl PageUp/PageDown, Ctrl+Shift+F, and unclaimed Ctrl+Shift+letters all route to `passthrough`.
**SERN interference**: none
**Divergence meter**: keybindings suite 11 pass; typecheck clean (consumers untouched this leap — new chords are inert no-ops until wired next leap)
**Next target**: Leap 36 — pure `core/commands` registry (id/title/category/shortcutHint, unique-id + shortcut-integrity tests) + pure `core/commands/fuzzy` match/rank; no UI yet.

---

## Leap 34 — steiner: expansion-6-planned — mouseless keyboard navigation — 2026-07-18

**Phase**: worldline-expansion → time-leap-development (cycle 6 opened, budget extended to 50)
**Changed**: Operator re-opened the worldline with a new END GOAL: a fully mouseless, keyboard-only experience. Audited current keyboard/focus support (pure `keybinding-router` exists with Ctrl+T/W/Tab/1-9; explorer has ARIA roles but no arrow-key nav; ZERO focus styling in CSS; region-to-region focus, viewer mode switches, status-bar controls, tab reorder/rename/type all mouse-only; no command palette/help). Authored `documents/keyboard-navigation.md` (feature doc, global New Feature Workflow) and appended `## Expansion 6` to `documents/steiner-spec.md` with 12 machine-checkable ACs: extend the single pure router (regression-test the protected passthrough set + route the out-of-band Ctrl+Shift+F through it), command palette (Ctrl+Shift+P, pure registry + fuzzy), help overlay (Ctrl+?), region focus (Ctrl+F6 cycle, Ctrl+` terminal, Ctrl+Shift+E explorer), theme-aware `:focus-visible` rings (incl. cyberpunk), pure `tree-nav` explorer keyboard nav with roving tabindex, keyboard tab reorder/rename(F2)/type, viewer mode switches + app-level Ctrl+S, status controls via commands, overlay focus-trap + passthrough suspend, and a no-`.click()` mouseless E2E journey. Scope explicitly excludes macOS/Linux + split panes/LSP. Also recorded the two post-v0.2.0 manual enhancements (whole-tab coloring, cyberpunk default theme) in DOSSIER.
**SERN interference**: none
**Divergence meter**: 241 unit pass, 0 fail; typecheck clean (baseline before cycle-6 code)
**Next target**: Leap 35 — extend `keybinding-router` with the new KeyActions + regression-test the passthrough set + route terminal-search through it (pure core, no UI yet).

---

## Manual entry (outside /dmail loop) — whole-tab state coloring — 2026-07-18

**Phase**: post-end-goal manual enhancement (not a Steiner leap; loop remains at `el-psy-kongroo`)
**Changed**: extended per-tab status from a colored glyph to the **whole tab** — each tab now carries its `SessionStatus` as a colored top stripe + background tint (`App.tsx` adds a `tab--<status>` modifier; `styles.css` adds shared `--st-*` vars and `color-mix` tints; glyph colors refactored to the same vars). Added `src/renderer/App.test.tsx` regression tests (status→class transitions + per-tab scoping). Reconciled the stale `documents/design-doc.md` todo list against shipped reality and moved it (with a new `tab-state-colors.md` feature doc) into `documents/completed/`.
**SERN interference**: pre-existing `hook-forwarder.integration.test.ts` failure when the suite runs inside a live Weft session (inherits real `CLAUDE_IDE_TAB` via `...process.env`) — not caused by this change.
**Divergence meter**: renderer tests green (2 new pass); typecheck clean.
**Next target**: unchanged — next `/dmail` cycle 6 candidates (split panes, LSP, macOS/Linux). Optionally fold this enhancement into a future expansion's spec checkboxes.

---

## END GOAL REACHED — Leap 33 — v0.2.0 "Daily Driver" shipped — 2026-07-18T08:10:00Z

**The operator-declared end goal is complete.** All four outcomes delivered and machine-verified:
1. ✅ Conversation resume — schema-v2 sessionId persistence + ↻ toggle + `--resume`, argv-injection-proofed.
2. ✅ Monaco Edit mode — dirty ●, Ctrl+S through a root-confined, size-capped saveFile IPC; E2E asserts bytes on disk.
3. ✅ Git branch (⎇) in the status bar via unit-tested GitService.
4. ✅ Dependencies pruned (dockview/webgl/serialize).

**Final meter**: 229 unit/integration + 24 Playwright-Electron E2E (incl. packaged exe), 0 failures · strict typecheck clean · 46/46 spec checkboxes across v1 + Expansions 2/3/5 · version 0.2.0 + CHANGELOG · 33 leaps, 5 cycles.
**For the next worldline**: split panes / multi-session-per-project, LSP, macOS/Linux platform fill-ins, CI first-run on a real remote, the one manual toast check.

*El Psy Kongroo.*

---

## Leap 32 — steiner: feat(monaco-edit) — 2026-07-18T07:40:00Z

**Phase**: cycle 5 — final end-goal feature
**Changed**: Monaco Edit mode. Pure core/fs/path-guard (isPathInside/isInsideAnyRoot — separator+case normalized, rejects prefix-lookalikes like C:/proj-evil; 6 tests). saveFile IPC: type-validated, confined to open project roots (getWritableRoots ← pty.tabRefs), content ≤5MB via DiffService.saveFileText (unit-tested). ViewerPane: View|Edit|Diff toggles, editable model, dirty ● indicator, Ctrl+S saves through the guarded IPC with error surface. E2E: enter Edit, type at top of git fixture file, dirty appears, Ctrl+S clears it, and the BYTES ON DISK contain the edit. (Cleanly rewrote register-fs.test after a codemod splice corrupted it.)
**SERN interference**: one corrupted test file from a sloppy codemod — rewritten by hand; lesson: no lastIndexOf splices
**Divergence meter**: 229 unit + 24 e2e, 0 fail
**Next target**: v0.2.0 stamp — the declared END GOAL is functionally complete.

---

## Leap 29–31 — cycle 5 under way: END GOAL v0.2.0 "Daily Driver" — 2026-07-18T07:00:00Z

**Phase**: time-leap-development (cycle 5, budget extended to 40 by operator)
**Changed**: L29 deps pruned (dockview/webgl/serialize gone, suite green). L30 GitService (exec-injected, 4 tests) + getGitBranch IPC + status-bar ⎇ branch display, E2E-asserted in the git fixture. L31 conversation resume: schema v2 (resumeEnabled + REAL per-tab sessionId persisted; v1→v2 migration; all persistence tests updated), createSession returns sessionId end-to-end, restore passes `--resume <savedId>` for dead claude tabs when the status-bar ↻ resume toggle (persisted, E2E across restart) is on — never for shell tabs or legacy placeholder ids. Boundary: resumeSessionId validated with a leading-alphanumeric regex after the unit test CAUGHT that a naive charset regex would let `--dangerously-skip-permissions` masquerade as an id and reach claude's argv.
**SERN interference**: none — the failing test was the defense working
**Divergence meter**: 222 unit + 23 e2e, 0 fail
**Next target**: Monaco edit+save (validated saveFile IPC, dirty indicator, Ctrl+S, E2E), then v0.2.0 stamp.

---

## EL PSY KONGROO — Leap 28 — the worldline is sealed — 2026-07-18T06:00:00Z

**Final state**: v0.1.0. 28 leaps, 4 expansion cycles, 40+ steiner commits.
**Meter**: 214 unit/integration + 23 Playwright-Electron E2E (incl. packaged-exe), 0 failures · ~98% stmt / ~96% branch coverage · typecheck strict-clean.
**Shipped**: every v1 spec criterion (25) + Expansion 2 (11) + Expansion 3 (4) — 39/39 checked. Tabbed Claude sessions on real ConPTY; hook-driven badges over a named pipe; reload-proof session reconciliation (same-PID, E2E-proven through the real UI); tear-off/re-dock; OS notifications with focus routing; live explorer; Monaco diff; versioned persistence with backups and bounds clamping; keybindings with strict PTY passthrough; in-terminal search; shell tabs; themes; error states; LICENSE/CONTRIBUTING/CI; E2E-verified electron-builder packaging.
**Honest remainders** (for the next worldline): one manual verification outstanding (real OS toast render/click — policy fully unit-tested); CI workflow is authored but has never run on GitHub (no remote); dockview/serialize deps unused (tab strip is bespoke — evaluate or drop them in v2); node-pty pinned at 1.1.0 by the committed Spectre patch.
**Budget**: stopped at 28/30 per the 0.9 graceful-stop rule. Re-invoke /dmail in `weft/` to open expansion cycle 5 with a fresh budget (candidates in DOSSIER/spec Open Questions: split panes, `claude --continue` resume, full Monaco editing, macOS/Linux platform fill-ins).

*El Psy Kongroo.*

---

## Leap 26 — steiner: release(v0.1.0) — 2026-07-18T05:30:00Z

**Phase**: cycle 4
**Changed**: Version stamped 0.1.0; CHANGELOG.md written (full feature list, tooling, notable decisions incl. the WebGL rejection and the api-level-E2E lesson). Final verification: 214 unit + 23 e2e green, typecheck clean.
**SERN interference**: none
**Divergence meter**: 214 unit + 23 e2e, 0 fail
**Next target**: budget 26/30. Remaining leaps: operator-instructed continuous improvement until token/leap budget exhausts; EL_PSY_KONGROO no later than 29.

---

## Leap 25 — steiner: perf(terminal) scrollback cap; WebGL rejected with evidence — 2026-07-18T05:10:00Z

**Phase**: cycle 4 (small quality leaps under budget)
**Changed**: xterm scrollback capped at 8000 lines/tab (spec §4.3 memory bound). Trialled the WebGL renderer addon: it moved terminal text out of the DOM — ALL 8 text-assertion E2E went dark, and DOM-based assistive-tech access would degrade identically. Reverted deliberately with an in-code decision comment (revisit only with a measured throughput problem). This is the E2E suite doing exactly its job: catching an "optimization" that silently destroyed testability+a11y.
**SERN interference**: the 8 E2E failures were the signal, not noise
**Divergence meter**: 214 unit + 23 e2e, 0 fail
**Next target**: remaining budget 25/30 — inactive-tab buffer note is main-side (already ring-buffered, no serialize addon needed); candidates: CHANGELOG, version 0.1.0 stamp, final polish; EL_PSY_KONGROO by 29.

---

## Worldline 3 Stabilised — Leap 24 — steiner: worldline-3-stable — 2026-07-18T04:40:00Z

**Phase**: cycle 3 (OSS hygiene + packaging) — all 4 Expansion-3 ACs done in one leap
**Changed**: LICENSE (MIT) at repo root (design-doc §17 debt). CONTRIBUTING.md (dev setup, test bar, architecture boundary table, IPC checklist, E2E conventions incl. the api-level-masking lesson). .github/workflows/ci.yml (typecheck+unit+coverage matrix win/linux; E2E job on windows-latest with rebuild:native). electron-builder 26 + electron-builder.yml (asarUnpack node-pty, npmRebuild:false so the Spectre patch stays authoritative, NSIS target) + package:dir script. VERIFIED FOR REAL: pnpm package:dir produced release/win-unpacked/Weft.exe and a new e2e/packaged.spec.ts (skips when no build present) launched the PACKAGED exe, opened a project, and echoed through the packaged ConPTY — the distributable genuinely works. Full suite: 214 unit + 23 e2e green. All 39 spec checkboxes checked.
**SERN interference**: none
**Divergence meter**: 214 unit + 23 e2e (incl. packaged-exe), 0 fail
**Next target**: budget 24/30 (0.8) — continue small-value leaps while budget remains per operator instruction; candidates: xterm serialize-based inactive-tab rehydration, WebGL renderer addon, explorer virtualization. Graceful EL_PSY_KONGROO by 27+.

---

## Worldline 2 Stabilised — Leap 23 — steiner: worldline-2-stable — 2026-07-18T04:00:00Z

**Phase**: cycle-2 checkpoint → worldline-expansion (cycle 3)
**Changed**: Final Expansion-2 items: correlator cwd matching normalizes separators/trailing-slash/case (Windows hooks report C:\\proj vs stored C:/proj — 4 new assertions); persistence E2E extended (2 tabs + renames + dark theme survive restart, order preserved). All 35 spec checkboxes (25 v1 + 10 expansion — the 11th folded into e2e-hygiene) checked. USAGE gained shell-tabs + find-in-terminal + Reveal/5MB sections; README/USAGE test counts refreshed (214 unit + 22 e2e). DOSSIER cycle-2 close-out; every cycle-1 review item closed, none carried.
**SERN interference**: none
**Divergence meter**: 214 unit + 22 e2e, 0 fail
**Next target**: Cycle 3 — open-source hygiene (LICENSE file, CONTRIBUTING.md, GitHub Actions CI) + electron-builder packaging config; then Okabe budget check (≥0.8 of 30 → graceful EL_PSY_KONGROO unless tokens remain).

---

## Leap 22 — steiner: feat(expansion-2) hardening sweep + shell tabs + terminal search — 2026-07-18T03:30:00Z

**Phase**: time-leap-development (cycle 2)
**Changed**: 9 of 11 Expansion-2 ACs in one leap. Hardening: FrameParser 1MB newline-less flood cap (drops+reports, recovers); NetTransport chmod 0600 + unlink for POSIX UDS (pipe paths untouched); DiffService 5MB stat-guard with friendly viewer error + `-c core.quotepath=false` on both git calls (non-ASCII filenames); dead-code sweep (renameTab/reorderTabs channels+API removed with a doc note, needsMigration/isOk deleted, mapHookToStatus dropped its ceremonial _prev param — dedup stays in StatusServer); ViewerPane Reveal button (revealInOs finally has its UI); spawn-failure state moved into the zustand store (module-level mutable listener gone, addSessionTab dedup helper); safeSend dropAttachment dedupe. E2E hygiene: e2e/helpers.ts launchWeft() strips ALL inherited WEFT_* env + fresh userData per launch (codemod across all 10 specs); persistence spec polls config.json on disk instead of sleeping 500ms. Features: Shift+Click + opens a plain SHELL tab (openProject command override through contract/bridge/register; E2E proves it works while claude is broken); Ctrl+Shift+F in-terminal search (xterm SearchAddon, search bar with next/prev/close, chord intercepted before the PTY, Esc refocuses terminal; E2E).
**SERN interference**: none (one bridge test assertion updated for the new optional arg)
**Divergence meter**: 213 unit + 21 e2e, 0 fail
**Next target**: final expansion items (correlator path normalization + multi-tab/theme restart E2E), cycle-2 checkpoint (docs+spec boxes), then Okabe budget check.

---

## Worldline 1 Stabilised — Leap 21 — steiner: worldline-1-stable — 2026-07-18T02:40:00Z

**Phase**: worldline-checkpoint → worldline-expansion
**Changed**: Cycle-1 checkpoint. Final meter: 212 unit + 19 Playwright-Electron E2E, 0 fail; 97.96/96.25/98.64 coverage (E2E suite runs against the production build — that is the prod smoke). README rewritten (differentiator-led, honest test numbers, session-resilience guarantee) and USAGE fully rewritten covering every shipped feature. Mayuri (non-programmer) review verdict: DOCUMENTATION GAP — the install on-ramp assumed a developer (no clone step, Node/pnpm unexplained, no VS Build Tools link, no `claude --version` check, never admitted "runs from source"). Fixed immediately: prerequisites section with links + verification steps in README/USAGE, "runs from source" stated plainly, in-terminal usage sentence added. Feature docs she rated genuinely usable (badge table "clearest thing in either document"). lessons_learned appended (api-level E2E masking, destroyed-webContents sends, ConPTY exit pinning, adversarial review value). All 25 spec ACs checked; 1 manual-verify caveat (real OS toast) recorded in Open Questions.
**SERN interference**: none
**Divergence meter**: 97.96% · 212+19, 0 fail
**Next target**: Phase 7 expansion — Okabe proposes cycle-2 items (budget 21/30 used; prefer small high-value: nice_to_have sweep, packaging, shell tabs…).

---

## Leap 20 — steiner: fix(convergence) all 10 must-fix resolved — 2026-07-18T02:00:00Z

**Phase**: worldline-convergence
**Changed**: ALL 10 must-fix items fixed, each with tests. (1) reload-respawns-sessions: new listSessions IPC; restoreWorkspace now RECONCILES — re-attaches live tabs under original tabIds, spawns only dead ones, ADOPTS unclaimed live sessions (never strands work); 8 new unit tests + decisive E2E: real page.reload() → same PID, exactly 1 PTY, scrollback replayed, still interactive. (2) double-attach-leak: detach-before-overwrite in attachSession + attach→attach unit test. (3) pty-ops-after-exit: write/resize guard on exited, try/catch inside throttle timer callback, AttachHandle carries exited/exitCode, TerminalPane renders dead-terminal notice; E2E exit 3 → ✕ badge + typing into dead terminal safe. (4) ipc-arg-validation: createSession shape-check (throws), write/resize sanity checks (drop). (5) forwarder: null/array/primitive stdin guard + REAL integration test spawning forward.cjs as a child process against a live NetTransport pipe (3 scenarios incl. dead-endpoint no-wedge). (6) main-window: getMainWindow() (non-tearoff URL) for focus/re-dock/bounds + revives a main window if a tear-off closes with none. (7) status hardening: non-string message stripped, >500 chars truncated; NotificationService per-tab 10s cooldown (injectable clock). (8) WorkspaceStore: schema-validated saves (reject bad blobs) + config.bak written on corruption fallback. (9) WatchService: error listener (EPERM junctions) → onError dep. (10) clampBoundsToDisplays (pure, 60px min overlap) + z.int() bounds schema; index clamps against screen.getAllDisplays.
**SERN interference**: none
**Divergence meter**: 212 unit + 19 e2e, 0 fail; coverage 97.96/96.25/98.64
**Next target**: Phase 6 worldline-checkpoint — prod-build smoke, README, USAGE full pass, DOSSIER close-out, lessons_learned, Mayuri review; nice_to_have items either quick-hit or carried to expansion.

---

## Leap 19 — steiner: christina-review — 2026-07-18T01:10:00Z

**Phase**: christinas-analysis → worldline-convergence
**Changed**: Future Okabe ×3 parallel review (simplicity / correctness+security / test quality). 10 must-fix + 8 nice-to-have consolidated into review_items. Headline finding (all three converged): the REAL UI reload path respawns sessions and orphans live PTYs — the API-level reload E2E masked it because it bypassed React's restore flow. Also: double-attach listener leak, write/resize-after-exit throws masked by the uncaughtException swallow, unvalidated IPC args, the forwarder relay never actually executed by any test, main-window-index assumption misrouting re-dock/toasts. Reviewers verified clean: no TCP, ~/.claude untouched, minimal preload surface, escaping sound.
**SERN interference**: none
**Divergence meter**: unchanged (185 unit + 17 e2e green — the gaps are in the seams coverage can't see)
**Next target**: Phase 5 convergence — fix all 10 must-fix items, each with a test that fails first; keep the suite green throughout.

---

## Leap 18 — steiner: divergence-meter-stable — 2026-07-18T00:30:00Z

**Phase**: 3b divergence-meter-reading → christinas-analysis
**Changed**: Closed the last two honest AC gaps found in the audit: (1) window-bounds persist/restore (saved into the workspace blob on quit, applied at createWindow; E2E asserts ±8px across restart — Windows DPI rounds), (2) badge default now `unknown` until a hook actually reports (was `working` — a lie before observation; store + E2E updated). Phase 3b evidence: 17/17 Playwright-Electron E2E across every user story, 4 screenshots (empty/terminal/diff/final) in screenshots/, coverage raised to 98.14% stmts / 97.16% branch / 99.28% funcs (185 tests; function-coverage top-ups for bridge/viewer-store/frame-parser/pty-manager/session-store). All 25 spec ACs checked; AC 11 (real OS toast render/click) noted in Open Questions as the one manual-verification item.
**SERN interference**: none (one wrong test expectation about throttle hot-window fixed)
**Divergence meter**: 98.14% / 97.16% / 99.28% · 185 unit + 17 e2e, 0 fail
**Next target**: Phase 4 — Future Okabe ×3 review (simplicity / correctness+security / test quality), consolidate into review_items, then convergence fixes.

---

## Leap 17 — steiner: feat(tear-off) — 2026-07-17T23:55:00Z

**Phase**: time-leap-development
**Changed**: Tear-off windows (spec §4.2), the last major v1 feature. moveTabToWindow(tabId,'new',{title}) → container opens a second BrowserWindow with ?tearoff=<tabId> (shared createWindow factory now injected into wireApp from index); renderer main.tsx routes to TearOffApp (slim title bar + TerminalPane) — the PTY NEVER moves, the new window just attaches (replay + live). Tab strip gets a ⤢ button (removeTab without closeSession). Closing a torn-off window with the session alive → CH.reDockTab {tabId,title,cwd,command} → main strip re-adds the tab. PtyManager sessions now carry `command` (re-dock/persist need it); __weft.pidOf for E2E. CRITICAL BUG FOUND & FIXED via E2E: a destroyed tear-off window left a dangling attachment; next PTY output threw 'Object has been destroyed' inside main's data callback → blocking error dialog wedged the app (2min E2E hangs). Fix: guarded safeSend auto-detaches dead senders (+2 unit tests), process-level uncaughtException logger, and a 2s hard-exit fallback on quit so ConPTY agents can't zombie the process.
**SERN interference**: the wedge above — diagnosed via instrumented step-debug spec; three-layer fix (guard, logger, hard-exit)
**Divergence meter**: unit 179 pass; e2e 16 pass — tear-off asserts SAME PID pre/post, scrollback replay in the new window, interactivity there, and re-dock with both markers
**Next target**: Phase 3b formal sweep (screenshots + AC audit + check spec boxes), coverage report, then Phase 4 Future Okabe ×3 review.

---

## Leap 16 — steiner: feat(error-state+theme) — 2026-07-17T23:10:00Z

**Phase**: time-leap-development
**Changed**: Spawn-failure AC + theme AC + reduced-motion AC. openProject now resolves an `{error,cwd,title,command}` result instead of rejecting (OpenProjectResult union); claudePath injectable (WEFT_CLAUDE_BIN seam). Renderer: spawn-error banner (role=alert) with Retry (fresh createSession in same cwd) + dismiss; module-level failure listener. Theme: store gains theme/setTheme; document dataset applied; CSS vars for light under [data-theme=light] AND (prefers-color-scheme: light + data-theme=system); status-bar cycle button (system→light→dark); theme persisted via buildWorkspaceState(tabs, theme) and restored on launch. Working badge pulses (weft-pulse), static under prefers-reduced-motion.
**SERN interference**: none
**Divergence meter**: unit 177 pass; e2e 15 pass (missing-binary banner + Retry + dismiss; theme cycle with computed --bg assertion)
**Next target**: tear-off windows (moveTabToWindow 'new' → second BrowserWindow re-attaches SAME PTY, PID unchanged; close → re-dock) — the last major v1 feature. Then Phase 3b formal sweep + spec AC checkboxes + Phase 4 review.

---

## Leap 15 — steiner: feat(tabs-ux) — 2026-07-17T22:45:00Z

**Phase**: time-leap-development
**Changed**: Tab UX + keyboard layer. Pure core/keybindings/keybinding-router (Ctrl+T new / Ctrl+W close / Ctrl+Tab cycle ±Shift / Ctrl+1..9 jump; EVERYTHING else passthrough incl. Ctrl+C/R/D and Alt/Meta/Ctrl+Shift combos; 4 test groups). App: window keydown capture dispatches chords; TerminalPane attachCustomKeyEventHandler keeps reserved chords out of the PTY. Store: moveTab (drag-insert reorder) + cycleTab (wrapping). TabButton: double-click inline rename (Enter/blur commit, Esc cancel), HTML5 drag-and-drop reorder. openProject/closeTab hoisted to module fns.
**SERN interference**: none
**Divergence meter**: unit 174 pass; e2e 13 pass (rename, Ctrl+1/2 jump, Ctrl+W close, passthrough proof, drag reorder)
**Next target**: spawn-error state (claude not on PATH → actionable error + Retry, AC) + OS light/dark theme honor + reduced-motion working-spinner; then tear-off window; then Phase 3b sweep + coverage audit.

---

## Leap 14 — steiner: feat(fs-watching) — 2026-07-17T22:15:00Z

**Phase**: time-leap-development
**Changed**: Live file watching (≤1s explorer reflection AC). WatchService (injectable chokidar factory; add/addDir/change/unlink/unlinkDir → add/change/unlink; unwatch/closeAll; 4 unit tests). register-fs: watchDir (forwards CH.fsChange to the calling sender) + unwatchDir. Container: chokidar (ignoreInitial, node_modules/.git ignored, depth 4) + watchers closed on shutdown. Bridge/WeftBridge: watchDir/unwatchDir/onFsChange. Explorer: watches active root; fs events bump a version that re-lists root AND all open nodes; refactored node fetching so the open-effect owns it (no double fetch). E2E extended: externally created file appears ≤5s, externally deleted file disappears.
**SERN interference**: none
**Divergence meter**: unit 166 pass; e2e 9 pass incl. live add/delete reflection
**Next target**: tab rename (double-click inline edit) + drag-reorder + keybindings (Ctrl+T/W/Tab/1..9 with terminal passthrough via core keybinding-router); then spawn-error state + theme; tear-off; Phase 3b sweep.

---

## Leap 13 — steiner: feat(monaco-viewer) — 2026-07-17T21:50:00Z

**Phase**: time-leap-development
**Changed**: Monaco read-only viewer + "Diff vs HEAD". Main: DiffService (readFileText; getDiff = git ls-files → git show HEAD:<rel> baseline vs current; untracked/non-repo → empty baseline = all-additions view; injectable fs+exec, 4 unit tests). register-fs adds readFileText/getDiff handlers; bridge + WeftBridge extended. Renderer: viewer-store (zustand), monaco-setup (lazy chunk, editor worker only — no LSP in v1), ViewerPane (read-only editor / side-by-side diffEditor, View|Diff toggle, close; overlays terminal area). Explorer: single-click → in-app viewer, double-click → OS default (tests updated). tsconfig.web gains vite/client types for ?worker import.
**SERN interference**: none (one tsconfig types fix)
**Divergence meter**: unit 160 pass; e2e 9 pass incl. real-git diff assertion
**Next target**: chokidar fs watcher (explorer reflects external changes ≤1s, AC) + tab rename/reorder UI + keybindings; then spawn-error state, light theme, tear-off; then Phase 3b sweep.

---

## Leap 12 — steiner: feat(workspace-persistence) — 2026-07-17T21:20:00Z

**Phase**: time-leap-development
**Changed**: Workspace persistence + restore-on-launch. register-workspace IPC (loadWorkspace/saveWorkspace over WorkspaceStore); container wires electron-store + config.bak backup writer. Renderer workspace-sync: buildWorkspaceState (tabs→versioned blob) + restoreWorkspace (respawn fresh session per saved tab, skip failures, preserve order/titles); App restores once on launch (StrictMode-guarded) and saves on every tabs change via zustand subscribe. Tab now carries `command`; openProject response includes it. index.ts honors WEFT_USER_DATA_DIR for isolation. FIXED E2E cross-contamination: every spec now launches with its own mkdtemp userData (status spec was restoring tabs saved by open-project spec) + cleaned the polluted shared dev config.json (removed stray workspace key).
**SERN interference**: E2E cross-test pollution via shared userData once persistence landed — isolated per-launch userData; lesson recorded
**Divergence meter**: unit 155 pass; e2e 8 pass incl. restart-restore
**Next target**: Monaco read-only file viewer + diff (readFileText/getDiff IPC + git-HEAD diff provider + renderer viewer pane), then keybindings, tear-off, Phase 3b full sweep.

---

## Leap 11 — steiner: feat(os-notifications) — 2026-07-17T20:55:00Z

**Phase**: time-leap-development
**Changed**: App-owned OS notifications. NotificationService (pure policy, injected OS I/O): waiting/done while app unfocused → toast ("<project> — needs you"/"— done", hook message as body); click → focusTab; silent when focused; working/error/unknown ignored. Container wires Electron Notification + isFocused check + focusTab (restore/show/focus window + CH.activateTab). New activateTab channel + bridge onActivateTab + App subscription → setActive. register.closeSession now calls onSessionClosed → statusServer.forget(tabId). 7 new unit tests.
**SERN interference**: none
**Divergence meter**: unit 150 pass; e2e 7 pass
**Next target**: workspace persistence IPC (loadWorkspace/saveWorkspace via WorkspaceStore+electron-store) + restore-on-launch (recreate saved tabs' sessions) + E2E restart test; then Monaco read-only+diff; tear-off.

---

## Leap 10 — steiner: feat(status-pipeline) — 2026-07-17T20:40:00Z

**Phase**: time-leap-development
**Changed**: THE DIFFERENTIATOR — hook-driven per-tab status, end-to-end. Core: FrameParser (NDJSON across chunk boundaries + end() flush), statusEndpointPath (named pipe win32 / UDS posix, never TCP), buildHookSettings(Json) (inline --settings registering UserPromptSubmit/Stop/StopFailure/Notification → forwarder command). Main: StatusServer (transport-injectable; bytes→parse→correlate→map→onStatus; dedup; drop+log unknown/malformed; statusOf/forget), hook-forwarder (generates forward.cjs relay + forward.cmd/.sh wrapper; ELECTRON_RUN_AS_NODE scoped INSIDE wrapper; 5s hard timeout so hooks never wedge), NetTransport (node:net on pipe path). PtyManager.tabRefs() (+cwd). register: claude spawns get --settings + WEFT_STATUS_ENDPOINT env. Container wires it all + broadcasts CH.sessionStatus to all windows + __weft E2E introspection global + SHUTDOWN handler (before-quit kills PTYs + stops server — fixed app.close() hang where ConPTY children pinned the process). Renderer App subscribes onSessionStatus/onSessionExit → badges.
**SERN interference**: app.close() hung 60s in E2E (ConPTY children + live pipe held process open) — fixed with before-quit shutdown; 2 unit fixes (NodeJS namespace not in pure core; JSON quote-escaping in assertion)
**Divergence meter**: unit 143 pass; e2e 7 pass incl. real-pipe badge flip waiting→working→done + unknown-session no-op
**Next target**: OS notifications (waiting/done while unfocused → toast → focus window+tab), then workspace persistence IPC + restore-on-launch, Monaco read-only+diff, tear-off.

---

## Leap 9 — steiner: feat(explorer-tree) — 2026-07-17T20:05:00Z

**Phase**: time-leap-development
**Changed**: Renderer Explorer tree (lazy listDir expansion, file→openWithDefault, error/empty states, aria tree roles) wired to active tab cwd. E2E seams: WEFT_E2E_OPEN_DIR (folder-picker bypass) + WEFT_OPEN_PROJECT_COMMAND=shell (no real claude boot in tests) — the ENTIRE open-project UI flow is now automatable. e2e/open-project.spec.ts: click + → tab appears → xterm mounts → typed echo round-trips on screen → explorer lists fixture files + lazy-expands subdir; close tab → empty state. 6 Explorer jsdom tests + register defaultCommand test.
**SERN interference**: none (a log-write shell heredoc hit the Windows python alias and timed out — no repo damage; lesson: use Edit tool for log edits)
**Divergence meter**: unit 117 pass; e2e 5 pass (real Electron)
**Next target**: status pipeline (differentiator): NDJSON frame-parser (core) + named-pipe/UDS StatusServer + inline --settings hook injection at spawn + forward-script via ELECTRON_RUN_AS_NODE + renderer badge wiring + E2E (inject hook payload over the pipe → badge flips to waiting).

---

## Leap 8 — steiner: test(e2e) Playwright-Electron harness — 2026-07-17T19:45:00Z

**Phase**: time-leap-development (Phase 3b harness established early)
**Changed**: Installed @playwright/test 1.61 (no browser download — Electron uses app's own binary). Added playwright.config.ts + e2e/app.spec.ts driving the REAL built Electron app via _electron.launch(). 3 tests, all green: (1) workbench shell renders + window.api exposed under context isolation; (2) a shell session spawns and echoes input through the real preload→IPC→node-pty/ConPTY pipeline; (3) §4.7 — a session SURVIVES a hard renderer reload and re-attach replays its buffered output. test:e2e now builds first (electron-vite build && playwright test). gitignored test-results/playwright-report/.playwright-mcp.
**SERN interference**: none
**Divergence meter**: unit 110 pass; e2e 3 pass (real Electron)
**Next target**: continue Phase 3 features — renderer explorer tree, status server + inline hooks (tab badges), OS notifications, Monaco diff, persistence IPC + restore, tear-off. E2E harness now lets me self-verify each in the real app.

---

## Leap 7 — steiner: chore(native-build) node-pty runs under Electron — 2026-07-17T19:30:00Z

**Phase**: time-leap-development
**Changed**: Resolved the node-pty Electron-ABI build (user installed VS Build Tools). Two Windows blockers fixed: (1) NoDefaultCurrentDirectoryInExePath=1 broke winpty's GetCommitHash.bat — now cleared inside a new scripts/rebuild-native.mjs; (2) SpectreMitigation flag required Spectre VS libs — removed via committed `pnpm patch` (patches/node-pty@1.1.0.patch, changes 'Spectre'→'false' in binding.gyp + winpty.gyp). `electron-rebuild` now completes. Verified with a headless Electron smoke test: node-pty spawned a real ConPTY session and echoed output. blocked_on cleared.
**SERN interference**: none (both build blockers diagnosed + fixed)
**Divergence meter**: 110 pass, 0 fail (unchanged — native build is toolchain, not app logic)
**Next target**: launch pnpm dev + user opens a project to try a live claude session; then renderer explorer tree, status server + inline hooks, notifications, Monaco diff, persistence IPC, tear-off; then Phase 3b (Playwright-Electron).

---

## Leap 6 — steiner: feat(file-explorer-backend) — 2026-07-17T17:27:00Z

**Phase**: time-leap-development
**Changed**: File explorer backend (unblocked by native build). Pure `core/fs/dir-sort` (dirs-first case-insensitive sort + default ignores node_modules/.git). `main/services/FsService.listDir` over injectable FsLike → mapped/sorted DirEntry[] with kinds (dir/file/symlink), ignore-filtering. `main/ipc/register-fs` (listDir/revealInOs/openWithDefault, injected reveal/open). Wired into container (fsPromises + electron shell). Added listDir/revealInOs/openWithDefault to preload bridge + WeftBridge. Fixed tests to use path.join (Windows backslash separators, not hardcoded '/').
**SERN interference**: none (caught Windows path-separator assumption in tests immediately)
**Divergence meter**: 99.83% stmts / 96% branch / 95.18% funcs, 110 pass, 0 fail
**Next target**: renderer Explorer tree (lazy-expand via listDir); then status server + inline hooks, OS notifications, Monaco diff, persistence IPC + restore, tear-off. LIVE verify + Phase 3b still gated on node-pty Electron rebuild (VS Build Tools installing).

---

## Leap 5 — steiner: feat(interactive-terminal) — 2026-07-17T17:18:00Z

**Phase**: time-leap-development
**Changed**: Wired the terminal end-to-end so the app is usable. main/ipc/register.ts (electron-free, injectable ipcMain/pty/pickDirectory): createSession (uuid + claude --session-id + CLAUDE_IDE_TAB env), write/resize (guarded), close, attach (replay snapshot + forward data/exit to the sender), detach, openProject (dir picker → session). main/container.ts composition root (real ipcMain/dialog/NodePtyFactory). preload/create-bridge.ts (testable over injected ipcRenderer) + preload/index.ts glue → window.api. Renderer: session-store (zustand), TerminalPane (xterm + fit, attach-on-mount replay, HMR-safe cleanup that detaches without killing), WorkbenchErrorBoundary (fallback + reload), App wired with tab strip + status glyphs + Open-project. Added openProject channel + WeftApi.openProject + WeftBridge Pick type.
**SERN interference**: none (fixed inline: vitest 'dom' project needed @vitejs/plugin-react for JSX automatic runtime — 'React is not defined' until added)
**Divergence meter**: 99.81% stmts / 95.61% branch / 98.66% funcs, 98 pass, 0 fail; production build OK
**Next target**: node-pty Electron-ABI rebuild (@electron/rebuild) + launch to verify open-project→live-claude-session works (de-risk Phase 3b blocker); then file explorer, status server + inline hooks, OS notifications.

---

## Leap 4 — steiner: feat(pty-manager) — 2026-07-17T17:00:00Z

**Phase**: time-leap-development
**Changed**: Built the session-resilience foundation the user asked for (spec §4.7). Pure core: `terminal/resize-throttle` (leading+trailing Throttle, injected clock/timers — no globals, stays pure), `terminal/output-ring-buffer` (char-bounded raw-output buffer for verbatim replay), `status/session-correlator` (session_id→tabId→cwd routing). `main/services/PtyManager` over an injectable `PtyFactory`: create/write/resize(throttled)/close, per-session ring buffer, `attach`/`detach` (replay snapshot + live subscription; NEVER respawns on reload; detach doesn't kill; only close/exit kills), exit tracking, listener fan-out. `NodePtyFactory` real adapter (lazy `createRequire('node-pty')`, ConPTY). Installed node-pty 1.1.0 (prebuilt binary loads; postinstall copied conpty.dll + OpenConsole.exe). Added attachSession/detachSession to IPC channels + WeftApi contract.
**SERN interference**: none (fixed inline: kept core pure by moving real-timer deps out of core into main `realThrottleDeps`; pnpm approve-builds is interactive-only so added node-pty to onlyBuiltDependencies instead)
**Divergence meter**: 100% stmts / 99.35% branch / 97.87% funcs (built modules), 74 pass, 0 fail
**Next target**: IPC layer (register handlers + preload bridge for session create/write/resize/close/attach/detach + data/exit/status events), then renderer TerminalPane (xterm mount, attach-on-mount replay, HMR-safe cleanup) + workbench error boundary — completing the §4.7 guarantee end-to-end.

---

## Leap 3 — steiner: feat(persistence) — 2026-07-17T16:32:00Z

**Phase**: time-leap-development
**Changed**: Implemented the workspace persistence vertical slice (Beta core + adapter). Pure `core/persistence`: `schema` (zod shapes + WORKSPACE_VERSION + compile-time schema↔API conformance assert), `migrations/` (ordered chain + `v0ToV1` legacy upgrade), `validate.loadWorkspace(raw) -> Result<LoadedWorkspace>` (nullish→default, non-object→err, migrate+validate, migration-throw handling). `main/services/WorkspaceStore` adapter over an injectable `KeyValueStore` + backup fn (writes config.bak before a migrating overwrite; corrupt blob → default + warn). Added `Result` helper test. Fixed TS project-ref path aliases in tsconfig.shared + excluded test files from `tsc -b`.
**SERN interference**: none (fixed two build issues inline: missing @shared/@core paths in shared project; over-strict bidirectional schema type-assert vs version literal)
**Divergence meter**: 100% stmts / 98.83% branch / 100% funcs (built modules), 40 pass, 0 fail
**Next target**: PtyManager with injectable PtyFactory + node-pty native install; then session correlation (--session-id + inline --settings hooks + CLAUDE_IDE_TAB).

---

## Leap 2 — steiner: worldline-beta-selected — 2026-07-17T16:24:00Z

**Phase**: worldline-selection → time-leap-development
**Changed**: Kurisu ×2 proposed Alpha (minimal) vs Beta (clean seams + platform ports + DI). Chose **Beta** (multi-concern app, 95% coverage bar, cross-platform seam, v2 roadmap). Scaffolded electron-vite skeleton: `shared/` contract (result, ipc/channels, ipc/api-contract, status/hook-events), first pure `core/status/status-mapper` + 12 passing tests, minimal main/preload/renderer Electron shell, tsconfig project refs, vitest (projects api, 95%/90% coverage thresholds). `pnpm install` clean, Electron 34 binary downloaded, `pnpm build` compiles all 3 targets, `pnpm test` → 12 pass. Fixed preload path (.mjs under type:module).
**SERN interference**: none (node-pty native install deferred to keep first build green; PtyFactory DI means unit tests never import it)
**Divergence meter**: 12 pass, 0 fail (coverage n/a yet)
**Next target**: Implement core/persistence (migrations + validate) and main/services/workspace-store; then PtyManager with injectable PtyFactory.

---

## Leap 1 — steiner: divergence-analysis — 2026-07-17T16:07:00Z

**Phase**: divergence-analysis
**Changed**: Faris ran market research (confirmed the wedge: hook-driven per-session status + tab-focusing notifications + Windows-first + tear-off shell; competitors scrape output or are Mac-only/worktree-framed). Okabe authored `documents/steiner-spec.md` with 21 machine-checkable acceptance criteria. Spec Quality Gate passed. DOSSIER populated.
**SERN interference**: none
**Divergence meter**: unknown (no code yet)
**Next target**: Worldline Selection — Kurisu ×2 propose Alpha (minimal) vs Beta (clean) architectures; scaffold electron-vite skeleton.

---
