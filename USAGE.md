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

### Tabbed Claude sessions
_TBD_
