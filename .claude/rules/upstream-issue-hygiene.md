---
priority: 10
scope: path-scoped
paths:
  - "**/.github/**"
  - "**/CONTRIBUTING.md"
  - "**/SECURITY.md"
  - "**/.session-notes"
  - "**/journal/**"
  - "**/workspaces/**"
---

# Upstream Issue Hygiene

When a downstream session — a Python / Ruby / Rust binding consumer working with `kailash` / `kailash_*` packages — discovers a defect or feature gap in the underlying SDK, the natural action is to file an issue against the SDK repo. That action MUST be human-gated, and the issue body MUST contain ONLY information from the SDK's public-API surface — never the consumer project's name, internal paths, workspace identifiers, finding tags, or session context.

The defect goes upstream. The story of HOW you found it stays at home.

## Scope

ALL sessions running in a USE-template-derived consumer repo. Applies to ANY `gh issue create`, `gh pr create`, `gh issue edit`, or equivalent issue-filing command targeting an SDK repository (`kailash-py`, the Rust SDK, `kailash-prism`, or any sibling distributed via PyPI / crates.io / gems).

It ALSO governs the **proposal-intake lane**: a USE-template or BUILD repo filing a COC-artifact issue, or a `/codify` proposal whose body flows through loom Gate-1, MUST scrub per Rule 2 BEFORE filing — a proposal body is a pipeline input that reaches 30+ downstream consumers once split and distributed, exactly the surface this rule fences.

It ALSO governs the **downstream-upflow inbox-PR surface**: a `coc-project` consumer's Step-7c offer is a `gh pr create` adding `<template>/.claude/.proposals/inbox/<date>-<slug>.yaml` — a filing subject to MUST-1's human gate AND MUST-2's redaction exactly as an SDK-repo issue is. The inbox YAML body (its `codify_session` + per-change `reason:` free-text — the human-scrub-only residual, NOT reached by the mechanical scanner) AND every referenced artifact file MUST be scrubbed before the PR is opened (this is fence i of the scenario-8 QUADRUPLE disclosure fence; the template's inbox-ingest scrub and loom Gate-1 are fences ii–iii). Step-7c provenance is hop-level only (`origin: downstream`, no `source_repo` / consumer name), so the schema itself carries no consumer identity — but the free-text fields are the surface this rule fences.

## MUST Rules

### 1. Human Gate Before Filing

The agent MUST NOT execute `gh issue create`, `gh pr create` referencing an upstream SDK issue, or any equivalent issue-filing command against an SDK repo without explicit user approval IN THE SAME SESSION. Drafting the body is permitted; submission is not.

```bash
# DO — draft, present, wait for approval, then submit
draft="$(cat <<'EOF'
... # see Rule 3 for the required shape
EOF
)"
echo "Proposed issue body:"; echo "$draft"
echo "Approve filing against terrene-foundation/kailash-py? (y/N)"
read -r approval
[ "$approval" = "y" ] && gh issue create --repo terrene-foundation/kailash-py --title "..." --body "$draft"

# DO NOT — auto-submit because the rule said "file an issue"
gh issue create --repo terrene-foundation/kailash-py --title "feat: ..." --body "$draft"
# (no human gate; submitted before the user could redact downstream context)
```

**BLOCKED rationalizations:**

- "The cross-SDK parity rule said to file the issue"
- "The user already approved cross-SDK filing as a class"
- "Filing is a tool call, not a destructive action"
- "We can edit the body after if there's a problem"
- "The body is generic, no privacy concern"
- "Approval-per-issue is bureaucracy when the pattern is the same"

**Why:** Issues filed against public SDK repos are world-readable forever. Auto-filing without a per-issue gate ships downstream-context leaks (project names, internal file paths, workspace IDs) to a surface the user cannot scrub after the fact. The human gate is the only mechanism that catches a draft body's leakage BEFORE it becomes part of the public record. "We can edit later" is wrong: GitHub preserves issue body history; redaction is partial.

