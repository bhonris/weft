# PR Review Skill + Course Correction

## Feature specification

Replace `ai-review.yml`'s current review pass — a fairly generic check against
`CLAUDE.md`'s invariants — with a genuine **PR Review skill**: a maintained,
comprehensive checklist covering correctness, security, dead code, UI/design
quality, and architecture, packaged as a Claude Code Skill
(`.claude/skills/pr-review/SKILL.md`) rather than inline prompt text in a
workflow file. Pair it with a **course-correction loop**: on
`VERDICT: REQUEST_CHANGES`, a new `revise` job reads the feedback, attempts to
address it on the same branch, and pushes — which naturally re-triggers review
via the existing `synchronize` event — up to a retry cap, after which the loop
gives up and labels `ai:gave-up`.

This directly closes a gap found during tonight's dry run: `ai:gave-up` exists
as a label (`documents/ai-managed-repo.md`) that nothing has ever applied,
because there's no retry logic — a `REQUEST_CHANGES` verdict has only ever
dead-ended at `needs-human`, permanently, on the very first attempt.

## Scope & out of scope

**In scope**
- A `.claude/skills/pr-review/SKILL.md` encoding the full review checklist
  (below), invoked by `ai-review.yml` in place of its current inline prompt.
- A `revise` job/workflow: on `REQUEST_CHANGES`, attempt to address the
  specific feedback and push a fixup commit, bounded by a retry cap.
- `ai:gave-up` actually gets applied once the cap is exhausted.
- Static/code-level UI review (theme variables, aria-labels, responsive units,
  consistency with existing components) — see UI/UX considerations for why
  *visual* (screenshot-based) review is explicitly deferred.

**Out of scope (initially)**
- Visual/screenshot-based UI review (headless Electron + Playwright screenshot
  fed to a multimodal review pass). Real infra investment; see Open questions.
- Reviewing human-authored PRs — this skill is invoked only on `ai/*` branches,
  matching `ai-review.yml`'s existing gate.
