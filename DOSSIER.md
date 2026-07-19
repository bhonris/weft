# weft — Future Gadget Dossier

## What this is
Weft is a cross-platform (Windows-first) open-source Electron desktop app: a VS Code-style shell wrapped around browser-style tabs of Claude Code CLI sessions — one tab per project, each running a live interactive `claude` session in its own pseudo-terminal (node-pty + xterm.js). It adds an integrated file explorer, a Monaco read-only + diff viewer, tear-off tabs into separate OS windows, workspace persistence, and — the defining differentiator — per-tab Claude session status (working / waiting / done / error) driven by Claude Code's own lifecycle hooks (not output scraping), plus app-owned OS notifications that focus the right tab when a session needs attention. Market research confirms the wedge: no existing tool combines hook-driven per-session status + tab-focusing notifications + Windows-first + a tear-off VS Code shell.

## Current status
Phase: **EL PSY KONGROO — Cycle 8 sealed** (Leap 65, expansion cycle 8). Divergence meter: 98.61% statements (~430 unit + 32 Playwright-Electron E2E, all green). **Cycle 8 — in-project split-pane workspace** shipped and machine-verified: multiple **file tabs** + an **always-present, moveable/resizable CLI dock** (bottom/right/left, resizable, persisted); full-width CLI when no file is open. All 8 Expansion-8 criteria met; reviewed (Future Okabe ×3) + converged (leap 65 fixed unclamped dock size on load + active-tab re-select losing unsaved edits). Prior: Cycle 7 (remappable keybindings) sealed. Re-invoke `/dmail` for Cycle 9 (candidates: persist open files, per-tab editor buffers, split editors, macOS/Linux, LSP). Operator opened Cycle 7 — **remappable keybindings + dispatch unification** (spec `## Expansion 7`). Shipped so far: (49) dual dispatch unified + no-drift test; (50) `routeKey` data-driven over `DEFAULT_KEYMAP` via `chordOf`; (51) protected-chord guard + rebind/reset API — criteria 3 & 4; (52) **persistence** — `WorkspaceState.keymapOverrides` schema v3→v4, `buildKeymap` merge fed to `routeKey`, `general.resetKeybindings`; (53) **keybindings editor UI** — accessible `KeybindingsEditor` overlay (Enter-to-capture a new chord, protected/conflict guards, per-row + all reset), remapping is live and persisted — **criteria 2 & 5 checked**. Next: the deferred palette/explorer fixes (crit 6 terminal-search, 7 rename, 8 explorer dedup), then the E2E remap journey + review/convergence. Queued after Cycle 7: **Cycle 8 = in-project file tabs + always-present moveable CLI dock** (brief: `documents/split-pane-workspace.md`). Two manual pre-cycle enhancements also landed: the `PostToolUse` waiting→working fix and a notifications on/off toggle (workspace schema v3).

Prior: **EL PSY KONGROO — Cycle 6 sealed** (Leap 48/50). Mouseless / keyboard-only navigation shipped and machine-verified. Weft is now fully operable by keyboard alone: command palette (`Ctrl+Shift+P`), keyboard-help overlay (`Ctrl+?`), region focus (`Ctrl+``/`Ctrl+Shift+E`/`Ctrl+F6`), full WAI-ARIA explorer tree nav, keyboard tab reorder/rename(F2)/type, viewer View/Edit/Diff/Reveal/Close + app-level `Ctrl+S`, status controls via commands, and theme-aware visible focus rings — all while the terminal-key passthrough invariant holds (regression-tested). Backed by a single pure `keybinding-router` + pure `commands`/`focus`/`explorer` core modules. **Out of scope this cycle (as directed):** macOS/Linux platform work; split panes/LSP. Spec: `documents/steiner-spec.md` → Expansion 6; design: `documents/keyboard-navigation.md`.
Divergence meter: **324 unit + 27 Playwright-Electron E2E (incl. a no-mouse keyboard-only journey), all pass** · 98.5% statements. Cycle-6 review (Future Okabe ×3) found one real bug — the `viewer.save` palette command had no handler (a duplicate case displaced it) — fixed in convergence with regression tests.
Two manual (outside-loop) enhancements shipped since v0.2.0: whole-tab status coloring (`documents/completed/tab-state-colors.md`) and a selectable **cyberpunk** theme, now the default (`documents/completed/cyberpunk-theme.md`).
Prior status: v0.2.0 END GOAL REACHED (Leap 33/40, Cycle 5).

## Acceptance criteria — Cycle 6 (Mouseless / keyboard-only navigation)
- [x] All app chords route through the single pure `keybinding-router`; protected PTY-passthrough set regression-tested (Ctrl+C/R/D/Z/L/A/E, arrows, function keys, Alt/Meta, plain keys).
- [x] `Ctrl+Shift+F` terminal-search folded through the router (no out-of-band special case).
- [x] Command palette (`Ctrl+Shift+P`): fuzzy filter, ↑/↓/Enter/Esc, accessible listbox, focus restore.
- [x] Pure command registry as the single source (id-uniqueness + no-drift shortcut test).
- [x] Keyboard help overlay (`Ctrl+?`), grouped, Esc closes.
- [x] Region focus: cycle (`Ctrl+F6`/`Ctrl+Shift+F6`) + direct (`Ctrl+``, `Ctrl+Shift+E`); skips absent regions.
- [x] Theme-aware `:focus-visible` rings everywhere (incl. cyberpunk), motion-safe.
- [x] Explorer WAI-ARIA tree keyboard nav (pure `tree-nav` + roving tabindex; aria-level/selected/expanded).
- [x] Keyboard tab management: reorder (`Ctrl+Shift+PageUp/PageDown`), rename (`F2`), shell-vs-claude via palette.
- [x] Viewer View/Edit/Diff/Reveal/Close by keyboard + app-level `Ctrl+S`.
- [x] Status-bar theme/resume via commands.
- [x] Overlays trap focus + suspend passthrough; restore on close; ARIA-correct.
- [x] Full mouseless Playwright-Electron E2E (no `.click()`); coverage ≥ 95%.
Divergence meter: **229 unit + 24 Electron E2E, all pass** · ~98% statements
Cycle 3 shipped OSS hygiene (LICENSE/CONTRIBUTING/CI) + electron-builder packaging — the packaged Weft.exe is E2E-verified. Cycle 4: scrollback cap, WebGL trial rejected on a11y/testability evidence, v0.1.0 stamped with CHANGELOG.
Cycle 2 (Expansion 2) shipped all 11 ACs: full hardening sweep (buffer caps, UDS perms, 5MB viewer guard, quotepath, dead-code removal, Reveal button, store-based spawn-failure, E2E hygiene with WEFT_*-stripped launches + deterministic persistence polling, correlator path normalization) + two features (Shift+Click shell tabs, Ctrl+Shift+F in-terminal search) + multi-tab/rename/theme restart E2E. Every review item from cycle 1 is now closed — none carried.
ALL v1 features built and machine-verified in the real app: tabs (create/close/rename/drag-reorder), reload-safe terminal pipeline, hook-driven status badges over named pipe, OS notifications (policy unit-tested; one manual toast check pending — see spec Open Questions), explorer + live chokidar watching, Monaco viewer + git-HEAD diff, workspace persistence incl. window bounds, tear-off/re-dock with same-PID guarantee, keybindings with PTY passthrough, light/dark/system themes, spawn-error recovery. Screenshots in screenshots/. All 25 spec acceptance criteria checked.

