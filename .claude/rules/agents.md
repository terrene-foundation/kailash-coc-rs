---
priority: 0
scope: baseline
---

# Agent Orchestration Rules

See `.claude/guides/rule-extracts/agents.md` for full evidence, extended examples, post-mortems, recovery-protocol commands, the gate-review table, and CLI-syntax variants.

<!-- slot:neutral-body -->

## Specialist Delegation (MUST)

When working with Kailash frameworks, MUST consult the relevant specialist (**dataflow** / **nexus** / **kaizen** / **mcp** / **mcp-platform** / **pact** / **ml** / **align**-specialist). The work-domain → specialist binding is `rules/framework-first.md`'s domain table.

**Why:** Specialists encode hard-won patterns generalist agents miss, preventing subtle API misuse.

## Specs Context in Delegation (MUST)

Every specialist delegation prompt MUST include relevant spec file content from `specs/` (read `specs/_index.md`, select, include inline). Full protocol: `rules/specs-authority.md` MUST Rule 7.

**Why:** Specialists without domain context produce technically correct but intent-misaligned output (e.g. schemas missing tenant_id).

## Analysis Chain (Complex Features)

1. **analyst** → Identify failure points
2. **analyst** → Break down requirements
3. **`decide-framework` skill** → Choose approach
4. Then appropriate specialist

## Parallel Execution

Launch independent operations in parallel via the CLI's delegation primitive, wait for all, aggregate. MUST NOT run sequentially when parallel is possible — the always-on form of the § Triad clause below (under time-pressure framings, parallelization IS the throughput response — `rules/time-pressure-discipline.md`).

### MUST: The Default Execution Mode Is The Triad — Parallelize + /autonomize + /redteam-to-convergence

**The default execution mode for every actionable input is the TRIAD, each DEFAULT-ON** (not only under `/autonomize`, not serial/inline): (1) **parallelize** wherever the input has **≥2 independent sub-parts OR a multi-stage shape**; (2) **/autonomize** — execute autonomously under the permission envelope; (3) **/redteam-to-convergence** — adversarially verify every substantive change to 2 consecutive clean rounds before "done". Drops to serial/inline ONLY for a genuinely-atomic single-item task OR a factual/confirmation/recommendation reply. Executing a decomposable input inline-serially, or idling while independent work is dispatchable, is BLOCKED. The triad FILLS the default posture, NEVER overrides a gate. **Bounding gates, DO/DO-NOT, BLOCKED corpus, Why: `skills/30-claude-code-patterns/parallel-dispatch-default.md`; CLI dispatch syntax → the `examples` slot.**

### MUST: Parallel Brief-Claim Verification When Issue Count ≥ 3

When `/analyze` runs against a brief covering ≥ 3 distinct issues, the orchestrator MUST launch parallel deep-dive verification agents — one per claim cluster — to independently re-grep / re-read every factual claim; inaccuracies recorded in the workspace journal AND the plan's "Brief corrections" section AS THE GATE before `/todos`. Single-agent analysis on a ≥3-issue brief is BLOCKED. BLOCKED corpus + Why: `skills/30-claude-code-patterns/parallel-dispatch-default.md` § 2. (Example 1 = dispatch syntax.)

## Quality Gates (Gate-Level Review — Recommended for downstream)

Reviews happen at COC phase boundaries, not per-edit. Skip at your discretion — reviews are recommended for downstream projects, not required. Review gates (RECOMMENDED for downstream projects — you choose your own workflow) apply at `/implement` and `/release`; reviewer + security-reviewer (and gold-standards-validator at `/release`) run as parallel background agents. RECOMMENDED gates: `/analyze`, `/todos`, `/redteam`, `/codify`, post-merge. Full gate table: guide.

**Why:** Skipped gate reviews let gaps propagate downstream where they are far more expensive to fix. (Example 2 = background-dispatch pattern.)

**Watch for these rationalizations when skipping review gates** (RECOMMENDED for downstream projects — skipping is your workflow choice, but often signals skipping prematurely): full corpus in guide § "Quality Gates — BLOCKED responses".

### MUST: Reviewer Prompts Include Mechanical AST/Grep Sweep

Every gate-level reviewer prompt MUST include explicit mechanical sweeps that verify ABSOLUTE state (not only the diff) — LLM-judgment review catches what's wrong with new code; sweeps catch what's missing from OLD code the spec also touched. (Example 3 = mechanical-sweep prompt.)

**BLOCKED rationalizations:** guide § "Reviewer Prompts … — BLOCKED rationalizations".

**Why:** Reviewers are constrained by the diff; the `orphan-detection.md` §1 failure mode is invisible at diff-level. A 4-second `grep -c` catches what LLM judgment misses.

