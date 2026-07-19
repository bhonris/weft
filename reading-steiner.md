phase: time-leap-development
leap_count: 59
expansion_cycle: 8
session_id: 2026-07-19T22:33:00Z
prev_head: c8aa9f9
original_prompt: "Build Weft — a cross-platform (Windows-first) Electron desktop app with a VS Code-style interface built around browser-style tabs of Claude Code CLI sessions (one tab per project), an integrated file explorer, per-tab Claude session status awareness driven by Claude Code hooks, Monaco read-only+diff viewer, tear-off tabs into separate windows, workspace persistence, and app-owned OS notifications. React+TS+Vite renderer, node-pty terminals via xterm.js, electron-store persistence. Full design at documents/claude-terminal-ide.md. CYCLE 6 END GOAL (operator): fully mouseless, keyboard-only navigation across all of Weft; macOS/Linux platform work OUT OF SCOPE this cycle."
project_name: "weft"
project_type: web
spec_path: documents/steiner-spec.md
test_cmd: pnpm test
dev_server_port: 5173
coverage_pct: 98.44
divergence_readings: []
current_focus: "CYCLE 8 — in-project split-pane workspace (spec ## Expansion 8; brief documents/split-pane-workspace.md). Cycle 7 (remappable keybindings) is SEALED — all 12 criteria met, 401 unit + 30 E2E green, reviewed + converged (leap 58 fixed TerminalPane using the default keymap). NEXT (leap 59, first Cycle-8 leap): build the PURE core foundation — (a) an open-file-tabs reducer in core (list of {path,name} + activeIndex: openFile adds-or-reactivates no-dup, closeFile drops + reselects, setActive), unit-tested with fakes; (b) a dock-state reducer (position 'bottom'|'right'|'left' + size ratio with clamping). Then wire the renderer: replace the single viewer-store file with the tabs model, render an editor-tab strip, and turn the absolute-overlay .viewer-pane into a real split (editor area + moveable/resizable CLI dock) that shows full-width CLI when no file is open. Persist dock position/size (+ maybe open tabs) via WorkspaceState v4→v5 migration. Then focus-CLI command, keyboard/a11y, and the E2E workspace journey."
blocked_on: null
last_test_run: "401 unit + 30 Playwright-Electron E2E, all green; coverage 98.54/96.54/97.42; typecheck clean (the hook-forwarder integration test passes once CLAUDE_IDE_TAB is unset)"
closed_worldlines: []
next_action: "Cycle-8 leap 60: RENDERER wiring. Grow viewer-store from a single {file} to the open-files model (core/workspace/open-files.ts) — openFile adds/reactivates a tab, add closeFile/setActive; keep mode/editing/saveTick. Render an editor-tab strip above the Monaco pane (accessible, keyboard-operable, closable). ViewerPane reads activeFile. Explorer's openInViewer already calls a store action — point it at openFile. Keep behaviour green (viewer/App tests may need updating for the tabs shape). NEXT leaps: 61 split layout — replace the .viewer-pane absolute overlay with a real split (editor area + CLI dock via core/workspace/dock.ts), full-width CLI when open-files is empty; 62 moveable/resizable dock (drag divider, re-dock bottom/right/left) + persist dock (WorkspaceState v4→v5 migration, mirror keymapOverrides threading); 63 focus-CLI command + keyboard/a11y; 64 E2E workspace journey + review/convergence. spec ## Expansion 8."
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
max_iterations: 76
push_to_github: false
bypass_playwright: false
sern_no_progress_streak: 0
lessons_learned: ["cycle 7: remappable keybindings — the SAME dual-source risk as cycle 6 bit again: xterm's attachCustomKeyEventHandler called routeKey WITHOUT the effective keymap, so once chords became remappable it silently disagreed with the app listener (98% unit coverage missed it; the Future-Okabe review caught it). Lesson: when a shared pure function gains a parameter (the keymap), audit EVERY caller — a defaulted arg hides stale callers. Data-driven-first paid off: making routeKey resolve against a keymap table made remapping a thin overrides layer with no router changes. The ref-guarded tick-store pattern (viewer saveTick → terminal searchTick → session renameTick) is a clean way for the command layer to poke a DOM-bound component; watch it doesn't proliferate.", "cycle 6: mouseless keyboard nav — a SINGLE pure keybinding-router as the one source for both the App window listener and xterm's attachCustomKeyEventHandler kept the PTY-passthrough invariant consistent (and regression-tested). The one real bug (viewer.save palette no-op) came from TWO parallel dispatch switches (KeyAction vs CommandId) drifting — a copy-pasted duplicate case displaced a handler; adversarial 3-reviewer pass caught it, 98% unit coverage did not. Region-local keys (F2 rename, explorer arrows, viewer Ctrl+S) are best handled by their components, NOT the global router, so they only act in-context and otherwise reach the PTY. E2E that presses a chord must wait for the shell to mount (domcontentloaded precedes React's listener attach) — a startup race that passed by luck once. Mayuri (non-programmer) review surfaced doc gaps devs assume (define 'focus', how to open a folder by keyboard).", "cycle 1: node-pty Electron rebuild blocked twice on Windows — (a) NoDefaultCurrentDirectoryInExePath=1 breaks winpty GetCommitHash.bat (now unset inside scripts/rebuild-native.mjs), (b) SpectreMitigation flag required Spectre VS libs (removed via committed pnpm patch node-pty@1.1.0). Rebuild reproducible via pnpm rebuild:native.", "cycle 1: api-level E2E can mask product-path bugs — always E2E the actual UI path for core guarantees. Guard every main->renderer send (destroyed webContents throw). ConPTY children pin process exit — hard-exit fallback after graceful shutdown. Pure-core + injected fakes kept 200+ tests fast; adversarial 3-reviewer pass found a critical bug 98% coverage missed.", "cycle 4: WebGL renderer removes terminal text from the DOM, killing a11y + all text-based E2E; DOM renderer only. Packaged-exe E2E catches asar/native packaging mistakes nothing else sees.", "cycle 6 (planning): keyboard chords MUST route through the single pure keybinding-router so the App listener and xterm attachCustomKeyEventHandler never disagree; the out-of-band Ctrl+Shift+F terminal-search special-case is the anti-pattern to fold back in. Any new chord must be regression-tested against the protected PTY-passthrough set."]

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
