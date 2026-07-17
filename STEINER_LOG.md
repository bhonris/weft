# Steiner Log — weft

> Reading Steiner: the lab's memory across worldline shifts. Newest leap on top.

## Leap 3 — steiner: feat(persistence) — 2026-07-17T16:32:00Z

**Phase**: time-leap-development
**Changed**: Implemented the workspace persistence vertical slice (Beta core + adapter). Pure `core/persistence`: `schema` (zod shapes + WORKSPACE_VERSION + compile-time schema↔API conformance assert), `migrations/` (ordered chain + `v0ToV1` legacy upgrade), `validate.loadWorkspace(raw) -> Result<LoadedWorkspace>` (nullish→default, non-object→err, migrate+validate, migration-throw handling). `main/services/WorkspaceStore` adapter over an injectable `KeyValueStore` + backup fn (writes config.bak before a migrating overwrite; corrupt blob → default + warn). Added `Result` helper test. Fixed TS project-ref path aliases in tsconfig.shared + excluded test files from `tsc -b`.
**SERN interference**: none (fixed two build issues inline: missing @shared/@core paths in shared project; over-strict bidirectional schema type-assert vs version literal)
**Divergence meter**: 100% stmts / 98.83% branch / 100% funcs (built modules), 40 pass, 0 fail
**Next target**: PtyManager with injectable PtyFactory + node-pty native install; then session correlation (--session-id + inline --settings hooks + CLAUDE_IDE_TAB).

---

## Leap 2 — steiner: worldline-beta-selected — 2026-07-17T16:24:00Z

**Phase**: worldline-selection → time-leap-development
**Changed**: Kurisu ×2 proposed Alpha (minimal) vs Beta (clean seams + platform ports + DI). Chose **Beta** (multi-concern app, 95% coverage bar, cross-platform seam, v2 roadmap). Scaffolded electron-vite skeleton: `shared/` contract (result, ipc/channels, ipc/api-contract, status/hook-events), first pure `core/status/status-mapper` + 12 passing tests, minimal main/preload/renderer Electron shell, tsconfig project refs, vitest (projects api, 95%/90% coverage thresholds). `pnpm install` clean, Electron 34 binary downloaded, `pnpm build` compiles all 3 targets, `pnpm test` → 12 pass. Fixed preload path (.mjs under type:module).
**SERN interference**: none (node-pty native install deferred to keep first build green; PtyFactory DI means unit tests never import it)
**Divergence meter**: 12 pass, 0 fail (coverage n/a yet)
**Next target**: Implement core/persistence (migrations + validate) and main/services/workspace-store; then PtyManager with injectable PtyFactory.

---

## Leap 1 — steiner: divergence-analysis — 2026-07-17T16:07:00Z

**Phase**: divergence-analysis
**Changed**: Faris ran market research (confirmed the wedge: hook-driven per-session status + tab-focusing notifications + Windows-first + tear-off shell; competitors scrape output or are Mac-only/worktree-framed). Okabe authored `documents/steiner-spec.md` with 21 machine-checkable acceptance criteria. Spec Quality Gate passed. DOSSIER populated.
**SERN interference**: none
**Divergence meter**: unknown (no code yet)
**Next target**: Worldline Selection — Kurisu ×2 propose Alpha (minimal) vs Beta (clean) architectures; scaffold electron-vite skeleton.

---
