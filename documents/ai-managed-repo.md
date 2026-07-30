# AI-Managed Repository — Issue-Driven Autonomous Development

## Feature specification

Turn weft into a **fully AI-managed repository**. The human's *only* interface is
opening a GitHub issue. Everything else — reading the issue, branching,
implementing per `CLAUDE.md`, running the test/typecheck/E2E gate, opening a PR,
self-reviewing the diff, and merging — is done autonomously by a **local AI
model** driven by the [OpenCode](https://opencode.ai) agent, running on a
**self-hosted GitHub Actions runner** on the maintainer's own machine.

The existing CI (`.github/workflows/ci.yml`: typecheck + unit on Windows/Ubuntu,
Electron E2E on Windows) is the **arbiter of correctness** — it is model-agnostic
and unchanged. Branch protection guarantees nothing reaches `main` unless CI is
green, so a weak model can waste compute but can never merge broken code.

## Scope & out of scope

**In scope**
- Issue-open triggers an autonomous implement → PR loop.
- Local-model harness (OpenCode) invoked headless on a self-hosted runner.
- A self-review pass (second model pass over the diff) that must approve before merge.
- Auto-merge (`gh pr merge --auto --squash`) armed only after self-review + green CI.
- Branch protection + repo settings that make the loop safe.
- An `AGENTS.md` mirroring the `CLAUDE.md` conventions for OpenCode.
- Setup docs: self-hosted runner registration, model runtime install, secrets.

**Out of scope (initially)**
- Multi-issue planning / dependency ordering (each issue handled independently).
- Autonomous changes to CI, workflows, or branch-protection settings by the bot
  (the GitHub App/token deliberately **cannot** modify `.github/workflows/**`).
- Cross-repo work.
- Replacing the `/dmail` "Steiner" loop — this is a separate, issue-driven path.
- Human-quality guarantees: CI gates *correctness*, not *progress* or taste.

## User stories

- As the maintainer, I want to **open an issue and walk away**, so that a fix or
  feature lands on `main` without me touching the code.
- As the maintainer, I want **CI to be the merge gate**, so that a bad autonomous
  change can never reach `main` even fully unattended.
- As the maintainer, I want a **self-review step**, so obviously-wrong or unsafe
  diffs are caught before auto-merge even when CI is green.
- As the maintainer, I want the **whole loop to run on my own hardware/model**,
  so no code or tokens leave my machine.

## Acceptance criteria

- [ ] Opening any issue triggers a workflow on the self-hosted runner within ~1 min.
- [ ] The agent creates a branch `ai/issue-<n>-<slug>`, implements a change, and
      opens a PR whose body contains `Closes #<n>`.
- [ ] The agent runs `pnpm typecheck` and `pnpm test:cov` locally and does not
      open a PR if they fail hard (it iterates up to a turn/retry cap first).
- [ ] The PR triggers the existing CI (typecheck + unit + E2E) — status checks
      run on the bot's commits (requires a GitHub App token, see Security).
- [ ] A self-review job posts an approval or a "changes requested" review; merge
      is armed only on approval.
- [ ] `main` is branch-protected: required checks = CI jobs; direct pushes blocked;
      human review **not** required (so the bot isn't blocked); stale branches auto-delete.
- [ ] On green CI + self-review approval, the PR auto-merges (squash) and the issue closes.
- [ ] On red CI, the agent gets N retry attempts; after N it labels the PR
      `needs-human` and stops (no infinite loop / compute burn).
- [ ] The bot cannot modify `.github/workflows/**` or branch-protection settings.
- [ ] Issue-body prompt-injection cannot exfiltrate secrets or run out-of-repo commands.

## Architecture & technical design

```
Human opens issue
      │  on: issues:[opened]
      ▼
Self-hosted runner (maintainer's Windows box)
  ├─ checkout, pnpm install --frozen-lockfile, pnpm rebuild:native
  ├─ OpenCode headless run, model = local (Ollama OpenAI-compatible endpoint)
  │     reads AGENTS.md; implements; runs pnpm typecheck / test:cov locally
  ├─ git branch ai/issue-N-slug, commit, push
  └─ gh pr create --body "Closes #N"
      │
      ▼
GitHub-hosted CI (ci.yml, unchanged) runs on the PR
      │
      ├─ self-review job: OpenCode reviews the diff → approve / request-changes
      │
green + approved ──► gh pr merge --auto --squash ──► issue closes
red ──► agent retries (≤N) ──► else label needs-human, stop
```

**Components**
- **Harness — OpenCode.** Open-source, provider-agnostic, local-model capable
  (OpenAI-compatible endpoints incl. Ollama), headless `run` mode, reads
  `AGENTS.md`. Chosen over Claude Code (Anthropic-model-first; local needs a
  LiteLLM Anthropic-compat proxy) and over Aider/OpenHands for provider-agnostic
  simplicity. Fallback: if OpenCode's local-model tool-calling proves too weak,
  swap the harness without changing the surrounding plumbing.
- **Model runtime — Ollama** serving **Qwen2.5-Coder-32B-Instruct** (4-bit,
  ~20–24 GB VRAM). Endpoint `http://localhost:11434/v1`. vLLM is the upgrade path.
- **Host — self-hosted GitHub Actions runner** on the maintainer's Windows
  machine (also where node-pty rebuilds and E2E can run). Registered as a repo
  runner with a restricted label (e.g. `self-hosted, weft-local`).
- **Identity — a dedicated GitHub App** (not the default `GITHUB_TOKEN`) so that
  (a) PRs the bot opens **do** trigger CI, and (b) permissions are scoped
  (Contents/Issues/PRs RW; **no** Workflows write).
- **Gate — existing `ci.yml`**, unchanged, promoted to required status checks.
- **Two new workflows** — `ai-implement.yml` (issue → PR) and `ai-review.yml`
  (PR → self-review → arm auto-merge).

**Repo-specific integration**
- `AGENTS.md` restates the `CLAUDE.md` layer-boundary rules, the 95/90 coverage
  gate, pnpm, and the invariants so the local model has them in-context.
- The implement job must `pnpm rebuild:native` before E2E-relevant work (Windows
  node-pty), matching `ci.yml`.

## API contract / Database changes

N/A — no application API or schema changes. All new surface is GitHub
Actions workflows, repo settings, and an `AGENTS.md`.

## UI/UX considerations

- **The issue is the UI.** Existing issue templates (`bug_report.yml`,
  `feature_request.yml`) stay; a good template = a good prompt. Consider adding a
  short "Acceptance criteria" field to sharpen autonomous runs.
- **Labels as state:** `ai:working`, `ai:pr-open`, `needs-human`, `ai:gave-up`
  give at-a-glance status without a custom UI.
- **Empty/failure states:** a `needs-human` label + a bot comment explaining why
  (CI log link, last error) whenever the loop stops without merging.

## Security considerations

- **Prompt injection from issue bodies is the primary threat.** Issue text is
  untrusted input fed to a model with shell/git access. Mitigations: run in the
  isolated runner workspace only; restrict the App token to this repo; forbid the
  agent from reading secrets/env or making network calls beyond git/gh; never
  echo secrets into logs; keep the model's tool allowlist tight (pnpm, git, gh,
  file ops within the workspace).
- **Bot cannot self-modify its guardrails:** App permissions exclude Workflows
  write; branch protection + a CODEOWNERS on `.github/**` block edits to CI and
  workflow files.
- **Self-hosted runner risk:** self-hosted runners on a private repo are the
  supported pattern; **do not** make the repo public with an always-on
  self-hosted runner (fork PRs could execute code on your machine). Keep the repo
  private, or gate the trigger to issues opened by the owner only.
- **Secrets:** `APP_ID` + `APP_PRIVATE_KEY` in repo secrets; the model runs
  locally so no model-provider key is needed. `gh` uses the App token, not a PAT.
- **Merge gate:** required status checks + self-review approval are the only paths
  to `main`; direct pushes disabled.
- **Self-review is not an independent reviewer.** A model reviewing its own diff
  has a strong self-approval bias, so the self-review pass is a *cheap filter*,
  not a real gate — **CI remains the primary gate.** Mitigations to consider:
  run the review with a different (or larger) model than the implementer, use a
  fresh context with no memory of the implementation, and/or keep auto-merge
  gated on CI even if self-review is skipped.
- **Commit signing:** the App/runner commits are unsigned by default. If signed
  commits are required on `main`, enable GitHub API commit signing (or provide an
  SSH signing key on the runner) — otherwise branch protection's "require signed
  commits" would block every autonomous merge.

## Performance considerations

- **Local model throughput** is the bottleneck. A 32B model at 4-bit on one
  24 GB GPU does agentic loops slowly (minutes–tens of minutes per issue). This is
  acceptable for async issue work; set generous job timeouts.
- **CI cost:** Electron E2E on Windows is the slow leg (~minutes). Runs once per
  PR update, so cap retries (N≈2–3) to bound total CI time.
- **Retry bound:** N failed CI iterations → stop and label `needs-human`, to
  prevent unbounded compute/CI burn on issues the model can't solve.
- **Runner concurrency:** a self-hosted runner executes **one job at a time** by
  default, so multiple issues opened at once **queue** rather than run in
  parallel. Acceptable for async issue work; register additional runners (or a
  runner group) only if throughput becomes a problem. Set explicit job
  `timeout-minutes` so a stuck local-model run can't hold the queue indefinitely.
- **Context window:** local models often have a smaller usable context than
  hosted frontier models. On a repo this size a broad change (many files / large
  diff) can exceed it, degrading quality or truncating. Prefer narrowly-scoped
  issues; rely on OpenCode's file-targeting rather than whole-repo dumps; treat
  "too large for one pass" as a `needs-human` case.

## Edge cases & error handling

- **Model can't converge** → after N tries, `needs-human`, stop.
- **Merge conflict with main** (concurrent issues) → agent rebases once; if it
  can't, `needs-human`.
- **Flaky E2E** → allow one automatic re-run before counting a CI failure.
- **Vague/underspecified issue** → agent posts a clarifying comment and labels
  `needs-human` rather than guessing (guards against wasted runs — matters since
  *every* opened issue triggers a run).
- **Runner offline** → issue sits until the runner returns; document a health note.
- **Two issues touch the same files** → independent branches; second PR resolves
  conflicts at merge time or escalates.

## Testing strategy

- **The app's own gate is unchanged** — `pnpm test:cov` (95/90) + `pnpm typecheck`
  + `pnpm test:e2e` remain the correctness bar for any autonomous change.
- **Workflow testing:** validate YAML with `act` locally where possible; do a
  dry-run on a throwaway issue in a scratch branch before enabling auto-merge.
- **Self-review prompt:** unit-style eval by feeding it known-good and known-bad
  diffs and checking approve/request-changes verdicts.
- **Staged rollout:** first run with auto-merge OFF (human clicks merge) to
  observe quality, then enable auto-merge once trustworthy.

## Dependencies

- **OpenCode** (agent harness) installed on the runner.
- **Ollama** (or vLLM) + a coding model (Qwen2.5-Coder-32B-Instruct suggested).
- **A self-hosted GitHub Actions runner** registered to the repo.
- **A dedicated GitHub App** (App ID + private key) with Contents/Issues/PRs RW.
- **`gh` CLI** on the runner (already present locally).
- Hardware: a GPU with ≥24 GB VRAM for the 32B model (or accept a smaller/weaker
  model, or the hybrid-escalation option).

## Migration & rollback plan

- **Deploy:** land `AGENTS.md` + the two workflows with auto-merge disabled →
  enable branch protection → register runner + model → test on a scratch issue →
  flip auto-merge on.
- **Rollback:** disable/delete `ai-implement.yml` + `ai-review.yml` (or turn the
  runner off). Branch protection and CI stay; the repo reverts to manual PRs with
  zero code changes. Fully reversible — nothing in `src/` is touched.

## Open questions

- **Model & hardware:** what GPU/VRAM is available? Determines 32B vs 14B vs the
  hybrid (local-first, hosted-escalation) path. (Maintainer to confirm.)
- **OpenCode exact invocation:** confirm the headless `run` flags, config file
  shape, and local-provider config against current OpenCode docs at wiring time.
- **Trigger throttle:** truly *every* issue, or exclude issues labeled `discussion`
  / opened by non-owners? (Recommended: owner-only while repo is private.)
- **Hybrid escalation:** wire the hosted-model fallback now or add later once the
  local-only success rate is known?
- **Review model:** run self-review with the *same* local model (cheapest, weak),
  a *different/larger* local model (better, more VRAM), or lean entirely on CI and
  treat self-review as advisory? (See self-approval-bias note in Security.)
- **Signed commits on `main`:** required or not? Decides whether commit signing
  must be configured on the runner/App before enabling branch protection.
- **Keeping `AGENTS.md` and `CLAUDE.md` in sync:** duplicate, symlink, or generate
  one from the other? They must not drift.

## Todo list

- [ ] Confirm GPU/VRAM → finalize model choice (32B / 14B / hybrid).
- [ ] Create a dedicated GitHub App; store `APP_ID` + `APP_PRIVATE_KEY` secrets.
- [ ] Register the self-hosted runner on the Windows box (label `weft-local`).
- [ ] Install OpenCode + Ollama + the chosen model on the runner; verify endpoint.
- [ ] Write `AGENTS.md` mirroring `CLAUDE.md` conventions.
- [ ] Write `.github/workflows/ai-implement.yml` (issue → branch → PR).
- [ ] Write `.github/workflows/ai-review.yml` (PR → self-review → arm auto-merge).
- [ ] Add `CODEOWNERS` protecting `.github/**`.
- [ ] Configure branch protection on `main` (required checks, no direct push,
      review not required, auto-delete branches); decide signed-commits policy.
- [ ] Set explicit `timeout-minutes` on both AI jobs.
- [ ] Decide the review-model strategy (same / different-larger / CI-only).
- [ ] Add state labels (`ai:working`, `ai:pr-open`, `needs-human`, `ai:gave-up`).
- [ ] Dry-run on a scratch issue with auto-merge OFF; observe quality.
- [ ] Enable auto-merge; monitor first real issues; tune retry cap N.
- [ ] Move this doc to `documents/completed/` once the loop is live and trusted.
```