### 2. Downstream Context Redaction

The issue body MUST NOT contain any of:

- The downstream project's name (e.g., consumer app names, customer / engagement names)
- Internal file paths outside the SDK's import surface (e.g. `src/<consumer-app>/...`, `app/...`, `bindings/<consumer>/...`)
- Workspace identifiers (`workspaces/<name>/...`, `.session-notes`, `.proposals/...`, journal paths)
- Finding tags (e.g., `F-G1-HIGH`, `S-H3`, `BP-049`, internal redteam round IDs)
- Session timestamps tied to consumer work (e.g. `<date> <consumer-app> session`, `S07-reviewer-...`)
- "Origin: <consumer-app>" footers, "<consumer-app> workaround" sections, "Discovered during <consumer-name> red team" lines
- References to private SDK repos when filing on the public SDK repo

````markdown
# DO — body is scoped to the SDK API surface, no consumer context

## Summary

`DataFlow.execute_raw(sql, params)` raises `invalid byte sequence for encoding "UTF8"`
on a NEXT query after a NULL bind on a TEXT-typed column. The bytes do not appear
in any caller-side parameter; corruption originates at the FFI boundary.

## Reproduction

```python
import kailash
df = kailash.DataFlow("postgresql://...")
df.execute_raw("INSERT INTO t (col) VALUES ($1)", [None])
df.execute_raw("INSERT INTO t (col) VALUES ($1)", ["ascii-only"])  # raises UTF-8 error
```

# DO NOT — body carries consumer-project name + internal paths + finding IDs

## Summary

[same technical content]

## Origin

F-G1-HIGH S-H3 finding (<consumer-app> repo, 2026-04-27): non-atomic store_tokens in
live_oauth.py:192-237 and pseudo-atomic in oauth.py:470-536.

## Workspace

workspaces/<consumer-app>/journal/0020-DISCOVERY-dataflow-execute-raw-utf8-corruption.md
````

**BLOCKED rationalizations:**

- "Maintainers need the discovery context to triage"
- "The workspace path is internal to me, no leak"
- "The downstream name is just a tag, anyone could guess it"
- "Closed issues aren't really public"
- "The Origin footer is provenance, not context"
- "I'll keep the workspace path because it links back to the journal"
- "The finding tag is the most concise way to communicate severity"

**Why:** A public SDK issue is indexed by GitHub, search engines, code-search tools, and every downstream consumer's `gh issue list`. Every leaked downstream identifier becomes a permanent breadcrumb to a consumer project, its file structure, and its development methodology. Maintainers DO NOT need provenance to triage — they need a minimal repro and acceptance criteria (Rule 3). Provenance belongs in the consumer's local journal, not the upstream issue.

### 3. Minimal Repro Shape

The issue body MUST consist of ONLY:

1. **Affected SDK API surface** — one import path (e.g., `kailash.DataFlow.execute_raw`, `kailash_kaizen.LlmClient.embed`). No consumer wrappers, no consumer-side facade names.
2. **Minimal repro** — Python / Rust / Ruby code using ONLY `kailash` / `kailash_*` imports and `pytest` / `cargo test` / `rspec` standard scaffolding. No consumer modules, no consumer config files, no fixtures with consumer-derived names.
3. **Expected vs actual** — what the SDK contract promises (cite spec § or docstring) vs what the SDK delivers.
4. **Severity** — `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` based on SDK-API-surface impact, NOT consumer-business impact.
5. **Acceptance criteria** — bulleted, testable, scoped to the SDK API. Format: `[ ] <observable behavior on the SDK surface>`.

Nothing else. No "## Workaround", no "## Workspace", no "## <consumer-app> wired around it like this", no "## Cross-references" pointing to consumer journals, no "## Cross-SDK alignment" sections.

````markdown
# DO — five required sections, nothing else

## Affected API

