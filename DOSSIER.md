# weft — Future Gadget Dossier

## What this is
Weft is a cross-platform (Windows-first) open-source Electron desktop app: a VS Code-style shell wrapped around browser-style tabs of Claude Code CLI sessions — one tab per project, each running a live interactive `claude` session in its own pseudo-terminal (node-pty + xterm.js). It adds an integrated file explorer, a Monaco read-only + diff viewer, tear-off tabs into separate OS windows, workspace persistence, and — the defining differentiator — per-tab Claude session status (working / waiting / done / error) driven by Claude Code's own lifecycle hooks (not output scraping), plus app-owned OS notifications that focus the right tab when a session needs attention. Market research confirms the wedge: no existing tool combines hook-driven per-session status + tab-focusing notifications + Windows-first + a tear-off VS Code shell.

## Current status
Phase: Time Leap Development (Leap 8/30, Cycle 1)
Phase: v0.2.0 END GOAL REACHED (Leap 33/40, Cycle 5)
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
