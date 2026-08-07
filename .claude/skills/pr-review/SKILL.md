---
name: pr-review
description: Comprehensive adversarial review of a weft pull request — correctness/testing, security, dead code, UI/design, and architecture — for the autonomous issue-driven dev loop (documents/pr-review-skill.md). Posts VERDICT: APPROVE or VERDICT: REQUEST_CHANGES as a PR review comment.
---

# PR Review

You are reviewing a pull request you did not write. Review it adversarially —
your job is to find real problems, not to confirm it looks plausible. Default
to `REQUEST_CHANGES` when uncertain: a false rejection costs one revise cycle;
a false approval merges a real problem.

The PR number and base branch are given in the invocation. Read the diff with:

```
git diff origin/<base branch>...HEAD
```

Read whichever changed files you need in full — the diff alone often isn't
enough to judge layer placement, test quality, or whether an existing pattern
was actually followed.

## 1. Correctness & testing

- Does the diff actually solve the issue it claims to close, not just look
  plausible? Re-read the linked issue if there's any doubt.
- New/changed lines are covered by tests — check the diff's own lines, not
  just that the aggregate coverage number still clears the gate (a large
  codebase can hide untested new logic behind an unrelated cushion).
- Every bug fix has a regression test that would fail without the fix.
- Tests assert behavior, not implementation (no tautological tests — a test
  that just re-encodes what the code does, rather than what it should do,
  isn't real coverage).
- Edge cases the issue itself named are actually covered.
- Run `pnpm typecheck` and `pnpm test:cov` yourself if the PR's own claimed
  numbers are at all suspicious (round numbers, no detail, doesn't match the
  diff's size) — don't take a self-reported "tests pass" at face value when
  it's cheap to verify directly.

## 2. Security (weight this heavily — weft is a public, open-source repo)

- Input validation at trust boundaries: IPC handlers, file paths, external
  URLs, anything crossing the renderer/main boundary.
- No secrets, tokens, or credentials logged, echoed, or committed.
- New filesystem access is root-guarded (the `isInsideAnyRoot`/`isPathInside`
  pattern), not a one-off ad hoc check.
- No new `shell.openExternal`/`exec`/`eval`-shaped call without a safety
  check comparable to `isSafeExternalUrl`.
- No unescaped user/external content rendered raw (XSS surface).
- New dependencies: reputable source, actively maintained, license
  compatible with an OSS repo, minimal added surface. A new dependency for
  something a few lines of code could do is itself worth questioning.
- A widened permission or allowlist (Bash tool scope, IPC channel, App
  permission) is justified by the issue, not incidental to it.

## 3. Dead & obsolete code

- Removed code is *fully* removed — no orphaned imports, unused exports,
  commented-out blocks left behind.
- No backwards-compatibility shims or feature flags for something being
  replaced outright.
- No new logic duplicating an existing utility that should have been reused
  instead.

## 4. UI / design review (static/code-level — no visual rendering available)

- Responsive: relative units where appropriate, no fixed-pixel assumptions
  that would overflow at other window sizes.
- Both themes handled — no hardcoded colors bypassing the existing CSS
  variables.
- Visually/interactionally consistent with the existing component it's
  modeled on (a new toggle should look and behave like the pattern it's
  based on, not invent a new visual language).
- Keyboard-operable — weft advertises fully mouseless keyboard navigation;
  a mouse-only new interaction path is a real regression, not a style nit.
- `aria-label`s present; status/state communicated isn't color-only.
- Animations, if any, respect `prefers-reduced-motion`.

## 5. Architecture & design quality

- Layer boundary respected: decisions in `src/core/` are pure and
  framework-free (no Electron imports); `src/main/` stays a thin adapter over
  that logic. This is `CLAUDE.md`'s stated #1 rule — check it explicitly,
  don't assume a generic reviewer would have caught a violation.
- No ad-hoc, one-off special-casing where extending an existing general
  mechanism was the actual right shape for the problem.
- Solves the general case the issue implies, not only the literal reported
  instance, without overreaching into a bigger feature than was asked for.
- No premature abstraction either — flag over-engineering (a new
  configurable framework for one use site) as readily as
  under-engineering. Three similar lines can be better than an abstraction.
- Flakiness: async cleanup is real (event listeners removed, timers cleared,
  aborts wired up), no fixed `sleep`s in tests, no unguarded races.

## 6. Documentation & claim accuracy

- Docs/comments describe what's *actually implemented*, not what's planned
  or aspirational. Cross-check any specific claim (a label that's "applied,"
  a mechanism that's "active") against the actual code that would do it —
  don't trust the prose. This exact class of bug — a PR claiming a label was
  live when no workflow ever set it — is what an earlier review on this repo
  caught, and it's worth being just as suspicious here.
- `CLAUDE.md` is updated if the PR changes an architectural invariant, adds a
  script, or touches the layer boundary — check its own "Maintaining this
  file" instruction against what the diff actually changed.

## 7. Scope discipline

- Diff matches the issue's stated scope — no unrelated drive-by changes bundled in.
- No features or abstractions added beyond what the issue actually asked for.

## 8. PR hygiene

- The PR body accurately describes the actual diff, not a template left
  half-filled.
- Contains `Closes #<N>` referencing the right issue.
- Commit messages are meaningful, not `wip`/`fix`.

## Output contract

Post exactly ONE review on the PR, as a **comment review** — not a formal
approval (the app posting it cannot approve its own org's PR) — whose body's
FIRST LINE is exactly one of:

```
VERDICT: APPROVE
VERDICT: REQUEST_CHANGES
```

followed by your reasoning, organized by whichever categories above are
actually relevant to this diff (skip categories with nothing to say rather
than padding). Be specific: "the new `X` has no test for the empty-input
case, see `Y.test.ts` for the pattern" is actionable; "improve tests" is not.
If this PR will go through an automated revise pass on `REQUEST_CHANGES`,
specific feedback is the difference between it converging and it stalling.

Note explicitly which categories don't apply to this diff (e.g. "no UI
changes in this PR" for a pure backend fix) rather than silently omitting
them — that distinguishes "checked, not applicable" from "forgot to check."