### MUST: Holistic Post-Multi-Wave Redteam Before Plan Close

A plan shipped across ≥3 sharded waves MUST run ONE holistic redteam round across ALL merged shards on main — ≥3 parallel reviewers (reviewer + security-reviewer + closure-parity verifier) scoped to the union of merged PRs, not the latest shard's diff — before the plan is declared converged.

**Why:** Per-shard redteams see only their own diff; cross-shard invariant breaks are invisible to each. Evidence + BLOCKED corpus + wiring: guide.

### MUST: Redteam Reviewer Dispatch — Errored/Empty Is Zero Evidence, Never A Clean Round

A `/redteam` round dispatches reviewers in PARALLEL, and a throttled fan-out returns errored/empty — which reads as "0 findings". **(1) EVIDENCE GATE** — every dispatched reviewer MUST return a ran/evidence signal; an errored/empty/timed-out return is ZERO evidence, MUST be re-run, and MUST NOT count clean. Convergence is claimable ONLY when EVERY agent genuinely ran. **(2) CONCURRENCY BACK-OFF** — on a throttle signal, reduce concurrency and re-run the throttled reviewers. DO/DO-NOT + BLOCKED corpus + Wiring + Why: `skills/30-claude-code-patterns/redteam-dispatch-evidence-gate.md`.

### MUST: A Dispatched Agent's Result Is Not Received Until It Is DELIVERED

An agent that SUCCEEDS and returns nothing is the same zero evidence as one that errors (§ Redteam Reviewer Dispatch), and is MORE dangerous because **every surface reports success**. **(1) SPAWN CONTRACT** — when the orchestrator needs the result back it MUST spawn WITHOUT a `name`: a named agent is a teammate carrying NO `toolUseId`, so no tool call awaits it and its final message has no return path (`run_in_background: false` does NOT override this; `name` also shadows `subagent_type`). Naming is permitted ONLY when the prompt instructs reporting via `SendMessage({to: "main"})`; pairing a `name` with "your final message IS the return value" is BLOCKED. **(2) DELIVERY GATE** — a lifecycle/idle notification is NOT a delivery signal; no agent counts as returned until a PAYLOAD arrives. Measurement, DO/DO-NOT, BLOCKED corpus, transcript-recovery: `skills/30-claude-code-patterns/agent-result-delivery.md`.

**Why:** the report is written in full then discarded silently, so the orchestrator pays the whole cost again re-deriving work sitting complete on disk.

### MUST: Correctness-Review-Clean Is Not Security-Clean

A correctness / closure-parity reviewer returning CLEAN is NOT evidence a change is SECURITY-clean (tested-path correctness ≠ off-path adversarial defeat). A security-critical change (auth, signing, revocation, tenant-isolation, any fail-closed gate / trust-boundary) MUST be redteamed by BOTH a correctness reviewer AND an adversarial security-reviewer prompted to REFUTE — both with a genuine ran-signal — before convergence. Counting a CLEAN correctness verdict AS the security round, or dispatching only a correctness reviewer, is BLOCKED.

**Why:** The correctness lens is blind to off-tested-path attacks; in #1842-S3 a CLEAN correctness verdict co-occurred with a CRITICAL revocation bypass the SAME-round security-reviewer caught. Depth: `skills/30-claude-code-patterns/redteam-dispatch-evidence-gate.md`.

## Zero-Tolerance

Pre-existing failures MUST be fixed (`rules/zero-tolerance.md` Rule 1). No workarounds for SDK bugs — deep-dive and fix directly (Rule 4).

**Why:** Workarounds create parallel implementations that diverge from the SDK.

## MUST: Verify Specialist Tool Inventory Before Implementation Delegation

When delegating IMPLEMENTATION work (file edits, commits, build/test invocation, version bumps), the orchestrator MUST select a specialist whose declared tool set includes `Edit` AND `Bash`. Read-only specialists (`security-reviewer`, `analyst`, `reviewer`, `gold-standards-validator`, `value-auditor`) MUST NOT be delegated implementation tasks. Tool-inventory table: guide.

**BLOCKED rationalizations:** guide § "Verify Specialist Tool Inventory … — BLOCKED rationalizations".

**Why:** Read-only specialists halt mid-instruction at file-edit boundaries; pre-launch tool-inventory verify is O(1), re-launch is O(N) on shard size.

**Read-only reviewer materialization (INCREMENTAL):** guide § Read-only reviewer materialization.

## MUST: Audit/Closure-Parity Verification Specialist Has Bash + Read

