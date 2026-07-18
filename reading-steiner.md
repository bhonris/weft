phase: christinas-analysis
leap_count: 44
expansion_cycle: 6
session_id: 2026-07-18T10:30:00Z
prev_head: 84f983a27059d26f2d4b7915225740a4b487636a
original_prompt: "Build Weft — a cross-platform (Windows-first) Electron desktop app with a VS Code-style interface built around browser-style tabs of Claude Code CLI sessions (one tab per project), an integrated file explorer, per-tab Claude session status awareness driven by Claude Code hooks, Monaco read-only+diff viewer, tear-off tabs into separate windows, workspace persistence, and app-owned OS notifications. React+TS+Vite renderer, node-pty terminals via xterm.js, electron-store persistence. Full design at documents/claude-terminal-ide.md. CYCLE 6 END GOAL (operator): fully mouseless, keyboard-only navigation across all of Weft; macOS/Linux platform work OUT OF SCOPE this cycle."
project_name: "weft"
project_type: web
spec_path: documents/steiner-spec.md
test_cmd: pnpm test
dev_server_port: 5173
coverage_pct: 98
divergence_readings: []
current_focus: "Phase 4 — Future Okabe ×3 adversarial review of the cycle-6 keyboard-navigation surface (keybinding-router, commands/registry+fuzzy+chord, focus/region-cycle, explorer/tree-nav, CommandPalette, KeyboardHelp, Explorer rewrite, App focus manager + dispatch, viewer-store/ViewerPane save path, terminal-search routing). Consolidate findings into review_items.must_fix / nice_to_have, then Phase 5 convergence (fix must-fix), Phase 6 checkpoint (USAGE/README/DOSSIER + Mayuri), Phase 7 expansion decision."
blocked_on: null
last_test_run: "316 unit + 27 e2e, 0 fail; typecheck clean"
closed_worldlines: [worldline-expansion, time-leap-development, divergence-meter-reading]
next_action: "Run pnpm test:cov to confirm >=95% gate; spawn Future Okabe ×3 review (simplicity / correctness+security / test quality); consolidate review_items; then converge."
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
max_iterations: 50
push_to_github: false
bypass_playwright: false
sern_no_progress_streak: 0
lessons_learned: ["cycle 1: node-pty Electron rebuild blocked twice on Windows — (a) NoDefaultCurrentDirectoryInExePath=1 breaks winpty GetCommitHash.bat (now unset inside scripts/rebuild-native.mjs), (b) SpectreMitigation flag required Spectre VS libs (removed via committed pnpm patch node-pty@1.1.0). Rebuild reproducible via pnpm rebuild:native.", "cycle 1: api-level E2E can mask product-path bugs — always E2E the actual UI path for core guarantees. Guard every main->renderer send (destroyed webContents throw). ConPTY children pin process exit — hard-exit fallback after graceful shutdown. Pure-core + injected fakes kept 200+ tests fast; adversarial 3-reviewer pass found a critical bug 98% coverage missed.", "cycle 4: WebGL renderer removes terminal text from the DOM, killing a11y + all text-based E2E; DOM renderer only. Packaged-exe E2E catches asar/native packaging mistakes nothing else sees.", "cycle 6 (planning): keyboard chords MUST route through the single pure keybinding-router so the App listener and xterm attachCustomKeyEventHandler never disagree; the out-of-band Ctrl+Shift+F terminal-search special-case is the anti-pattern to fold back in. Any new chord must be regression-tested against the protected PTY-passthrough set."]

# ── Expansion Cycle 6 (Leap 34+) — Mouseless / keyboard-only navigation ──
# Operator END GOAL: keyboard-only operation of all of Weft. OUT OF SCOPE: macOS/Linux, split panes/LSP.
# Plan (each ~1 leap): (35) router chords + passthrough guard; (36) pure command registry + fuzzy;
# (37) command palette overlay + wire actions; (38) keyboard help overlay; (39) region-focus system +
# :focus-visible styling all themes; (40) pure tree-nav + explorer roving tabindex; (41) tab reorder/
# rename(F2)/type by keyboard; (42) viewer mode switches + app-level Ctrl+S; (43) status controls via
# commands; (44) mouseless E2E journey + focus-ring/passthrough E2E; then Phase 4 review, convergence,
# checkpoint. Spec: documents/steiner-spec.md ## Expansion 6. Design: documents/keyboard-navigation.md.
