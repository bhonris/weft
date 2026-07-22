<!--
Thanks for contributing to weft! Please read CONTRIBUTING.md first.
Keep PRs small and focused. Fill in the sections below and delete this comment.
-->

## What & why

<!-- What does this change and what problem does it solve? Link issues: "Closes #123". -->

## Type of change

- [ ] Bug fix (includes a regression test that fails before the fix)
- [ ] New feature (includes tests)
- [ ] Refactor / internal (no behavior change)
- [ ] Docs / tooling

## Architecture boundary

<!-- weft's #1 rule: decisions live in pure src/core, main/ is a thin adapter, renderer is a view.
     Note where your logic landed and why. See CONTRIBUTING.md. -->

- [ ] Business logic added lives in `src/core/**` (pure, tested), not baked into IPC/renderer
- [ ] No `electron`/`node-pty`/`fs`/`net` imports in `src/core/**`
- [ ] New IPC (if any) = channel constant + `WeftApi` method + bridge entry + handler + arg validation

## Testing

- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` green
- [ ] `pnpm test:cov` meets the gate (95% statements / 90% branches)
- [ ] `pnpm test:e2e` (if touching reload-safety, hook→status, or tear-off PTY)

<!-- Describe what you tested manually, if anything. -->

## Invariants checklist

- [ ] Renderer reload does not kill a PTY (attach/detach, not close)
- [ ] Status remains hook-driven — no output scraping
- [ ] Status endpoint stays a named pipe / UDS — never TCP
- [ ] The user's `~/.claude/settings.json` is never written