When delegating a /redteam round including **closure-parity verification** (mapping prior-wave findings to delivered code), the orchestrator MUST select a specialist with `Bash` AND `Read`. Read-only analyst MUST NOT be assigned — its tool set silently FORWARDS verification rows the next round must redo. Extends the tool-inventory MUST above from IMPLEMENTATION to AUDIT delegation. Examples, BLOCKED corpus, detection signals, Origin: `.claude/skills/30-claude-code-patterns/closure-parity-specialist-discipline.md`.

**Why:** Tool-inventory mismatch costs one full audit round; pre-launch verify is O(1), re-launch O(N) on row count.

## MUST: Worktree Orchestration

Parallel/compiling agents MUST run isolated per `skills/30-claude-code-patterns/worktree-orchestration.md` (Rules 1–11, each a full MUST). Three fire every parallel session: isolate compiling agents AND shared-source editors (readers read committed HEAD); commit per milestone; and in a SHARED tree restore ONLY from a `cp` backup — `git checkout --`/`git restore` are BLOCKED (they restore from the INDEX, destroying unstaged work).

**Why:** Each sub-rule converts a silent parallel-work loss into clean isolation or a loud refusal.

## MUST NOT

- **Framework work without specialist** — misuse violates invariants (pool sharing, session lifecycle, trust boundaries).
- **Sequential when parallel is possible** — wastes the autonomous execution multiplier.
- **Raw SQL / custom API / custom agents / custom governance** — see `rules/framework-first.md` and guide for per-framework rationale.

## Trust Posture Wiring

Applies to the **§ Triad** clause ONLY (added 2026-07-18, `journal/0543`); ships canonical-8-field-compliant. Grandfather + precedent: guide § Clause-Scoped Wiring Precedent.

- **Severity:** `halt-and-report` at `/codify` + `/redteam` gate-review (confirm a decomposable input went onto a parallel wave + substantive changes redteamed to convergence, not self-attested); `advisory` at the hook layer per `rules/hook-output-discipline.md` MUST-2 (session-history judgment).
- **Grace period:** 7 days (2026-07-18 → 2026-07-25).
- **Cumulative posture impact:** same-class violations (decomposable input run inline-serially; a change called "done" without redteam-to-convergence) route to `rules/trust-posture.md` MUST-4 cumulative math (3× same-rule / 5× total in 30d → drop 1 posture).
- **Regression-within-grace:** GENERIC `regression_within_grace` trigger per `rules/trust-posture.md` MUST-4 (1× = drop 1 posture) — NO dedicated key; named deviation from key-per-clause per Rule 8 (same disposition as `wave-loop.md` MUST-6/7).
- **Receipt requirement:** SessionStart soft-gate `[ack: agents]` IFF `posture.json::pending_verification` includes `agents`.
- **Detection mechanism:** Phase 1 (manual) — cc-architect / reviewer inspect the transcript for a parallel-wave dispatch + convergence receipt. Phase 2 (deferred) — advisory Stop detector + fixtures `.claude/audit-fixtures/wave-loop/orchestration-hygiene/` (shared with `wave-loop.md` MUST-6/7) per `rules/cc-artifacts.md` Rule 9.
- **Violation scope:** the § Triad clause ONLY; grandfathered sections exempt until `/codify`-touched.
- **Origin:** `journal/0543` (co-owner-directed); see § Origin below.

### Clause-scoped wiring — Correctness-Review-Clean Is Not Security-Clean (added 2026-07-22)

Applies to the **§ Quality Gates → "Correctness-Review-Clean Is Not Security-Clean"** clause ONLY (added 2026-07-22); ships canonical-8-field-compliant. Grandfather + clause-scoped precedent: guide § Clause-Scoped Wiring Precedent.

- **Severity:** `halt-and-report` at `/implement` + `/redteam` + `/codify` gate-review (confirm a security-critical change was redteamed by BOTH a correctness reviewer AND an adversarial security-reviewer, both with genuine ran-signals, before convergence); `advisory` at the hook layer per `rules/hook-output-discipline.md` MUST-2 (session-history judgment).
- **Grace period:** 7 days from clause landing (2026-07-22 → 2026-07-29).
- **Cumulative posture impact:** same-class violations (a security-critical change converged on a correctness-only round; a CLEAN correctness verdict counted as the security round) route to `rules/trust-posture.md` MUST-4 cumulative math (3× same-rule / 5× total in 30d → drop 1 posture).
- **Regression-within-grace:** GENERIC `regression_within_grace` trigger per `rules/trust-posture.md` MUST-4 (1× = drop 1 posture) — NO dedicated key; named deviation per Rule 8 (rationale in guide).
- **Receipt requirement:** SessionStart soft-gate `[ack: agents]` IFF `posture.json::pending_verification` includes `agents`.
- **Detection mechanism:** Phase 1 (manual) — cc-architect / reviewer inspect any session redteaming a security-critical change (auth / crypto-signing / revocation / tenant-isolation / fail-closed-gate / trust-boundary) and confirm the round dispatched BOTH a correctness reviewer AND an adversarial security-reviewer **prompted to refute**, both returning a genuine ran-signal (§ Redteam Reviewer Dispatch). Phase 2 (deferred) — advisory Stop detector + fixtures `.claude/audit-fixtures/correctness-not-security-clean/` per `rules/cc-artifacts.md` Rule 9.
- **Violation scope:** the § "Correctness-Review-Clean Is Not Security-Clean" clause ONLY; other clauses stay on their own wiring.
- **Origin:** kailash-py #1842-S3 — kailash 2.58.0 signed revocation ledger; correctness CLEAN, adversarial security caught a CRITICAL bypass. Landed at loom via `/sync-from-build` Wave-1 placement (loom-sweep-waves-2026-07-22).

