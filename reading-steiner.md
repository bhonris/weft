phase: time-leap-development
leap_count: 53
expansion_cycle: 7
session_id: 2026-07-19T21:55:00Z
prev_head: 2a47692237606dc3738ae8d009cc5fa50fe18768
original_prompt: "Build Weft — a cross-platform (Windows-first) Electron desktop app with a VS Code-style interface built around browser-style tabs of Claude Code CLI sessions (one tab per project), an integrated file explorer, per-tab Claude session status awareness driven by Claude Code hooks, Monaco read-only+diff viewer, tear-off tabs into separate windows, workspace persistence, and app-owned OS notifications. React+TS+Vite renderer, node-pty terminals via xterm.js, electron-store persistence. Full design at documents/claude-terminal-ide.md. CYCLE 6 END GOAL (operator): fully mouseless, keyboard-only navigation across all of Weft; macOS/Linux platform work OUT OF SCOPE this cycle."
project_name: "weft"
project_type: web
spec_path: documents/steiner-spec.md
test_cmd: pnpm test
dev_server_port: 5173
coverage_pct: 98.44
divergence_readings: []
current_focus: "Expansion 7 deferred fixes (criteria 6-8), then review/convergence. DONE: leaps 49 dispatch unified; 50 data-driven routeKey; 51 protected+conflict (crit 3,4); 52 persistence (crit 2 plumbing); 53 keybindings editor UI (crit 2 & 5 CHECKED). NEXT (leap 54+): crit 6 — make the 'Search in Terminal' palette command actually open the in-terminal search bar (add a TerminalPane open-search signal in a store, like the viewer's saveTick, and have runCommand('general.terminalSearch') trigger it instead of only focusing the terminal); crit 7 — 'Rename Tab' palette command triggers inline rename of the active tab (an active-tab rename signal, F2 already works locally); crit 8 — fold Explorer expandPath/collapsePath into one pure toggle helper. Then the E2E remap journey (rebind via editor, invoke new chord, protected chord still reaches PTY, persists across restart) + Phase 4 review (Future Okabe x3) + convergence + checkpoint. AFTER Cycle 7: Cycle 8 = split-pane workspace (documents/split-pane-workspace.md). SUPERSEDED-detail: DONE: leap 49 dispatch unified; 50 routeKey data-driven over DEFAULT_KEYMAP via chordOf; 51 rebind/reset API + protected guard + conflict (crit 3,4); 52 persistence — WorkspaceState v3→v4 keymapOverrides (chord→command id), actionForCommand + buildKeymap merge, App feeds effective keymap to routeKey via a ref, general.resetKeybindings, all persisted. NEXT (leap 53): an accessible, keyboard-operable editor overlay (mirror CommandPalette/KeyboardHelp overlays in src/renderer). It should: list each bindable command (registry) with its current chord (derive from the effective keymap / DEFAULT_KEYMAP + overrides); let the user capture a new chord (listen for a keydown, canonicalize via chordOf); apply with bindChord (leap 51 — surfaces protected refusal + conflict/displaced); reset one or all via resetChord/resetAll; write results through setKeymapOverrides (store→persist). Open via a command (e.g. general.keybindings) + palette entry; trap focus; suspend passthrough while open (overlayOpenRef already gates onKey). Note: bindable set = commands where actionForCommand(id) !== null. THEN deferred fixes crit 6 (terminal-search palette opens the pane search via a signal store), 7 (rename palette via active-tab signal), 8 (explorer expand/collapse dedup)."
blocked_on: null
last_test_run: "375 pass, 1 env-only fail (hook-forwarder integration leaks CLAUDE_IDE_TAB inside a live Weft session; passes with it unset); coverage 98.61/96.52/97.35; typecheck clean"
closed_worldlines: []
next_action: "Expansion 7 deferred fix — criterion 6: make runCommand('general.terminalSearch') actually OPEN the in-terminal search bar. Add a small signal store (like viewer-store's save request) that TerminalPane subscribes to; have the command bump it instead of only focusing the terminal. Then crit 7 (Rename Tab palette → inline rename of active tab via an active-tab rename signal) and crit 8 (fold Explorer expandPath/collapsePath into one toggle helper). Then the E2E remap journey + Phase 4 review. spec ## Expansion 7."
sern_interference_count: 0
mayuri_rework_count: 0
decisions:
  - architecture: "BETA worldline — shared/ (pure IPC contract) + core/ (pure logic: status-mapper, reducers, migrations, correlator, throttle, keybinding-router, and new cycle-6 pure modules: commands/registry, commands/fuzzy, explorer/tree-nav) + main/ (thin Electron adapters + platform/ seams) + preload/ (typed bridge) + renderer/ (React+zustand; new CommandPalette/KeyboardHelp overlays + region-focus hook). PTY lives in main; renderer is a view over main's truth."
  - testing: "vitest + @vitest/coverage-v8 (95%/90% thresholds), node + jsdom projects; pure logic via injected fakes; Playwright-for-Electron E2E incl. a keyboard-only (no .click()) mouseless journey."
  - stack: "TypeScript, Electron 34 + electron-vite 3, pnpm, React 19 + Vite 6, zustand 5, xterm.js 5.5, chokidar 4, electron-store 10, monaco 0.52, zod 3, node-pty; @fontsource chakra-petch + jetbrains-mono (cyberpunk theme). No new runtime deps planned for cycle 6 (fuzzy match hand-rolled + pure)."