`kailash.DataFlow.execute_raw(sql: str, params: list)`

## Minimal repro

```python
import kailash
df = kailash.DataFlow("postgresql://localhost/test")
df.execute_raw("CREATE TABLE t (col TEXT)")
df.execute_raw("INSERT INTO t VALUES ($1)", [None])
df.execute_raw("INSERT INTO t VALUES ($1)", ["ascii-only"])
# Raises: psycopg.errors.CharacterNotInRepertoire: invalid byte sequence
```

## Expected vs actual

Expected: ASCII-only string parameter binds correctly.
Actual: UTF-8 decoding error on a parameter that contains zero non-ASCII bytes.

## Severity

HIGH — corrupts data path; non-deterministic; reproduces in CI.

## Acceptance criteria

- [ ] `execute_raw(sql, [None])` followed by `execute_raw(sql, [ascii_str])` succeeds.
- [ ] Tier 2 regression test added at `tests/integration/dataflow/test_execute_raw_null_bind.py`.

# DO NOT — the historical kitchen-sink shape

## Summary

[5 paragraphs of context including consumer name]

## Workspace

workspaces/<consumer-app>/journal/...

## Workaround

The consumer worked around it by ... [3 paragraphs of consumer-internal architecture]

## Cross-SDK alignment

This is the Python equivalent of <sibling-SDK>#NNN ...

## References

- <consumer-app> shard: S36d
- Tier 2 test suite: tests/integration/test*websocket*\*.py [in the consumer repo]
````

**BLOCKED rationalizations:**

- "The 'Workaround' section helps users hitting the same bug"
- "Cross-SDK alignment links speed up triage"
- "The consumer's Tier 2 tests are the verification — they must be referenced"
- "Five sections is too rigid for a complex issue"
- "The minimal repro doesn't show the production stack trace"

**Why:** Every section beyond the five required is a leakage surface. Workarounds belong in the consumer's local docs (the consumer is the one who wrote them, the only one who can keep them current). Cross-SDK alignment is a maintainer concern that the maintainer files separately on the sibling repo with their own scoped repro. Production stack traces beyond the minimal repro often contain consumer-side function names; the minimal repro is the structural defense.

### 4. Open, Never Complete — A Downstream Upflow OPENS A PR And STOPS

A downstream consumer's `/codify` Step-7c upflow MUST **open** its inbox PR against the upstream (template / BUILD) repo and **STOP THERE**. Merging, completing, auto-merging, admin-merging, enabling auto-merge, or pushing directly to ANY branch of an upstream repo is BLOCKED — with **no exception, and no human-gate that unlocks it**. MUST-1's gate authorizes **submission** (`gh pr create` / `gh issue create`); it NEVER authorizes **completion** (`gh pr merge` / ADO complete / `completeUpflowPR`). The two are different acts with different owners: the consumer proposes, the **upstream maintainer disposes** — after `/sync-from-downstream` has scrubbed the offer, reviewed it as untrusted data, deduped it, and relayed it. A consumer that merges its own offer has executed the upstream's review gate on the upstream's behalf, and the upstream's `ingest_disposition` receipt then attests to a review that never happened.

Symmetrically, an upstream maintainer MAY complete a PR **only on its own repo**. That is the general invariant both halves reduce to: **you may only complete a PR on the repo you ARE** — and "the repo you are" is DERIVED from the environment (`.claude/VERSION::repo` verified against the live git remote), never asserted by the caller.