## Stack
TypeScript · pnpm · Electron + electron-vite · React + Vite (renderer) · xterm.js (+fit/webgl/search/serialize) · node-pty · chokidar · electron-store · zustand · monaco-editor · dockview · vitest + @vitest/coverage-v8 · @playwright/test (Electron)

## Acceptance criteria — Cycle 1
- [x] Creating a tab spawns `claude --session-id <uuid>` in the selected cwd; `createSession` resolves with `{ tabId }`
- [x] PTY env has `CLAUDE_IDE_TAB`; launch registers hooks via inline `--settings` without touching `~/.claude/settings.json`
- [x] Tabs can be created, renamed, and reordered; strip order matches `tabOrder`
- [x] Closing a tab kills the PTY and removes it from the registry
- [x] Typed input round-trips to the PTY; `Ctrl+C` reaches the PTY (not an app shortcut)
- [x] `resizeSession` calls `pty.resize`; rapid resizes throttled to ≤1 per 50ms
- [x] Tear-off keeps the same `sessionId`/PID with no respawn; xterm re-attaches
- [x] `permission_prompt`/`agent_needs_input`/`idle_prompt`/`elicitation_dialog` → `waiting` within 1s
- [x] `UserPromptSubmit` → `working`; `Stop`/`agent_completed` → `done`; `StopFailure`/nonzero exit → `error`
- [x] Hook routing by `session_id`, falling back to `tabId` then `cwd`; unknown dropped+logged
- [x] OS notification when unfocused; click focuses correct window + activates correct tab
- [x] Status server binds named pipe / UDS, never a TCP socket
- [x] File explorer lists a dir; external add/change/unlink → `onFsChange` within ~1s
- [x] `getDiff` returns `{original, modified}`; Monaco diff renders; `readFileText` opens read-only
- [x] Reopen restores tabs, cwds, order, explorer roots, theme, window bounds
- [x] Older-version blob runs migration chain with `config.bak` backup
- [x] Badges use distinct shape+color+aria; reduced-motion renders static
- [x] Honors OS light/dark when `theme:'system'`; override persists
- [x] `claude` not on PATH → actionable error + Retry, no crash
- [x] Status endpoint down → `unknown` status; terminal still works
- [x] Statement coverage ≥95%; Playwright-Electron E2E passes

## Review — Cycle 1 — ALL MUST-FIX RESOLVED ✓
Future Okabe ×3 (simplicity / correctness+security / test quality): **10 must-fix (all fixed in Leap 20), 8 nice-to-have (carried).**
- reload-respawns-sessions — UI reload respawns saved tabs, orphaning live PTYs (§4.7 violation; the API-level E2E masked it)
- double-attach-leak — attachSession overwrites handle without detach → duplicated output
- pty-ops-after-exit-throw — write/resize on exited session throws inside throttle timer
- ipc-arg-validation — renderer-supplied args reach node-pty unvalidated
- forwarder-untested+null-crash — forward.cjs relay never executed by tests; crashes on non-object stdin
- main-window-assumption — getAllWindows()[0] misroutes re-dock/toast when tear-offs outlive main
- status-payload-hardening — non-string/huge message from pipe can throw/spam
- save-validation-backup — corrupt save → silent workspace loss without backup
- watcher-error-unhandled — chokidar error → uncaught exception (Windows junctions)
- bounds-clamp — off-screen window restore; NaN passes schema
Reviewers verified clean: no TCP anywhere, personal ~/.claude/settings.json untouched, preload surface minimal, React/xterm/Monaco escape output, frame parser + ring buffer + correlator logic sound.

## Lab Members engaged
Faris (market research), Okabe (spec author), Kurisu × 2 (Beta worldline selected), Daru (implementation leaps 3–18), Moeka (context carried in-line), Future Okabe × 3 (cycle-1 review)