review_items:
  must_fix: []
  nice_to_have: []
  closed:
    - "viewer-save-noop: FIXED — added case 'viewer.save' → requestSave() in runCommand (Leap 46) + palette + app-level Ctrl+S tests"
    - "duplicate-keyboardhelp-case: FIXED — removed the dead duplicate case (Leap 46)"
    - "test-gaps-cycle6: FIXED — added viewer.save, app-level Ctrl+S(+neg), overlay-stands-down, passthrough neighbors, real fuzzy stability, Explorer Home/End+left-to-parent, live region-cycle skip-absent (Leap 46; 324 unit)"
    - "focusEl-unused-return: FIXED — now void (Leap 46)"
    - "dead-explorer-category: FIXED — removed from CATEGORY_ORDER (Leap 46)"
    - "dual-dispatch-drift: FIXED — Leap 49 (Cycle 7). Chords resolve to a CommandId via pure core/commands/action-dispatch.ts and dispatch through the single runCommand; onKey's parallel KeyAction switch removed; bidirectional no-drift regression test added."
    - "terminal-search-palette-noop: DEFERRED near-budget — 'Search in Terminal' focuses terminal but can't open the search bar (needs a TerminalPane open-search signal like viewer saveTick)"
    - "tab-rename-palette-noop: DEFERRED near-budget — 'Rename Tab' palette entry needs an active-tab rename signal; F2 on the focused tab works"
    - "expand-collapse-dup: DEFERRED near-budget — fold Explorer expandPath/collapsePath into one toggle helper"
    - "frame-parser-buffer-cap: fixed (1MB cap + recovery test)"
    - "uds-perms-unlink: fixed (chmod 0600 + unlink on close)"
    - "readfile-size-guard: fixed (5MB stat guard + viewer error)"
    - "git-quotepath: fixed (-c core.quotepath=false)"
    - "dead-code-sweep: fixed (channels/api/needsMigration/isOk/_prev removed)"
    - "reveal-affordance: fixed (ViewerPane Reveal button)"
    - "spawn-failure-store-refactor: fixed (zustand store state)"
    - "e2e-hardening: fixed (launchWeft strips WEFT_*, config.json poll, restart E2E)"
    - "reload-respawns-sessions: fixed — listSessions IPC + reconcile/adopt; same-PID E2E"
    - "double-attach-leak: fixed — detach-before-overwrite + unit test"
    - "pty-ops-after-exit-throw: fixed — exit guards + throttle try/catch"
    - "ipc-arg-validation: fixed — createSession shape check, write/resize sanity"
    - "forwarder-untested+null-crash: fixed — stdin guard + real-process/pipe integration test"
    - "main-window-assumption: fixed — getMainWindow() + revival on orphaned re-dock"
    - "status-payload-hardening: fixed — message string/truncate + 10s toast cooldown"
    - "save-validation-backup: fixed — schema-validated saves + config.bak fallback"
    - "watcher-error-unhandled: fixed — error listener with onError dep"
    - "bounds-clamp: fixed — pure clampBoundsToDisplays + z.int() schema"
