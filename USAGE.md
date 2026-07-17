# weft — Lab Member Operating Manual

## Installation

```bash
pnpm install     # installs deps; downloads the Electron binary
pnpm dev         # launch the app in development (electron-vite)
pnpm build       # production build of main + preload + renderer
pnpm test        # run the unit/integration suite (vitest)
pnpm test:cov    # run tests with coverage (95% statement gate)
```

> **Prerequisite:** a working `claude` CLI on your PATH (Windows 10+ for ConPTY).
> **Native module note:** `node-pty` is a native dependency rebuilt for Electron's
> ABI; this is validated in the Phase-0 ConPTY spike.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/shared/` | Pure IPC contract & data types (no electron/node/dom). |
| `src/core/` | Pure business logic (status mapper, reducers, migrations). |
| `src/main/` | Electron main process: PTY manager, status server, fs, persistence. |
| `src/preload/` | Typed `window` bridge (contextIsolation on). |
| `src/renderer/` | React + Vite UI: tabs, explorer, terminal, diff viewer. |

## Features

_Documented as each feature lands._

### Workspace persistence

Weft persists your workspace (open tabs, tab order, explorer roots, theme, and
window bounds) as a single versioned JSON blob via `electron-store`. On launch it
loads and validates that blob; on any change it saves the updated state.

- **Schema versioning & migration.** Every persisted blob carries a `version`.
  On load, older blobs are upgraded through an ordered migration chain to the
  current shape. Before an upgrade overwrites the stored value, the original blob
  is backed up (to `config.bak`) so a bad migration can be recovered.
- **Corruption safety.** If the stored blob is missing, malformed, or fails
  validation, Weft falls back to a fresh default workspace instead of crashing.

Internals: pure logic lives in `src/core/persistence/` (`schema` — zod shapes +
`WORKSPACE_VERSION`; `migrations/` — the ordered upgrade chain; `validate` —
`loadWorkspace(raw)` returning a `Result`). The `WorkspaceStore` adapter in
`src/main/services/workspace-store.ts` wires that to `electron-store` and the
backup writer, and is fully unit-tested against an in-memory fake store.

### Terminal sessions & reload-safe recovery

The main process owns every PTY through the `PtyManager` (`src/main/services/pty-manager.ts`); the renderer is a **detachable view**. This is what makes sessions survive UI edits (spec §4.7):

- **Decoupled lifecycle.** A PTY is killed only by `closeSession` (tab close) or the process exiting — **never** by a renderer reload, HMR update, or a React crash.
- **Ring-buffer replay.** Each session keeps a bounded buffer of recent raw output (`OutputRingBuffer`, default 200k chars). `attachSession(tabId)` returns that snapshot to replay into a freshly mounted xterm — so after a reload the terminal redraws its history — then live output streams in.
- **Idempotent attach/detach.** Re-mounting (e.g. after HMR) detaches the old view and attaches a new one, leaving exactly one live subscription and the **same** PTY process (no respawn).
- **Throttled resize.** Drag-resize storms are coalesced to ≤ 1 `pty.resize` call per 50 ms (leading + trailing) via the pure `Throttle` in `src/core/terminal/resize-throttle.ts`.
- **Hook routing.** Incoming Claude Code hook payloads are routed to a tab by `session_id` → `tabId` → `cwd` (`src/core/status/session-correlator.ts`).

The production PTY is provided by `NodePtyFactory` (node-pty / ConPTY on Windows), injected into `PtyManager`; unit tests inject a `FakePty`, so the whole manager is tested without the native module.

**How to use it (once running):** click **+** in the tab strip → pick a project folder → Weft spawns `claude --session-id <uuid>` rooted there and shows it in a live terminal tab. Type into the terminal as normal; close a tab with its **×**. Each tab shows a status glyph (● working, ‖ waiting, ✓ done, ✕ error).

> Status: wired end-to-end — IPC handlers (`src/main/ipc/register.ts`), typed preload bridge (`window.api`, `src/preload/create-bridge.ts`), renderer `TerminalPane` (xterm, attach-on-mount replay, HMR-safe cleanup), zustand `session-store`, and a `WorkbenchErrorBoundary` (fallback + reload). Verified by 98 unit/integration tests; live browser-level verification is Phase 3b.
