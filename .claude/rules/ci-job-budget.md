---
priority: 10
scope: path-scoped
paths:
  - ".github/workflows/**"
  - ".github/job-budget.json"
  - ".github/scripts/job-budget-audit.py"
---

# CI Job Budget — A New PR Job Is A Declared Act, Never A Silent One

CI jobs accrete one unremarkable job at a time, and nothing says anything at the moment each is added. No single addition is worth arguing about; the sum is, and by the time the sum is visible nobody can say which job to remove or why it was added. The upstream instance measured one PR fanning out to **33 runner-consuming jobs against a pool of 24, of which only 12 gated anything**.

This repo does **not** currently have that problem — the census at authoring time was 7 PR-reachable jobs, 3 required, 6 relevance-gated, **0 freeloaders**. The rule exists so that stays true **by construction rather than by discipline**. Adding a job is legitimate; the goal is that it becomes a _declared_ act, not that it is refused.

The authority is `.github/scripts/job-budget-audit.py`; the declaration is `.github/job-budget.json`. Both live under `.github/` deliberately — loom does not write that tree on this lane, so unlike a `.claude/bin/` script they are durable across syncs.

## MUST Rules

### 1. Every PR-Reachable Job Is Required, Relevance-Gated, Or Budgeted

A job reachable from a `pull_request` trigger MUST be one of: (a) a **required status context** on the protected branch, (b) **relevance-gated** — a job-level `if:` or a `paths:`/`paths-ignore:` filter on the `pull_request` arm, or (c) a **budgeted exemption** in `.github/job-budget.json` carrying a rationale, an `added` date, and a `revisit` date. A job that is none of the three is a **freeloader**: it runs on every PR and gates nothing. Adding one without declaring it is BLOCKED.

```yaml
# DO — relevance-gated, so it runs when it can actually say something
on:
  pull_request:
    paths: [".github/workflows/**"]

# DO NOT — runs on every docs PR, every proposal, every session note; gates nothing
on:
  pull_request:
```

**BLOCKED rationalizations:** "it's one more job, the matrix is already big" / "it's fast, it costs nothing" / "we'll gate it once it's stable" / "it's informational, not a gate — that's why it isn't required" / "adding a `paths:` filter risks missing something, better to always run" / "the budget file is bureaucracy for a two-minute job" / "CI minutes are cheap on hosted runners".

**Why:** The cost of any single job is genuinely negligible, which is exactly why no one objects to it; the mechanism that fails is _review_, not arithmetic. Forcing the addition into a declaration converts an invisible per-PR cost into a line in a diff that a reviewer can see and question.

### 2. A Budgeted Exemption Carries A Revisit Date

An entry in `budgeted[]` MUST carry `rationale`, `added`, and `revisit`. An exemption with no revisit date is BLOCKED.

```json
// DO — the allowance has an end
{ "job": "smoke", "workflow": "x.yml", "rationale": "...", "added": "2026-08-21", "revisit": "2026-11-21" }

// DO NOT — a temporary allowance with no date is a permanent one
{ "job": "smoke", "workflow": "x.yml", "rationale": "temporarily always-on" }
```

**BLOCKED rationalizations:** "it's temporary, we'll remove it soon" / "a date we won't honour is worse than none" / "the rationale explains it, the date is redundant".

**Why:** Every exemption is added as a temporary allowance and none is revisited unless something forces it; the date is what converts "we'll look at this later" into a check that fails on a specific day. A stale exemption is separately flagged, so a deleted job cannot leave its allowance behind.

### 3. An Unmeasured Capacity Reports UNKNOWN, Never A Pass

A pool's `capacity` MUST be either a positive finite integer with a `capacity_source` naming how it was obtained, or `null` with `capacity_source: "UNVERIFIED"`. When capacity is `null` the audit MUST report the demand and an explicit UNKNOWN — never a pass. A non-finite or non-integer capacity MUST fail closed.

```json
// DO — unmeasured, and says so; the audit renders no ceiling verdict
{ "capacity": null, "capacity_source": "UNVERIFIED" }

// DO NOT — a plausible number nobody measured; every later green is derived from it
{ "capacity": 20, "capacity_source": "probably the default plan limit" }
```

**BLOCKED rationalizations:** "20 is the documented default, close enough" / "a number is more useful than null" / "we can refine it later, meanwhile it gates something" / "Infinity means unlimited, which is true for hosted runners".

**Why:** A ceiling comparison against a guessed number is an instrument that cannot discriminate — it renders a green "within capacity" for every input, including the ones the check exists to catch. `Infinity` is the same failure wearing a numeric type: a loose numeric test admits it and silently deletes the comparison for every pool.

### 4. The Audit Is Shown Capable Of Failing Before Its Pass Is Read

`--selftest` MUST run before the audit in any automated invocation, and MUST include, for every declared check, an input whose correct verdict is FAIL. A pass from a gate never shown capable of failing is not evidence.

```yaml
# DO — control first, then the measurement
- run: python3 .github/scripts/job-budget-audit.py --selftest
- run: python3 .github/scripts/job-budget-audit.py

# DO NOT — read the green alone
- run: python3 .github/scripts/job-budget-audit.py
```

**BLOCKED rationalizations:** "the audit is simple, it obviously works" / "the selftest doubles the runtime" / "it passed on a tree we know is dirty once, that's enough".

**Why:** An inert gate and a satisfied gate produce identical output; only an input that SHOULD fail distinguishes them. This is `instrument-discipline.md` MUST-2 applied to the audit's own green.