max_iterations: 62
push_to_github: false
bypass_playwright: false
sern_no_progress_streak: 0
lessons_learned: ["cycle 6: mouseless keyboard nav — a SINGLE pure keybinding-router as the one source for both the App window listener and xterm's attachCustomKeyEventHandler kept the PTY-passthrough invariant consistent (and regression-tested). The one real bug (viewer.save palette no-op) came from TWO parallel dispatch switches (KeyAction vs CommandId) drifting — a copy-pasted duplicate case displaced a handler; adversarial 3-reviewer pass caught it, 98% unit coverage did not. Region-local keys (F2 rename, explorer arrows, viewer Ctrl+S) are best handled by their components, NOT the global router, so they only act in-context and otherwise reach the PTY. E2E that presses a chord must wait for the shell to mount (domcontentloaded precedes React's listener attach) — a startup race that passed by luck once. Mayuri (non-programmer) review surfaced doc gaps devs assume (define 'focus', how to open a folder by keyboard).", "cycle 1: node-pty Electron rebuild blocked twice on Windows — (a) NoDefaultCurrentDirectoryInExePath=1 breaks winpty GetCommitHash.bat (now unset inside scripts/rebuild-native.mjs), (b) SpectreMitigation flag required Spectre VS libs (removed via committed pnpm patch node-pty@1.1.0). Rebuild reproducible via pnpm rebuild:native.", "cycle 1: api-level E2E can mask product-path bugs — always E2E the actual UI path for core guarantees. Guard every main->renderer send (destroyed webContents throw). ConPTY children pin process exit — hard-exit fallback after graceful shutdown. Pure-core + injected fakes kept 200+ tests fast; adversarial 3-reviewer pass found a critical bug 98% coverage missed.", "cycle 4: WebGL renderer removes terminal text from the DOM, killing a11y + all text-based E2E; DOM renderer only. Packaged-exe E2E catches asar/native packaging mistakes nothing else sees.", "cycle 6 (planning): keyboard chords MUST route through the single pure keybinding-router so the App listener and xterm attachCustomKeyEventHandler never disagree; the out-of-band Ctrl+Shift+F terminal-search special-case is the anti-pattern to fold back in. Any new chord must be regression-tested against the protected PTY-passthrough set."]

# ── Expansion Cycle 6 (Leap 34+) — Mouseless / keyboard-only navigation ──
# Operator END GOAL: keyboard-only operation of all of Weft. OUT OF SCOPE: macOS/Linux, split panes/LSP.
# Plan (each ~1 leap): (35) router chords + passthrough guard; (36) pure command registry + fuzzy;
# (37) command palette overlay + wire actions; (38) keyboard help overlay; (39) region-focus system +
# :focus-visible styling all themes; (40) pure tree-nav + explorer roving tabindex; (41) tab reorder/
# rename(F2)/type by keyboard; (42) viewer mode switches + app-level Ctrl+S; (43) status controls via
# commands; (44) mouseless E2E journey + focus-ring/passthrough E2E; then Phase 4 review, convergence,
# checkpoint. Spec: documents/steiner-spec.md ## Expansion 6. Design: documents/keyboard-navigation.md.

# ── Cycle 8 candidate (operator-aligned 2026-07-19; NOT started — Cycle 7 finishes first) ──
# In-project workspace: multiple FILE/editor tabs per project + the Claude CLI as an
# always-present, MOVEABLE dock pane (default BOTTOM, resizable, re-dockable to right/left,
# position persisted). CLI is FULL-WIDTH when no file is open; opening a file reveals the split;
# closing the last file tab returns to full-width CLI. A shortcut/affordance always focuses the CLI.
# One CLI per project (tabs are files, not extra terminals). Full brief: documents/split-pane-workspace.md
# When Cycle 7 completes, Phase 7 should open Cycle 8 from that brief (formalize as ## Expansion 8).