### Clause-scoped wiring — A Dispatched Agent's Result Is Not Received Until It Is DELIVERED (added 2026-08-13)

Applies to the **§ Agent-Result-Delivery** clause ONLY (added 2026-08-13, USE-template origination); ships canonical-8-field-compliant. Grandfather + precedent: guide § Clause-Scoped Wiring Precedent.

- **Severity:** `halt-and-report` at gate-review (reviewer at `/implement` + cc-architect at `/codify` confirm every relied-on agent returned a payload and no `name` was paired with the task-return-contract instruction); `advisory` at the hook layer per `hook-output-discipline.md` MUST-2. The `name` field is structurally present in the `PreToolUse` input, but the other half of the predicate — whether the prompt instructs `SendMessage` reporting — is decidable only LEXICALLY over prompt prose, and MUST-2 bars `block` on lexical evidence regardless of how good the matcher gets. A better adjudicator would NOT unlock `block`.
- **Grace period:** 7 days from clause landing (2026-08-13 → 2026-08-20).
- **Cumulative posture impact:** same-class violations (a named agent dispatched under the task-subagent return contract; a lifecycle notification counted as a delivered result) route to `trust-posture.md` MUST-4 cumulative math (3× same-rule / 5× total in 30d → drop 1 posture).
- **Regression-within-grace:** GENERIC `regression_within_grace` trigger per `trust-posture.md` MUST-4 (1× = drop 1 posture) — NO dedicated key. Named deviation per Rule 8, with THIS clause's own reason (it does NOT inherit the shared one, whose "no structural signal" leg does not hold here): the loss corrupts nothing and is recoverable from the on-disk agent transcripts, so it does not warrant an instant-drop key — though recovery depends on the operator knowing the procedure and on transcripts not having rotated, which is why the clause is `halt-and-report` at gate-review rather than advisory-only.
- **Receipt requirement:** SessionStart soft-gate `[ack: agents]` IFF `posture.json::pending_verification` includes `agents`.
- **Detection mechanism:** Phase 1 (manual) — reviewer / cc-architect confirm (a) each relied-on agent returned an actual payload, not a lifecycle notification, and (b) no dispatch paired a `name` with the task-return-contract instruction. Phase 2 (deferred, but feasible — unlike this corpus's usual judgment-bearing detectors) — a `PreToolUse` audit-fixture-backed detector, matcher `Agent|Task`, per `hook-event-selection.md`: the subject (spawn params) EXISTS at that event and the mis-pairing is decidable BEFORE the cost is paid; `SessionStart` and `Stop` are BLOCKED for it (one precedes any dispatch, the other fires only after the work is lost). The matcher MUST cover BOTH names, sourced from `hooks/lib/provenance-capture-tool.js::DELEGATION_TOOLS` rather than restated — the delegation tool is `Agent` on current harnesses and `Task` on vanilla CC, so an `Agent`-only matcher is structurally blind there: it never fires, always passes, and reads as enforcement. Fixtures land WITH it at `.claude/audit-fixtures/agent-result-delivery/` (Phase-2-deferred, not yet created) per `cc-artifacts.md` Rule 9.
- **Violation scope:** this clause ONLY — its SPAWN CONTRACT and DELIVERY GATE halves; each row names the agent and which half failed.
- **Origin:** See `skills/30-claude-code-patterns/agent-result-delivery.md` § Origin.

Origin: 2026-04-19 onward; full provenance chain + evidence in guide § Origin.

<!-- /slot:neutral-body -->

<!-- slot:examples -->

## Examples (CLI-specific delegation syntax)

Worked Examples 1–5 (CC / Codex / Gemini delegation syntax per clause) live in `.claude/skills/30-claude-code-patterns/specialist-delegation-syntax.md`; see guide § Examples. The MUST clauses above are the CLI-neutral contract.

<!-- /slot:examples -->
