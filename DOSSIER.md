# weft — Future Gadget Dossier

## What this is
Weft is a cross-platform (Windows-first) open-source Electron desktop app: a VS Code-style shell wrapped around browser-style tabs of Claude Code CLI sessions — one tab per project, each running a live interactive `claude` session in its own pseudo-terminal (node-pty + xterm.js). It adds an integrated file explorer, a Monaco read-only + diff viewer, tear-off tabs into separate OS windows, workspace persistence, and — the defining differentiator — per-tab Claude session status (working / waiting / done / error) driven by Claude Code's own lifecycle hooks (not output scraping), plus app-owned OS notifications that focus the right tab when a session needs attention. Market research confirms the wedge: no existing tool combines hook-driven per-session status + tab-focusing notifications + Windows-first + a tear-off VS Code shell.

## Current status
Phase: Divergence Analysis complete (Leap 0/30, Cycle 1)
Divergence meter: unknown (no code yet)

## Stack
TypeScript · pnpm · Electron + electron-vite · React + Vite (renderer) · xterm.js (+fit/webgl/search/serialize) · node-pty · chokidar · electron-store · zustand · monaco-editor · dockview · vitest + @vitest/coverage-v8 · @playwright/test (Electron)

## Acceptance criteria — Cycle 1
- [ ] Creating a tab spawns `claude --session-id <uuid>` in the selected cwd; `createSession` resolves with `{ tabId }`
- [ ] PTY env has `CLAUDE_IDE_TAB`; launch registers hooks via inline `--settings` without touching `~/.claude/settings.json`
- [ ] Tabs can be created, renamed, and reordered; strip order matches `tabOrder`
- [ ] Closing a tab kills the PTY and removes it from the registry
- [ ] Typed input round-trips to the PTY; `Ctrl+C` reaches the PTY (not an app shortcut)
- [ ] `resizeSession` calls `pty.resize`; rapid resizes throttled to ≤1 per 50ms
- [ ] Tear-off keeps the same `sessionId`/PID with no respawn; xterm re-attaches
- [ ] `permission_prompt`/`agent_needs_input`/`idle_prompt`/`elicitation_dialog` → `waiting` within 1s
- [ ] `UserPromptSubmit` → `working`; `Stop`/`agent_completed` → `done`; `StopFailure`/nonzero exit → `error`
- [ ] Hook routing by `session_id`, falling back to `tabId` then `cwd`; unknown dropped+logged
- [ ] OS notification when unfocused; click focuses correct window + activates correct tab
- [ ] Status server binds named pipe / UDS, never a TCP socket
- [ ] File explorer lists a dir; external add/change/unlink → `onFsChange` within ~1s
- [ ] `getDiff` returns `{original, modified}`; Monaco diff renders; `readFileText` opens read-only
- [ ] Reopen restores tabs, cwds, order, explorer roots, theme, window bounds
- [ ] Older-version blob runs migration chain with `config.bak` backup
- [ ] Badges use distinct shape+color+aria; reduced-motion renders static
- [ ] Honors OS light/dark when `theme:'system'`; override persists
- [ ] `claude` not on PATH → actionable error + Retry, no crash
- [ ] Status endpoint down → `unknown` status; terminal still works
- [ ] Statement coverage ≥95%; Playwright-Electron E2E passes

## Lab Members engaged
Faris (market research), Okabe (spec author)