- Changing what CI itself gates on — `ci.yml` remains the authoritative,
  model-agnostic correctness bar. This skill and the revise loop are a
  *cheap filter* layered in front of it, same framing as the existing
  self-review step (`documents/ai-managed-repo.md`'s Security section).

## User stories

- As the maintainer, I want the self-review step to actually catch security
  issues, dead code, and design smells, not just layer-boundary violations, so
  that autonomous PRs meet the same bar I'd hold a human contributor to.
- As the maintainer, I want a rejected PR to get a real chance to fix itself,
  so that "needs-human" means *this genuinely needs a person*, not *the agent
  didn't get feedback on its first draft*.
- As the maintainer, I want the retry loop bounded, so a PR that can't
  converge stops cleanly (`ai:gave-up`) instead of burning quota forever.
- As a future contributor to this open-source repo, I want to trust that
  merged PRs were checked for the kinds of security issues that matter in a
  public codebase, not just "does it look like the existing code."

## Acceptance criteria

- [ ] `.claude/skills/pr-review/SKILL.md` exists and covers every category
      listed under Architecture below.
- [ ] `ai-review.yml` invokes the skill (e.g. `prompt: /pr-review <PR number>`)
      instead of embedding the checklist as inline YAML prompt text.
- [ ] On `VERDICT: REQUEST_CHANGES`, a `revise` job runs, attempts a fix
      scoped to the stated feedback, and pushes to the same branch.
- [ ] The revise attempt count is tracked and capped (`MAX_REVISE_ATTEMPTS`,
      suggested start: 3); exceeding it labels `ai:gave-up` and stops —
      no further automatic pushes to that PR.
- [ ] `ai:gave-up`'s final comment states clearly what still doesn't satisfy
      review, so a human picking it up doesn't have to reconstruct the history.
- [ ] The revise job has write/edit tool access; the review job remains
      read-only (`Bash,Read,Grep,Glob`, no `Write`/`Edit`) — the reviewer
      never gains the ability to change what it's reviewing.
- [ ] A revise attempt that itself errors (not a content disagreement, an
      actual failure) is labeled distinctly from `ai:gave-up` — e.g.
      `needs-human` — so "couldn't satisfy review" and "the mechanism broke"
      aren't conflated.
- [ ] An implement run that fails outright (no PR produced — the existing
      PR-detection fix already covers "failed but a PR exists") triggers a
      fresh `workflow_dispatch` retry, up to `MAX_IMPLEMENT_ATTEMPTS`, with
      the previous attempt's failure summarized in the new attempt's prompt.
- [ ] The owner gate holds under both trigger shapes — `issues: opened` and
      the retry's `workflow_dispatch` — a retry is legitimate because the
      original event was already gated, not because the gate was bypassed.
- [ ] Exhausting `MAX_IMPLEMENT_ATTEMPTS` labels `ai:gave-up`, not
      `needs-human` — this is "tried repeatedly and couldn't," matching the
      same semantic revise-exhaustion already uses.

## Architecture & technical design

```
PR opened/synchronized
      │
      ▼
ai-review.yml: review job (read-only) — invokes /pr-review skill
      │
      ├─ VERDICT: APPROVE ──────────────────────► arm auto-merge (unchanged)
      │
      └─ VERDICT: REQUEST_CHANGES
            │
            ▼
      revise job (needs: review, if attempt-count < MAX_REVISE_ATTEMPTS)
            │  reads: original issue + latest review feedback
            │  write/edit tools, same branch, re-runs typecheck/test:cov
            ▼
      push to PR branch ──► synchronize event ──► review job runs again (loop)

      attempt-count >= MAX_REVISE_ATTEMPTS
            │
            ▼
      label `ai:gave-up`, comment summarizing unresolved feedback, stop
```

**The skill (`.claude/skills/pr-review/SKILL.md`)**

Checklist categories, each with concrete things to check (not just a label —
a reviewer prompted with vague categories produces vague verdicts):

1. **Correctness & testing**
   - Does the diff actually solve the stated issue, not just look plausible?
   - New/changed lines are covered by tests — check the diff's own lines, not
     just that the aggregate coverage number still clears 95/90 (a large
     codebase can hide untested new logic behind an unrelated cushion).
   - Every bug fix has a regression test that would fail without the fix
     (global convention).
   - Tests assert behavior, not implementation (no tautological tests).
   - Edge cases the issue itself named are actually covered.

2. **Security** (weighted heavily — this is a public, open-source repo)
   - Input validation at trust boundaries: IPC handlers, file paths, external
     URLs, anything crossing the renderer/main boundary.
   - No secrets, tokens, or credentials logged, echoed, or committed.
   - New filesystem access is root-guarded (`isInsideAnyRoot`/`isPathInside`
     pattern, not a one-off check).
   - No new `shell.openExternal`/`exec`/`eval`-shaped call without a safety
     check comparable to `isSafeExternalUrl`.
   - No unescaped user/external content rendered raw (XSS surface).
   - New dependencies: reputable source, actively maintained, license
     compatible with an OSS repo, minimal added surface.
   - A widened permission or allowlist (Bash tool scope, IPC channel, App
     permission) is justified by the issue, not incidental.

3. **Dead & obsolete code**
   - Removed code is *fully* removed — no orphaned imports, unused exports,
     commented-out blocks.
   - No backwards-compatibility shims or feature flags for something being
     replaced outright (matches the global "avoid BC hacks" convention).
   - No new logic duplicating an existing utility that should have been reused.

4. **UI / design review** (static/code-level — see Open questions for the
   visual tier)
   - Responsive: relative units where appropriate, no fixed-pixel overflow at
     other window sizes.
   - Both themes handled — no hardcoded colors bypassing CSS variables.
   - Visually/interactionally consistent with the existing component it's
     modeled on (a new toggle should look and behave like the notification
     toggle, not invent a new pattern).
   - Keyboard-operable — weft advertises "fully mouseless keyboard
     navigation"; a mouse-only new feature is a real regression.
   - `aria-label`s present; status/state isn't color-only
     (`tab-state-colors.md`'s own stated principle).
   - Animations respect `prefers-reduced-motion` if any are added.

5. **Architecture & design quality**
   - Layer boundary respected: decisions in `core/` are pure and
     framework-free; `main/` stays a thin adapter (`CLAUDE.md`'s "#1 rule" —
     a generic reviewer wouldn't know to check this; this one must).
   - No ad-hoc, one-off special-casing where extending an existing general
     mechanism was the actual right shape.
   - Solves the general case implied by the issue, not only the literal
     reported instance.
   - No premature abstraction either (global convention: "three similar lines
     is better than a premature abstraction") — flag over-engineering too,
     not just under-engineering.
   - Flakiness: async cleanup is real (listeners removed, timers cleared,
     aborts wired), no fixed `sleep`s in tests, no unguarded races.

6. **Documentation & claim accuracy**
   - Docs/comments describe what's *actually implemented*, not what's
     planned or aspirational (the exact class of bug caught on PR #19).
   - `CLAUDE.md` is updated if the PR changes an architectural invariant,
     adds a script, or touches the layer boundary — its own "Maintaining
     this file" section requires this, and a PR is well-placed to check it
     against itself.

7. **Scope discipline**
   - Diff matches the issue's stated scope — no unrelated drive-by changes.
   - No features/abstractions added beyond what the issue actually asked for.

8. **PR hygiene**
   - Body accurately describes the actual diff (not a template left
     unfilled) and contains `Closes #N`.
   - Commit messages are meaningful, not `wip`/`fix`.

The skill's output contract is unchanged from today: first line
`VERDICT: APPROVE` or `VERDICT: REQUEST_CHANGES`, posted as a **comment
review** (`.reviews[]`, not `.comments[]` — see the finding that bit this
exact mistake in `ai-review.yml` already). Feedback for `REQUEST_CHANGES`
must be specific enough for the revise job to act on it — "improve tests"
is not actionable; "the new `X` function has no test for the empty-input
case, see `Y.test.ts` for the pattern" is.

**The revise job**

- Trigger: same workflow, `needs: review`, gated on
  `verdict == 'REQUEST_CHANGES' && attempt_count < MAX_REVISE_ATTEMPTS`.
- Attempt count: count prior `weft-ai-loop` reviews on this PR whose body
  starts with `VERDICT: REQUEST_CHANGES` (`gh pr view --json reviews`) —
  no new label/counter state needed, the review history already *is* the
  count.
- Permissions: write/edit tools (implement-like), distinct from the read-only
  review job — the reviewer must never be able to change what it reviewed.
- Prompt: the original issue text + the latest review's feedback verbatim +
  an instruction to address *only* what the feedback raises, re-run
  `pnpm typecheck`/`pnpm test:cov`, and push a fixup commit to the existing
  branch (not a new branch, not squashing prior history).
- The push's `synchronize` event re-triggers `ai-review.yml` naturally —
  no bespoke re-trigger mechanism needed, reusing what already exists.
- Turn budget: start at parity with `ai-implement.yml` (currently 75) since
  a revise pass is a real, scoped implementation task, not mere commentary;
  tune from observed runs the same way `--max-turns` itself was tuned tonight.

**The implement-retry loop**

A second, separate retry mechanism from revise — reacting to a different
failure shape. Revise reacts to *"a PR exists but review found real problems
with its content"*; this reacts to *"implement produced no usable PR at all"*
(crashed, hit `error_max_turns` before committing anything — the exact shape
of the issue #22 failure, distinct from issue #23's, where a PR *did* exist
and the existing PR-detection fix in `ai-implement.yml`'s "Label outcome"
step already handles it correctly without needing a retry at all).

This is materially harder than revise, because revise gets its re-trigger for
free (a push to an existing PR branch naturally fires `synchronize`) while
`issues: opened` fires exactly once — there is no equivalent free re-trigger
for "try implementing this issue again."

```
Implement fails AND no PR found (existing check in "Label outcome")
      │
      ▼
attempt < MAX_IMPLEMENT_ATTEMPTS?
      │
      ├─ no  → label `ai:gave-up` (not `needs-human` — this is "tried
      │         repeatedly and couldn't," the same semantic revise-exhaustion
      │         already uses, not "the mechanism itself is broken")
      │
      └─ yes → gh workflow run ai-implement.yml \
                 -f issue_number=<N> -f attempt=<attempt+1> \
                 -f previous_failure_context=<summary>
                      │
                      ▼
               a fresh workflow_dispatch run, same job, attempt-aware prompt
```

- **New trigger**: `ai-implement.yml` gains `workflow_dispatch` alongside
  `issues: opened`, with inputs `issue_number`, `attempt` (default `"1"`),
  and `previous_failure_context` (optional). Every place the job currently
  reads `github.event.issue.number`/`.title`/`.body` needs to work under
  *either* trigger — `workflow_dispatch` carries only the issue number as an
  input, not the full issue object, so an early step must `gh issue view` to
  fetch title/body when dispatched this way. This touches most of the
  existing job, not just the retry path — the real cost of this design.
- **Owner gate under two trigger shapes**: the existing
  `if: github.event.issue.user.login == github.repository_owner` only makes
  sense for the `issues` trigger. A `workflow_dispatch` retry is dispatched
  by the loop's own prior run (already gated once, at the original issue-open
  event), not by an arbitrary actor — the gate needs an equivalent check
  against `github.actor` for that trigger shape, not a blanket bypass.
- **Prompt context on attempt > 1**: include a summary of the previous
  attempt's failure — not just "it failed," but what it had gotten through
  (e.g., "attempt 1 implemented the persistence layer, per its own file
  edits, before running out of turns without committing") — so a retry
  doesn't re-explore from zero. Since nothing was committed on a genuine
  implement failure (see above — a failure *with* a commit is handled by the
  existing PR-detection fix, not this loop), the retry still starts from a
  clean checkout; the context is there to make it turn-efficient, not to
  resume literal file state.
- **`MAX_IMPLEMENT_ATTEMPTS`**: recommend starting lower than revise's 3
  (e.g. 2) — each implement attempt is more expensive than a revise pass
  (full exploration + implementation + test cycle each time, not a scoped fix
  to existing feedback), so the cost of a high cap compounds faster.

## API contract / Database changes

N/A — no application API or schema changes. New surface is the Skill file,
workflow job graph, and the `ai:gave-up` label finally being applied.

## UI/UX considerations

- **No visual/screenshot review in v1.** Claude Code is multimodal and *could*
  review a screenshot, but producing one requires running the actual Electron
  app headlessly (`xvfb-run` or equivalent) on the `ubuntu-latest` review
  runner and capturing the changed surface in both themes — real
  infrastructure, not a prompt change, and Windows-first rendering may not
  match a Linux headless render closely enough to trust anyway. Static/code
  review (category 4 above) is the v1 bar; visual review is a named, deferred
  enhancement (Open questions), not a silently-dropped requirement.
- `ai:gave-up`'s comment is user-facing in the sense that it's what a human
  reads when picking up a stalled PR — it should summarize *what* still fails
  review and *why* the revise attempts didn't resolve it, not just restate
  the label.

## Security considerations

- **The reviewer must never gain write access.** This is the one invariant
  that must not slip while adding the revise loop: review and revise stay
  separate jobs with separate, non-overlapping tool permissions. A reviewer
  that can also edit code is a materially different (weaker) safety property
  than the one already documented in `ai-managed-repo.md`.
- **The revise loop is a new place prompt injection could matter.** The
  original issue body is untrusted input (already true for implement); the
  revise prompt now also carries forward the *review's* feedback text, which
  is bot-authored and therefore trusted — but if a future change ever let a
  human's PR comment feed into the revise prompt, that would reopen the same
  untrusted-input class implement already has to guard against. Keep the
  revise prompt's inputs to (issue body, own-bot review body) only.
- **Retry cap is a cost/abuse bound, not just a UX nicety.** Uncapped
  revise↔review cycling on a PR that can't converge is a direct path to
  draining the shared subscription quota the whole loop already competes
  with the maintainer's interactive use for (`ai-managed-repo.md`'s
  Performance & quota section).

## Performance & quota considerations

- Each `REQUEST_CHANGES` → revise → re-review cycle costs roughly one
  implement-sized run plus one review-sized run. At `MAX_REVISE_ATTEMPTS = 3`,
  a maximally-stubborn PR now costs up to ~4x a single review pass before
  giving up, versus today's fixed 1x. This is the direct tradeoff for closing
  the `ai:gave-up` gap — worth stating plainly rather than discovering it
  from a quota bill.
- The richer review checklist itself doesn't obviously cost more turns than
  today's prompt (same one pass, more categories in the same pass) — but
  should be watched: if a real run shows the reviewer running long/shallow
  trying to cover everything, that's the signal to split into the
  multi-dimension parallel-reviewer design named in Open questions, not to
  quietly drop categories.
- **The implement-retry loop compounds with the revise loop, not just adds to
  it.** A worst case is now: up to `MAX_IMPLEMENT_ATTEMPTS` (2) full implement
  attempts to get a PR at all, each of which could then separately run the
  full `MAX_REVISE_ATTEMPTS` (3) revise↔review cycle. That's a real multiple
  of today's fixed 1x-implement-1x-review cost, on the same quota that
  competes with interactive use — the single biggest quota-cost decision in
  this spec. Worth watching closely on the first few real exhaustions rather
  than assuming the caps are right just because they're bounded.

## Edge cases & error handling

- **Review feedback is vague/non-actionable** → the revise job should say so
  explicitly in its own commit/PR comment rather than guessing, and still
  count as a consumed attempt (an unbounded "ask for clarification" loop is
  just `ai:gave-up` with extra steps).
- **Revise job itself errors** (not a REQUEST_CHANGES disagreement, an actual
  failure — e.g., can't apply any fix, typecheck breaks and can't be
  resolved) → label `needs-human`, distinct from `ai:gave-up`, so the two
  failure modes ("review keeps disagreeing" vs. "the fixer broke") aren't
  conflated in triage.
- **CI flakes during a revise cycle** → already covered by `ci.yml`'s
  existing retry allowance; no new handling needed here.
- **Two REQUEST_CHANGES verdicts in a row raise the same objection** → worth
  detecting (the revise job isn't actually addressing the feedback) and
  short-circuiting to `ai:gave-up` early rather than burning the full cap on
  a revise loop that isn't converging.
- **`workflow_dispatch` retry fires but the issue was closed/edited in the
  meantime** (a human intervened between attempts) → re-check the issue's
  state before implementing; a closed issue should cancel the retry rather
  than implement against a target that's no longer live.
- **An implement retry itself never produces a PR either, repeatedly** →
  bounded by `MAX_IMPLEMENT_ATTEMPTS` same as any other exhaustion; the
  `ai:gave-up` comment should distinguish "every attempt hit the turn limit"
  from "every attempt hit a different, unrelated error," since the former
  is a tuning problem (the issue's scope is probably too large for one
  attempt) and the latter is more likely a genuine bug worth a human's
  direct attention.

## Testing strategy

- **Skill validation**: feed the skill known-good and known-bad diffs
  (a PR with a real security issue, one with dead code left behind, one with
  a UI-only mouse-trap, one that's actually clean) and confirm the verdict
  and — critically — the *category* of objection raised matches expectations.
  Mirrors the existing "feed it known-good/known-bad diffs" testing note in
  `ai-managed-repo.md`, scoped per-category instead of generically.
- **Revise loop**: a scratch PR deliberately seeded with one fixable
  objection (revise should converge to APPROVE within 1 attempt) and one
  deliberately unfixable-without-scope-change objection (should exhaust the
  cap and land on `ai:gave-up` with a clear summary).
- **Permission boundary**: confirm the review job's run genuinely has no
  `Write`/`Edit` in its tool list even after this change — a regression here
  is a security regression, not just a bug.

## Dependencies

None new — same `anthropics/claude-code-action@v1`, same
`CLAUDE_CODE_OAUTH_TOKEN`, same GitHub App. The Skill file is plain markdown
under `.claude/skills/`.

## Migration & rollback plan

- **Deploy, in order**: (1) land the Skill file and point `ai-review.yml` at
  it — behavior change is just a richer checklist, same single-pass shape,
  verify on a scratch PR; (2) add the `revise` job, `MAX_REVISE_ATTEMPTS = 3`;
  (3) add the implement-retry loop last — it's the most invasive change
  (new trigger type, owner-gate rework, touches most of the existing job) and
  the one most worth having the other two already stable and trusted before
  layering on top.
- **Rollback**: each piece reverts independently, in reverse order. Drop the
  `workflow_dispatch` trigger and retry-dispatch logic to remove the
  implement-retry loop (back to a single implement attempt); delete the
  `revise` job to remove course-correction (`ai:gave-up` stops being applied
  again, back to `needs-human`-only); revert `ai-review.yml` to its inline
  prompt to drop the skill (git history has it). Nothing in `src/` is
  touched by any of this, at any stage.

## Open questions

- ~~Single comprehensive pass vs. parallel dimension reviewers?~~ **Decided:
  single pass.** Real evidence from tonight's dry run supported it directly —
  even the current, much simpler review prompt caught a genuine issue on
  PR #19 (the `ai:gave-up` documentation-accuracy bug) and gave a
  substantive, non-shallow review on PR #25 (layer boundary, migration
  correctness, tests, invariants, plus a legitimate non-blocking catch) in
  one pass. Revisit only if a future real run shows the single pass under-
  indexing on a category — security is the most likely candidate, given a
  generalist checklist-pass is structurally more likely to shortchange the
  one category that needs adversarial thinking rather than checklist-matching.
- ~~Visual/screenshot UI review~~ **Decided: defer.** Not because Linux
  rendering is inherently untrustworthy for this purpose, but because it's
  untrustworthy *for a Windows-only app* — a Linux-rendered screenshot would
  be standing in for a platform weft doesn't actually ship on. This stops
  being true once macOS/Linux support is real: at that point a Linux CI
  runner's render reflects a genuine target platform, not a Windows proxy,
  and screenshot-based review (in the review skill, in E2E, or both) is
  worth revisiting properly. Tracked in Todo below, not blocking this spec.
- ~~`MAX_REVISE_ATTEMPTS` value?~~ **Decided: 3.** Enough room for feedback
  that takes a round or two to fully resolve (fix A, which surfaces B),
  still bounded against a PR that fundamentally can't converge — roughly 4x
  a single review pass in quota for a PR that never converges. Not measured
  against real revise cycles yet; revisit if real runs show 3 is
  systematically too tight or too loose.
- ~~Should implement itself retry on outright failure, not just revise on a
  rejected PR?~~ **Decided: yes, build it, as its own mechanism.** See the
  dedicated Architecture section below — this is materially more complex
  than the revise loop and is called out on its own rather than folded into
  the revise design.

## Todo list

- [x] Write `.claude/skills/pr-review/SKILL.md` with the checklist above.
- [x] Point `ai-review.yml`'s review job at the skill; verified on PR #27
      (isolated skill test) that the verdict format is unchanged and the
      skill's own instructions are genuinely followed (it cited its own
      documentation-accuracy note verbatim while reviewing).
- [x] Add the `revise` job: attempt-count gate, write/edit permissions,
      prompt combining issue + latest review feedback, push to same branch.
- [x] Confirmed a push from `revise` correctly re-triggers `ai-review.yml`
      via `synchronize` (PR #29).
- [x] Implement the `ai:gave-up` label application once the attempt cap is
      hit, with a comment summarizing unresolved feedback. **Code path
      written; the actual exhaustion case (3 rejections in a row) has not
      been exercised by a real run** — PR #29 converged on the first revise
      attempt, it never got tested going all the way to giving up.
- [x] Add the distinct `needs-human` path for a `revise` job that errors
      outright (vs. one that ran but didn't converge). Written, not yet
      exercised by a real revise-job failure.
- [ ] Run the skill-validation test set (known-good/known-bad diffs per
      category) — not done; PR #27/#29's real reviews are evidence the
      skill works, not a substitute for the structured category-by-category
      validation this item describes.
- [x] Run the revise-loop test set — **partially**: one convergent case
      confirmed (PR #29, and it took three additional real bugs to get
      there: verdict posted as a plain comment instead of a review object,
      the stale-verdict guard using the wrong GraphQL field name, and a
      stale `needs-human` label not clearing on later success — all fixed).
      The cap-exhaustion case is still untested.
- [x] Re-verified the review job's tool permissions still exclude Write/Edit
      after wiring the skill (unchanged: `Bash,Read,Grep,Glob`).
- [x] Add `workflow_dispatch` to `ai-implement.yml` with `issue_number`,
      `attempt`, `previous_run_id` inputs (renamed from `previous_failure_context`
      in the original design -- passing the run ID and letting the retry
      inspect the log itself via `gh run view` turned out simpler and more
      robust than trying to pre-summarize the failure); a "Resolve issue +
      attempt context" step makes title/body available under either trigger
      shape via `gh issue view`, uniformly.
- [x] Update the owner gate to hold under both trigger shapes. **Different
      from the original plan**: rather than a `github.actor` comparison
      (which would incorrectly reject a retry dispatched via the App token,
      since the actor would be the App's bot identity, not the human owner),
      `workflow_dispatch` relies on GitHub's own native restriction to
      write-access collaborators.
- [x] Wire the "Label outcome" step to dispatch a retry via `gh workflow run`
      when outright-failed with no PR and `attempt < MAX_IMPLEMENT_ATTEMPTS`;
      exhaustion labels `ai:gave-up`, not `needs-human`. Required adding
      Actions: Read and write to the App's permissions (not originally
      scoped) — `gh workflow run` needs it and the App never had it.
- [x] Tested the `workflow_dispatch` trigger itself directly (issue #30,
      manually dispatched at attempt 2): the trigger, owner-gate, and
      resolve-step all confirmed working, and it surfaced one more real bug
      along the way — `gh pr list --jq` silently doesn't support `--arg` at
      all (confirmed via `--help`), which had been broken since the
      PR-detection fix was first written. Every earlier "confirmed working"
      claim about that exact check was verified by running `gh pr list`
      manually in-session, never by observing the workflow's own execution
      succeed — a real gap in verification rigor, corrected here by piping
      into a real `jq` instead of relying on `gh`'s `--jq` wrapper.
      **Not yet tested**: an actual implement failure triggering an
      *automatic* retry dispatch (this test dispatched attempt 2 manually
      to isolate the trigger mechanism, rather than waiting for a genuine
      attempt-1 failure), and the `MAX_IMPLEMENT_ATTEMPTS` exhaustion path.
- [ ] Move to `documents/completed/` once the two remaining untested paths
      above (revise-cap exhaustion, implement-retry cap exhaustion, and a
      genuine automatic — not manually dispatched — implement retry) have
      each been exercised by a real run.
- [ ] **Future, blocked on macOS/Linux support existing:** revisit
      screenshot-based visual UI review (review skill, E2E, or both) once
      weft actually ships on a platform a Linux CI runner can legitimately
      stand in for — not before, since a Linux render of a Windows-only app
      isn't a trustworthy signal either way.