**What the structural fence does and does not cover — stated precisely, because the first cut over-claimed it.** `completeUpflowPR` (both VCS adapters) derives the self-identity via `hooks/lib/upflow-self-repo.js::deriveSelfRepoRef` and refuses BEFORE the transport fires when the identity is underivable, self-contradictory, or ≠ the target. It does NOT cover: `gh pr merge` typed at the CLI, a merge run from a clone of the upstream itself, `curl` against the merge endpoint, `--auto`/merge-queue completion, a direct `git push` to an upstream branch, or the OTHER cross-repo write primitives in the same adapters (`_dispatchWorkflow` via `pushImage`/`applyDeployTarget`, and `invalidateCache`) — a `workflow_dispatch` on an upstream's default branch is a strictly WIDER capability than the merge this fences. Those residuals are named here and in Detection rather than implied away; MUST-4 binds the AGENT on every path, and the adapter fence is one structural backstop among them, not the whole enforcement.

```bash
# DO — downstream opens, and stops. The PR URL IS the handoff.
git push -u origin upflow/2026-08-03-<slug>
gh pr create --repo <upstream-owner>/<upstream-repo> --title "proposal(inbox): …" --body "$scrubbed"
echo "Offer open at <url>. The upstream merges it after /sync-from-downstream review."

# DO NOT — open then complete (the consumer just executed the upstream's gate)
gh pr create --repo <upstream>/… && gh pr merge --repo <upstream>/… --admin --merge
gh pr merge <N> --repo <upstream>/… --auto --squash   # auto-merge is completion, deferred
git push <upstream-remote> HEAD:main                   # direct push — same act, no PR at all
```

**BLOCKED rationalizations:**

- "I opened it, so I own it" / "it's my own PR, merging it is just housekeeping"
- "The human already approved the filing" (MUST-1 gates SUBMISSION, never COMPLETION)
- "The upstream is unattended / the maintainer is slow / it would sit for weeks"
- "CI is green and the scrub passed, so the review is a formality"
- "I have admin on the upstream, so I am _a_ maintainer"
- "`--auto` isn't merging, it's just queuing" (it completes without a maintainer act)
- "The template told me to cascade, and an unmerged PR hasn't cascaded"
- "I'll merge it and the upstream can revert if they disagree"
- "`completeUpflowPR` is exported, so it must be part of the upflow lane"

**Why:** The upstream's ingest is the ONLY place the offer is scrubbed against the upstream's denylist, reviewed as untrusted data, deduped against work already relayed, and lane-checked — and a self-merged offer skips **all four** while still producing an `ingest_disposition` receipt that reads as though they ran. That is worse than an unmerged PR: it is an unreviewed change wearing a reviewed change's provenance, cascading from the upstream to every sibling consumer that pulls. An open PR is a complete, honest handoff; the latency it costs is the review, not a defect in the mechanism.

## MUST NOT

- File any upstream SDK issue, PR, or PR-comment containing a downstream project name, internal path, workspace ID, or finding tag

**Why:** Once on the public record, redaction is partial; GitHub preserves edit history and the original body is recoverable.

- Treat "the user said yes once" as standing approval for future filings

**Why:** Standing approval erodes the per-issue gate that catches body-level leakage; each issue's body is unique and demands its own review.

- Auto-cross-file: filing on one SDK repo then auto-filing the sibling on a paired SDK repo without a separate human gate

**Why:** Auto-cross-filing replicates whatever leakage the first body contained, doubling the surface area; cross-SDK parity is a maintainer concern, not a consumer one.

- File a `/codify` proposal or a COC-artifact intake issue whose body carries a client / operator / 3rd-party identifier into loom Gate-1

**Why:** A proposal body that reaches Gate-1 is split and distributed to 30+ consumers; any leaked identifier becomes permanently correlatable across all of them before any output fence runs — the intake lane is a pipeline input, not a private note.

- Merge, complete, admin-merge, auto-merge, or directly push to any branch of an UPSTREAM repo from a downstream upflow lane

**Why:** Completion is the upstream maintainer's act on the upstream's own repo; a self-merged offer bypasses the scrub, the untrusted-data review, the dedup, and the lane check while still producing a receipt that attests they ran.

- Read MUST-1's human gate as authorization to COMPLETE a PR, rather than to SUBMIT one

