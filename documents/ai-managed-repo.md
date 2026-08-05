# AI-Managed Repository — Issue-Driven Autonomous Development

> **Revision (2026-08-05).** This doc originally specified a local model
> (Qwen2.5-Coder-32B on Ollama) driven by OpenCode on a self-hosted runner,
> chosen to avoid per-token cost. That design is superseded: the official
> `anthropics/claude-code-action@v1` **is Claude Code**, it authenticates from a
> Claude subscription via `CLAUDE_CODE_OAUTH_TOKEN`, and it reads the existing
> `CLAUDE.md` directly. That removes the model, the GPU, the self-hosted runner,
> and `AGENTS.md` from the design at no cost. The superseded local-model plan is
> preserved in git history at `1d10b73`.

## Feature specification

Turn weft into a **fully AI-managed repository**. The maintainer's *only*
interface is opening a GitHub issue. Everything else — reading the issue,
branching, implementing per `CLAUDE.md`, running the test/typecheck gate, opening
a PR, self-reviewing the diff, and merging — is done autonomously by **Claude Code
running headless** in GitHub Actions via `anthropics/claude-code-action@v1`,
authenticated from the maintainer's **existing Claude subscription — no API key**.

The existing CI (`.github/workflows/ci.yml`: typecheck + unit on Windows/Ubuntu,
Electron E2E on `windows-latest`) is the **arbiter of correctness** — unchanged.
Branch protection guarantees nothing reaches `main` unless CI is green, so a bad
autonomous run can waste quota but can never merge broken code.

## Scope & out of scope

**In scope**
- Issue-open (owner-authored) triggers an autonomous implement → PR loop.
- Claude Code headless via `claude-code-action@v1` on GitHub-hosted runners.
- Subscription authentication via `CLAUDE_CODE_OAUTH_TOKEN`; **no `ANTHROPIC_API_KEY`**.
- A self-review pass over the diff that must approve before merge.
- Auto-merge (`gh pr merge --auto --squash`) armed only after self-review + green CI.
- Branch protection + repo settings that make the loop safe.
- Quota discipline: turn caps, timeouts, and a retry bound, since the loop spends
  the same weekly limit the maintainer uses interactively.

**Out of scope**
- Multi-issue planning / dependency ordering (each issue handled independently).
- Autonomous changes to CI, workflows, or branch-protection settings by the bot.
- Cross-repo work.
- Replacing the `/dmail` "Steiner" loop — that stays a separate, human-initiated path.
- Non-owner triggers. Issues opened by anyone other than the repo owner do **not**
  start a run (see Security).
- Human-quality guarantees: CI gates *correctness*, not *progress* or taste.

## User stories

- As the maintainer, I want to **open an issue and walk away**, so that a fix or
  feature lands on `main` without me touching the code.
- As the maintainer, I want **CI to be the merge gate**, so that a bad autonomous
  change can never reach `main` even fully unattended.
- As the maintainer, I want a **self-review step**, so obviously-wrong or unsafe
  diffs are caught before auto-merge even when CI is green.
- As the maintainer, I want the loop to **run on my existing subscription**, so it
  costs nothing beyond what I already pay.
- As the maintainer, I want the loop to **never exhaust my own quota**, so my
  interactive work is not blocked by my automation.

## Acceptance criteria

- [ ] Opening an issue **as the repo owner** triggers a workflow within ~1 min;
      an issue opened by anyone else does not.
- [ ] The run authenticates with `CLAUDE_CODE_OAUTH_TOKEN`; no `ANTHROPIC_API_KEY`
      secret exists in the repo.
- [ ] The agent creates a branch `ai/issue-<n>-<slug>`, implements a change, and
      opens a PR whose body contains `Closes #<n>`.
- [ ] The agent runs `pnpm typecheck` and `pnpm test:cov` before opening the PR.
- [ ] The PR triggers the existing CI (typecheck + unit + E2E) — status checks
      run on the bot's commits (requires a GitHub App token, see Security).