## MUST NOT

- Remove a `paths:` filter to "be safe" without declaring the job as required or budgeted.

**Why:** Removing the filter converts a relevance-gated job into a freeloader; the audit will fail, which is the intended feedback rather than an obstacle to route around.

- Add a `push`-arm filter and assume it covers the `pull_request` arm.

**Why:** The arms are independent. A `paths:` filter on `push:` alone leaves the PR arm unfiltered, which is precisely the shape this repo already carries elsewhere and is the easiest way to reintroduce a freeloader while believing it is gated.

## Trust Posture Wiring

- **Severity:** `block` at the CI layer — the audit's exit code is a structural fact derived from parsed workflow YAML and a parsed declaration, not a lexical read of prose, which is the narrow class `hook-output-discipline.md` MUST-2 reserves `block` for. `advisory` at any future edit-time hook layer: naming a job "ungated" at PostToolUse time requires a lexical read of workflow YAML mid-edit, and adding a CI job is legitimate — the goal is a declared act, not a refusal. `halt-and-report` at gate-review (reviewer at `/implement` confirms a new PR-reachable job was declared).
- **Grace period:** 7 days from rule landing (2026-08-21 → 2026-08-28).
- **Cumulative posture impact:** same-class violations (a PR-reachable job added without a declaration; an exemption without a revisit date; a guessed capacity presented as measured) contribute to `trust-posture.md` MUST-4 cumulative-window math (3× same-rule in 30d → drop 1 posture; 5× total in 30d → drop 1 posture).
- **Regression-within-grace:** routes through the GENERIC `regression_within_grace` emergency trigger per `trust-posture.md` MUST-4 (1× = drop 1 posture) — NO dedicated per-clause trigger key. Named deviation from the canonical key-per-clause shape, recorded here per `trust-posture.md` Rule 8: the CI gate already refuses the violating state structurally, so the residual review-layer judgment does not warrant an instant-drop key. Same disposition `artifact-flow.md` § Owned-Surface Bound took for the same reason.
- **Receipt requirement:** SessionStart soft-gate `[ack: ci-job-budget]` IFF `posture.json::pending_verification` includes the `ci-job-budget` rule_id.
- **Detection mechanism:** structural and SHIPPED — this rule defers nothing. `.github/scripts/job-budget-audit.py` censuses PR-reachable jobs and fails on an undeclared freeloader, an unresolvable pool, a stale or undated exemption, a phantom required context, and a non-finite or exceeded capacity; it refuses with exit 2 (never a pass) when the parser is absent, the declaration is missing, or a workflow does not parse. Its `--selftest` is the negative control and carries, for every declared check, an input whose correct verdict is FAIL — including a two-pole test asserting the clean and freeloader trees produce DIFFERENT verdicts. Wired at `.github/workflows/job-budget.yml`, which runs the selftest BEFORE the audit and is itself relevance-gated, so the workflow passes its own rule. **Deliberately NOT restated here: the number of checks or selftest cases.** Every upstream revision that pinned a count went stale within a commit, twice; the run prints its own tail line instead. **No `.claude/` hook and no probe suite ship with this rule** — stated rather than implied: an edit-time PostToolUse detector would be a lexical read of YAML capped at advisory, and the structural CI gate already covers the class, so the semantic tier is UNCOVERED and owed at gate-review.
- **Violation scope:** MUST-1 (undeclared freeloader) + MUST-2 (exemption without a revisit date) + MUST-3 (unmeasured or non-finite capacity rendered as a verdict) + MUST-4 (audit green read without its selftest).
- **Origin:** See § Origin.

## Origin

2026-08-21 — applied here from `esperie-enterprise/loom#1877`, which proposed the upstream `ci-job-budget` artifact set from `kailash-rs` for incorporation, under a user-authorized cross-repo READ of that issue. Directed in-session: _"the intent is to understand the full surface of this problem and its root cause, so that you can address it IN THIS REPO. Get it done now, don't wait for loom to cascade down."_

**What was adapted rather than copied, and why.** The upstream declaration encodes pools and capacities for a self-hosted fleet; every job here is `ubuntu-latest`, a single GitHub-hosted pool whose concurrency ceiling is an account-plan property no configured secret can read. That is upstream's own decision point 3 (_"the capacity number has no scheduled reader"_) arriving as a live constraint rather than a deferred one. Rather than inherit a fleet-shaped declaration or invent a plausible integer, capacity is declared `null` / `UNVERIFIED` and the audit renders UNKNOWN for it — so the gate that actually bites here is the freeloader check, which is fully decidable from the workflow files. Setting a measured capacity later activates the ceiling arm with no code change.

**Carried over verbatim as design properties, because upstream records each as hard-won:** the Detection field does not restate a case count; the anti-vacuity floor (`every-check-has-a-negative-control`) fails loudly when a check is added with no result; the audit fails closed on a non-finite capacity, which a mutation showed a loose numeric test admits; and the edit-time layer is advisory rather than blocking.

**Placement is durability-driven.** The audit and declaration live under `.github/`, measured non-synced on this lane — the manifest declares exactly one `.github/` surface and scopes it to the `py` lane ("rs ships none"), and no sync commit has ever written `.github/workflows/` here (control: syncs _did_ write `.claude/hooks/`). A `.claude/bin/` placement would be Class-A non-durable and rebuilt away. This rule file itself IS in the synced tree and therefore non-durable; its durable surface is the paired proposal entry.
