# Contributing to Weft

Thanks for helping weave. This is a small, test-heavy codebase with hard
architectural boundaries — read this once and PRs will go smoothly.

## Dev setup

Prerequisites: Node 20+, `pnpm` (`npm i -g pnpm`), the `claude` CLI on PATH,
and on Windows the VS Build Tools 2022 with the *Desktop development with C++*
workload + Python 3.x.

```bash
pnpm install
pnpm rebuild:native   # node-pty against Electron's ABI (once)
pnpm dev              # run the app
```

## Tests — the bar

```bash
pnpm typecheck   # tsc project references, strict
pnpm test        # vitest unit/integration
pnpm test:cov    # coverage gate: 95% statements / 90% branches (currently ~98%)
pnpm test:e2e    # Playwright drives the REAL built Electron app
```

Every feature or fix ships with tests. Bug fixes include a regression test
that fails before the fix. **Core guarantees (reload-safe sessions, hook→badge
mapping, tear-off same-PTY) must be E2E-tested through the real UI path** —
api-level tests alone have masked product bugs before (see STEINER_LOG Leap 19).

## Architecture boundaries (enforced by review)

| Layer | Rule |
| --- | --- |
| `src/shared/` | Types/constants only. No electron, no node builtins, no DOM. |
| `src/core/` | Pure logic. No electron/node-pty/fs/net; time & I/O are injected. |
| `src/main/services/` | Thin adapters over core, dependencies injected for tests. |
| `src/main/container.ts` | The ONLY place Electron singletons meet app logic. |
| `src/preload/` | Marshalling only, typed against `shared/ipc/api-contract`. |
| `src/renderer/` | View over main's truth; business decisions belong in core/main. |

Practical implications:
- New IPC = channel constant + `WeftApi` method + bridge entry + handler + tests. Validate renderer-supplied args at the handler boundary; drop or throw, never let them reach native code raw.
- Never `sender.send` without the destroyed-guard pattern (see `register.ts` `safeSend`).
- The status endpoint is a named pipe/UDS — **never** a TCP port. The user's personal `~/.claude/settings.json` is **never** written.

## E2E conventions

Use `launchWeft()` from `e2e/helpers.ts` (strips inherited `WEFT_*`, isolates
userData). Seams for automation: `WEFT_E2E_OPEN_DIR` (folder-picker bypass),
`WEFT_OPEN_PROJECT_COMMAND=shell`, `WEFT_CLAUDE_BIN`, `WEFT_USER_DATA_DIR`.
No bare sleeps — poll for observable state.

## Commits / PRs

Small, focused commits; present-tense messages. Update `USAGE.md` when
behavior changes. CI must be green (typecheck + unit + coverage; E2E on
Windows).