- [ ] A self-review job posts a `VERDICT: APPROVE` / `VERDICT: REQUEST_CHANGES`
      comment; merge is armed only on approve. **Not a formal GitHub approval** —
      the App that opened the PR cannot approve its own PR, so the verdict is
      carried in a comment review and read back by the workflow.
- [ ] `main` is branch-protected: required checks = CI jobs; direct pushes blocked;
      human review **not** required; stale branches auto-delete.
- [ ] On green CI + approval, the PR auto-merges (squash) and the issue closes.
- [ ] On red CI, the agent gets N retries; after N it labels `needs-human` and stops.
- [ ] Both jobs carry `timeout-minutes` and `--max-turns`, so a runaway run can't
      drain the weekly quota.
- [ ] The bot cannot modify `.github/workflows/**` or branch-protection settings.
- [ ] Issue-body prompt-injection cannot exfiltrate secrets or reach outside the repo.

## Architecture & technical design

```
Owner opens issue
      │  on: issues:[opened]  +  if: author == repository_owner
      ▼
GitHub-hosted runner (ubuntu-latest)
  └─ anthropics/claude-code-action@v1
       auth: CLAUDE_CODE_OAUTH_TOKEN (subscription)
       reads CLAUDE.md natively; implements; runs pnpm typecheck / test:cov
       branches, commits, opens PR "Closes #N"
      │
      ▼
ci.yml (unchanged) runs on the PR
      │
      ├─ ai-review.yml: Claude Code reviews the diff → approve / request-changes
      │
green + approved ──► gh pr merge --auto --squash ──► issue closes
red ──► retry (≤N) ──► else label needs-human, stop
```

**Components**
- **Harness — Claude Code itself**, via `anthropics/claude-code-action@v1`. Same
  binary as the CLI, same tool loop, and it reads the repo's `CLAUDE.md` with no
  translation layer. `claude_args` passes through any CLI flag (`--max-turns`,
  `--model`, `--allowedTools`).
- **Auth — `CLAUDE_CODE_OAUTH_TOKEN`**, generated by `claude setup-token` and
  stored as a repo secret. The action accepts it in place of `anthropic_api_key`.
  No model provider account, no metered billing.
- **Host — GitHub-hosted runners.** `ci.yml` already runs `windows-latest` and an
  OS matrix, so no self-hosted runner is needed. This removes the fork-PR
  code-execution risk and the one-job-at-a-time queueing limit entirely.
  **Both AI jobs specifically run on `ubuntu-latest`, not Windows** —
  `anthropics/claude-code-action`'s installer hard-refuses Windows runners
  ("Windows is not supported by this script"), confirmed by an actual
  `startup_failure`→`failure` dry run. This is fine: neither job needs the
  Windows-only toolchain (native node-pty, E2E) — they only run
  `pnpm typecheck`/`pnpm test:cov`, which `CLAUDE.md`'s own coverage gate
  already treats as OS-portable (native/IO adapters are excluded from the
  unit gate and covered by E2E instead). `ci.yml` itself is untouched and
  still runs its Windows E2E leg.
- **Identity — a dedicated GitHub App** (not the default `GITHUB_TOKEN`) so that
  (a) PRs the bot opens **do** trigger CI, and (b) permissions are scoped
  (Contents/Issues/PRs RW; **no** Workflows write).
- **Gate — existing `ci.yml`**, unchanged, promoted to required status checks.
- **Two new workflows** — `ai-implement.yml` (issue → PR) and `ai-review.yml`
  (PR → self-review → arm auto-merge).

**Repo-specific integration**
- **No `AGENTS.md`.** `CLAUDE.md` is read directly, so the layer-boundary rules,
  the 95/90 coverage gate, pnpm, and the invariants are already in context. This
  also removes the "two files must not drift" problem from the original design.
- The implement job does **not** run `pnpm rebuild:native` or E2E — those are
  Windows/native-only and out of scope for what this job checks (see Host,
  above). It mirrors `ci.yml`'s `ubuntu-latest` typecheck+unit leg only.

**Sketch — `ai-implement.yml`**