**Why:** Submission and completion are different acts with different owners; conflating them converts a per-filing approval into a standing merge right the user never granted.

## Trust Posture Wiring — MUST-4 (Open, Never Complete)

Applies to the **MUST-4** clause (added 2026-08-03). Per `trust-posture.md` MUST-8 grandfather cutoff, MUST-4 lands AT/AFTER the MUST-8 SHA and ships canonical-8-field-compliant; the pre-existing MUST-1/2/3 + MUST-NOT sections remain grandfathered until each is itself `/codify`-touched (the clause-scoped precedent set by `security.md` § Enforcement-Surface Parity + `git.md` § CI-check/merge).

- **Severity:** `halt-and-report` at gate-review (reviewer at `/implement` + cc-architect at `/codify` confirm a Step-7c upflow opened its PR and stopped, and that any completion was on the repo the caller IS). **NO hook-layer severity — the adapter is NOT a hook.** `completeUpflowPR` is a library function returning `{ok:false, error, reason}`; it never calls `instruct-and-wait.js::emit()`, never exits 2, and is registered at no hook event, so the `block`/`halt-and-report`/`advisory` vocabulary (hook-output severities) does not apply to it. The honest description is a **structural refusal at the library boundary**, failing CLOSED on an underivable, disagreeing, or non-self identity. An earlier draft claimed "`block` at the adapter layer … a STRUCTURAL identity comparison (`selfRepoRef` vs `repoRef`)"; a Tier-1 redteam found that BOTH a category error (no `severity` field exists in either adapter) AND an over-claim (both operands were then caller-authored, so the comparison carried no information about the world — `instrument-discipline.md` MUST-1). Recorded rather than silently overwritten, inside the rule whose own subject is not over-claiming a control.
- **Grace period:** 7 days from clause landing (2026-08-03 → 2026-08-10).
- **Cumulative posture impact:** **N/A — emergency-only trigger.** Stated explicitly per `trust-posture.md` MUST-8 ("Required even when N/A so the reader knows the cumulative path is not silently inherited"), and NOT inherited. A downstream lane merging/completing/auto-merging an upstream PR, or pushing directly to an upstream branch, IS a cross-repo write outside scope, which `trust-posture.md` MUST-4 routes to `critical` → **L1 on the FIRST instance**. A cumulative 3×/5× window is therefore structurally unreachable — you never reach 3× because instance 1 is already terminal — so claiming both would be an unreachable clause dressed as an additional control. **Single-count:** the act is counted ONCE, on the `critical` path; it does not ALSO accrue here (the `evidence-first-claims.md` never-double-counted + `recommendation-quality.md` MUST-8 single-count-exemption precedents).
- **Regression-within-grace:** routes through the pre-existing `critical` trigger in `trust-posture.md` MUST-4 — **cross-repo write outside scope → drop to L1** — NOT the generic 1-step `regression_within_grace`. **That routing is grace-INDEPENDENT**: `trust-posture.md`'s `critical` trigger carries no grace qualifier, so the act is critical BEFORE, DURING, and AFTER the 2026-08-10 window; the grace period above governs only this clause's detection ramp, never the severity. (An earlier draft scoped the critical routing "within the grace window", which implied the act stopped being critical afterwards — weaker than the `repo-scope-discipline.md` rule this clause invokes to justify the harsher route.) Named deviation from the key-per-clause shape, recorded per `trust-posture.md` Rule 8: no NEW key is minted because the existing `critical` trigger describes the act exactly. **Naming note:** `critical` is a severity CLASS in MUST-4's emergency list, not a machine trigger key like `regression_within_grace` — a Phase-2 detector author will not find a `critical` key in `posture-spec.md`'s `type` enum, and should route on the cross-repo-write predicate instead.
- **Receipt requirement:** SessionStart soft-gate `[ack: upstream-issue-hygiene]` IFF `posture.json::pending_verification` includes this rule_id (shared rule_id; one ack covers MUST-1..4).
- **Detection mechanism:** TWO tiers, and neither is claimed to be more than it is. **Structural (library-boundary refusal, NOT a hook):** the `completeUpflowPR` fence in BOTH VCS adapters (`.claude/hooks/lib/vcs-github-adapter.js` + `vcs-azure-adapter.js`), which DERIVES the self-identity via `hooks/lib/upflow-self-repo.js::deriveSelfRepoRef` (`.claude/VERSION::repo` cross-checked against the live git remote, both sides normalized by one shared `normalizeComponent`) and refuses before the transport fires on an underivable, disagreeing, or non-self identity. There is deliberately NO `selfRepoRef` parameter — a caller cannot assert an identity. Both providers landed in the SAME change per `security.md` § Enforcement-Surface Parity. Audit fixtures: `.claude/audit-fixtures/upflow-open-never-complete/run.mjs` — **9 inline cases: 4 kinds × 2 providers (refuse-cross-repo, fail-closed-on-underivable-identity, allow-own-repo, case-insensitive-own-repo) + 1 `.git`-suffix normalization case**, each recording the mutation that reds it per `instrument-discipline.md` MUST-2(b). MEASURED, not asserted: dropping the shared case-fold reds BOTH case-insensitive cases; dropping the `.git` strip reds the normalization case; neutering either provider's own-repo check reds that provider's refuse case. The count is load-bearing — the first cut shipped 7 and omitted `ado/case-insensitive-own-repo`, and a reviewer probe proved that predicate had NO instrument (dropping ADO's case-fold left the suite fully green). **The fixtures have no CI runner in this repo** (`.claude/test-harness/` is never-synced here and no workflow invokes `audit-fixtures/**`), so this tier is COMMITTED-FIXTURES-MANUALLY-DRIVEN, not a live gate — stated plainly rather than described as "blocking". **Semantic (Phase 1, gate-review):** reviewer/cc-architect inspect any session that ran a Step-7c upflow. UNCOVERED RESIDUALS, enumerated: `gh pr merge` typed at the CLI (PARTIALLY covered — `violation-patterns.js::detectRepoScopeDriftBash` fires `halt-and-report` when `--repo` names a non-origin target, and NOT covered when run from a clone of the upstream, with no `--repo`, via `curl`, or via `--auto`/merge-queue); a direct `git push` to an upstream branch (`validate-bash-command.js` requires BOTH `--force` and a main-token, so a non-force push falls through to an advisory reminder); and the sibling cross-repo write primitives `_dispatchWorkflow`/`pushImage`/`applyDeployTarget`/`invalidateCache`, which take an arbitrary `repoRef` with no own-repo check — `workflow_dispatch` on an upstream's default branch is a WIDER capability than the merge this fences. Phase-2 targets: a `validate-bash-command.js` tripwire for `gh pr merge`/`git push` against a non-self repo, and extending the derivation fence to the deploy-write surface; audit fixtures land WITH each.
- **Violation scope:** MUST-4 ONLY (clause-scoped) + its two MUST-NOT bullets; MUST-1/2/3 stay on their grandfathered footing.
- **Origin:** See § Origin — MUST-4 paragraph.

Origin: A 2026-04-29 public SDK issue body leaked `F-G1-HIGH S-H3 finding (<consumer-app> repo, 2026-04-27): non-atomic store_tokens in live_oauth.py:192-237 and pseudo-atomic in oauth.py:470-536` into a public SDK issue. Sibling leaks confirmed across ~13 issues spanning two public SDK repos (consumer-app workspace paths, finding tags, "<consumer-app> workaround" sections, references to private SDK repos). Drafted as the structural defense after the leakage audit (loom 2026-04-30).

**MUST-4 (Open, Never Complete):** 2026-08-03 — co-owner-directed origination at the `kailash-coc-rs` USE template. A downstream `/codify` cascade **merged its upflow PR into its upstream template's `main`**, executing the upstream's review gate on the upstream's behalf. Root cause was an absence, not a bad instruction: **no clause anywhere in the corpus prohibited it** (`grep -rn "never merge\|MUST NOT merge"` over `rules/`, `commands/`, `sync-flow.md`, and the inbox README returned only an unrelated red-CI hit). MUST-1 gates `gh issue create` / `gh pr create` — submission — and is silent on completion. The one prose surface a downstream agent reads, `skills/30-claude-code-patterns/sync-flow.md`, listed `completeUpflowPR` → `gh pr merge` in the SAME sentence as the two downstream-facing primitives, qualified only by the word "maintainer-side" — which a consumer that just opened the PR can plausibly read as itself. Meanwhile `completeUpflowPR` was defined, exported, and **caller-less** in both VCS adapters: a documented merge capability on the upflow lane with nothing gating it and nothing using it. Fixed by (a) this clause, (b) a fail-closed own-repo fence in both adapters + mutation-verified fixtures, (c) splitting the `sync-flow.md` primitive listing so the maintainer-side capability is no longer advertised to the consumer lane, and (d) the Step-7c stop-point in `commands/codify.md`. The same session independently reproduced the template-side half of the failure — the ingest merged an inbox PR autonomously — which is what surfaced the gap.

**Same-cycle Tier-1 redteam correction (`self-referential-codify.md` Rule 1).** The first cut of (b) took a `selfRepoRef` DESCRIPTOR FIELD and compared it against `repoRef`. A three-agent parallel round found that BOTH operands then came off the same caller-authored object, so `{repoRef: X, selfRepoRef: X}` cleared the fence trivially — it stopped an ACCIDENT (an agent following the stale `sync-flow.md` prose, which IS the originating incident class) but not an agent that had decided to merge, while this rule asserted the stronger "its own repo identity can never equal its upstream's". A repo-wide grep found ZERO producers of `selfRepoRef`, and the docstring named a derivation helper the adapters never imported. Corrected by DERIVING the identity (`upflow-self-repo.js`) so the claim and the code agree, per `instrument-discipline.md` MUST-1 — a comparison is evidence only when an operand is a fact the caller cannot author. The same round also found the fixture set 7-of-8: `ado/case-insensitive-own-repo` was missing, and its predicate was provably uninstrumented (dropping ADO's case-fold left the suite green). Recorded here because the rule's own subject is not over-claiming a control.

**Length rationale (per `rules/rule-authoring.md` MUST NOT § "Rules longer than 200 lines").** Rule body exceeds the 200-line guidance. Named rationale: **upstream-filing-contract scope** (the disclosure fence PLUS the completion fence). The rule codifies the full upstream-filing + proposal-intake contract — the human gate (MUST-1), the redaction denylist (MUST-2), the five-section minimal-repro shape (MUST-3), **the open-never-complete fence (MUST-4, added 2026-08-03 — ~55 of the current overage, carrying its own DO/DO-NOT, a 9-phrase BLOCKED corpus, the covered-vs-uncovered residual enumeration, and a clause-scoped 8-field Trust-Posture Wiring block)**, the downstream-upflow inbox-PR surface (§ Scope), plus the MUST NOT clause block — each carrying the DO/DO-NOT examples + `**Why:**` lines `rules/rule-authoring.md` MUST-3/4 require. The good-vs-kitchen-sink example issue-bodies are necessarily verbose because the leakage failure mode they teach is shape-level, not one-liner. This rule is `priority: 10` + `scope: path-scoped`, so it pays NO baseline-emission cost (loaded only in sessions matching its `paths:` globs) and `rules/rule-authoring.md` Rule 10's proximity-band gate does NOT fire. Per `rules/rule-authoring.md` MUST NOT § "Rules longer than 200 lines": overage is permitted with named rationale anchored at Origin. Sibling precedent: `artifact-flow.md` Origin.
