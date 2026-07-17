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

### Tabbed Claude sessions
_TBD — PtyManager + session correlation next._