```yaml
on:
  issues:
    types: [opened]
jobs:
  implement:
    if: github.event.issue.user.login == github.repository_owner
    runs-on: ubuntu-latest  # claude-code-action's installer doesn't support Windows
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/create-github-app-token@v2
        id: app-token
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
      - uses: anthropics/claude-code-action@v1
        with:
          github_token: ${{ steps.app-token.outputs.token }}
          claude_args: "--max-turns 30"
          prompt: |
            Implement issue #${{ github.event.issue.number }}.
            Follow CLAUDE.md. Run pnpm typecheck and pnpm test:cov before
            opening a PR whose body contains "Closes #${{ github.event.issue.number }}".
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

## API contract / Database changes

N/A — no application API or schema changes. All new surface is GitHub Actions
workflows and repo settings.

## UI/UX considerations

- **The issue is the UI.** Existing issue templates (`bug_report.yml`,
  `feature_request.yml`) stay; a good template = a good prompt. Consider adding an
  "Acceptance criteria" field to sharpen autonomous runs.
- **Labels as state:** `ai:working`, `ai:pr-open`, `needs-human`, `ai:gave-up`.
- **Empty/failure states:** a `needs-human` label + a bot comment explaining why
  (CI log link, last error) whenever the loop stops without merging.

## Security considerations

- **The owner-only gate is load-bearing for two reasons.** It stops a third party
  from triggering a run at all, and it keeps a subscription-derived credential in
  a repo secret from being spendable by anyone but the account holder. Keep the
  `if:` condition on every workflow that invokes Claude Code, and keep the repo
  private.
- **Subscription credential in a repo secret.** `CLAUDE_CODE_OAUTH_TOKEN` is a
  personal credential, unlike a scoped API key: it can't be budget-capped or
  rotated per-service. Anyone with Actions write on the repo can effectively spend
  it. **Revisit this design the moment a collaborator is added** — that is the
  point at which a metered API key becomes the correct answer.
- **Prompt injection from issue bodies is the primary code-level threat.** Issue
  text is untrusted input fed to an agent with shell/git access. Mitigations: the
  owner-only gate (the author is you), the isolated runner workspace, a scoped App
  token, a tight `--allowedTools` list, and never echoing secrets into logs.
- **Bot cannot self-modify its guardrails:** App permissions exclude Workflows
  write; a `CODEOWNERS` on `.github/**` blocks edits to CI and workflow files.
- **No self-hosted runner.** The original design's largest risk — fork PRs
  executing code on the maintainer's machine — does not exist here.
- **Merge gate:** required status checks + self-review approval are the only paths
  to `main`; direct pushes disabled.
- **Self-review is not an independent reviewer.** A model reviewing its own diff
  has a self-approval bias, so treat the self-review pass as a *cheap filter*, not
  a real gate — **CI remains the primary gate.** Run the review in a fresh context
  with no memory of the implementation.
- **Commit signing:** App/runner commits are unsigned by default. If signed commits
  are required on `main`, configure signing before enabling branch protection —
  otherwise "require signed commits" blocks every autonomous merge.

## Performance & quota considerations

The bottleneck is no longer model throughput — it is **the maintainer's weekly
subscription limit, which the bot shares.** This is the central operational
constraint of the subscription-only design.

- **The loop competes with interactive work.** A few retry cycles on a stubborn
  issue can rate-limit the maintainer out of their own editor. Cap aggressively:
  `--max-turns`, `timeout-minutes`, and a low retry bound.
- **Retry bound:** N failed CI iterations (N≈2) → stop and label `needs-human`.
- **CI cost:** Electron E2E on Windows is the slow leg (~minutes), once per PR
  update, which bounds total CI time via the same retry cap.
- **Concurrency:** GitHub-hosted runners parallelize, so multiple issues no longer
  queue behind one another — but parallel runs multiply quota burn. Consider a
  `concurrency` group to serialize deliberately.
- **Context window** is a frontier-model window, so the original design's
  "local models truncate on large diffs" concern no longer applies.

## Edge cases & error handling

- **Agent can't converge** → after N tries, `needs-human`, stop.
- **Quota exhausted mid-run** → the run fails; label `needs-human` and surface the
  reason in the bot comment so it isn't mistaken for a code failure.
- **Merge conflict with main** (concurrent issues) → agent rebases once; if it
  can't, `needs-human`.
- **Flaky E2E** → allow one automatic re-run before counting a CI failure.
- **Vague/underspecified issue** → agent posts a clarifying comment and labels
  `needs-human` rather than guessing.
- **Non-owner issue** → no run, by design. No comment, no quota spent.
- **Two issues touch the same files** → independent branches; second PR resolves
  conflicts at merge time or escalates.

## Testing strategy

- **The app's own gate is unchanged** — `pnpm test:cov` (95/90) + `pnpm typecheck`
  + `pnpm test:e2e` remain the correctness bar for any autonomous change.
- **Workflow testing:** dry-run on a throwaway issue in a scratch branch before
  enabling auto-merge.
- **Gate testing:** open an issue from a non-owner account and confirm no run starts.
- **Self-review prompt:** feed it known-good and known-bad diffs, check verdicts.
- **Staged rollout:** first run with auto-merge OFF (human clicks merge) to observe
  quality, then enable auto-merge once trustworthy.

## Dependencies

- **A Claude subscription** and `claude setup-token` to mint `CLAUDE_CODE_OAUTH_TOKEN`.
- **A dedicated GitHub App** (App ID + private key) with Contents/Issues/PRs RW.
- `anthropics/claude-code-action@v1`.

That is the entire list. No OpenCode, no Ollama, no model download, no GPU, no
self-hosted runner, no `AGENTS.md`, no API key.

## Migration & rollback plan

- **Deploy:** mint the OAuth token → create the GitHub App → land the two workflows
  with auto-merge disabled → enable branch protection → test on a scratch issue →
  flip auto-merge on.
- **Rollback:** disable/delete `ai-implement.yml` + `ai-review.yml`. Branch
  protection and CI stay; the repo reverts to manual PRs with zero code changes.
  Fully reversible — nothing in `src/` is touched.

## Open questions

- **Terms check:** using a subscription-derived `CLAUDE_CODE_OAUTH_TOKEN` for
  workflow-triggered runs is not clearly documented either way. The action accepts
  it and the owner-only gate keeps it a single-user credential, but worth a
  five-minute confirmation with Anthropic before relying on it long-term.
- **Quota headroom:** how much weekly limit is left over after normal interactive
  use? Decides the retry cap N and whether to serialize runs.
- **Review model:** same model as the implementer (cheapest, self-approval bias) or
  a different one? See the bias note in Security.
- **Signed commits on `main`:** required or not? Decides whether signing must be
  configured before branch protection.
- **Trigger breadth:** owner-opened issues only, or also `@claude` mentions on
  existing issues/PRs? The latter is more controllable but less hands-off.

## Todo list

- [ ] Run `claude setup-token`; store `CLAUDE_CODE_OAUTH_TOKEN` as a repo secret.
- [ ] Create a dedicated GitHub App; store `APP_ID` + `APP_PRIVATE_KEY` secrets.
- [ ] Write `.github/workflows/ai-implement.yml` (issue → branch → PR), owner-gated.
- [ ] Write `.github/workflows/ai-review.yml` (PR → self-review → arm auto-merge).
- [ ] Add `CODEOWNERS` protecting `.github/**`.
- [ ] Configure branch protection on `main` (required checks, no direct push,
      review not required, auto-delete branches); decide signed-commits policy.
- [ ] Set `timeout-minutes` and `--max-turns` on both AI jobs.
- [ ] Add state labels (`ai:working`, `ai:pr-open`, `needs-human`, `ai:gave-up`).
- [ ] Verify the owner-only gate with a non-owner test issue.
- [ ] Dry-run on a scratch issue with auto-merge OFF; observe quality and quota burn.
- [ ] Enable auto-merge; monitor first real issues; tune retry cap N.
- [ ] Move this doc to `documents/completed/` once the loop is live and trusted.
