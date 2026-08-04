---
slot: "0001"
type: DECISION
display_id: jack-hong
verified_id: unavailable-coordination-disabled
person_id: unavailable-coordination-disabled
date: 2026-08-03
topic: upflow open-never-complete
---

# DECISION — A downstream upflow opens a PR and never merges into its upstream

## Trigger

Co-owner directive, verbatim in substance: a downstream project's `/codify` cascade
"actually merged into your main, which is wrong. Ensure that downstream project's
/codify cascade if required only opens a PR and never merges into its upstream's
main." Paired with a directive to improve **accountability, transparency, and
practicality** of that cascade.

## What was actually wrong

The cause was an **absence, not a bad instruction**.

`upstream-issue-hygiene.md` MUST-1 gates `gh issue create` / `gh pr create` —
**submission** — and is silent on **completion**. So the one act that needed a
fence was the one act no clause named. Verified mechanically: a grep for
`never merge|NEVER merge|MUST NOT merge|not merge` across `.claude/rules/`,
`.claude/commands/`, `sync-flow.md` and the inbox README returned exactly one
hit — `commands/sweep.md:57`, "never merge red [CI]" — unrelated.

Two surfaces made the wrong move look sanctioned:

1. `sync-flow.md:233` listed all three methods in ONE sentence — `createUpflowPR`,
   `createUpflowIssue`, and "maintainer-side completion → `completeUpflowPR`" —
   closing with "the agent-followed CLI equivalents are `gh pr create` /
   `gh issue create` / `gh pr merge`". A downstream agent reading its own upflow
   procedure sees `gh pr merge` as an agent-followed equivalent, qualified only by
   "maintainer-side" — which a consumer that just opened the PR can read as itself.
2. `completeUpflowPR` was **defined, exported, and caller-less** in both VCS
   adapters: a documented merge capability with nothing gating it and nothing
   using it.

## Decision

Fix at four layers, so prose alone is not load-bearing.

- **Rule** — `upstream-issue-hygiene.md` MUST-4 "Open, Never Complete", with an
  explicit no-exception / no-human-gate-unlocks-it clause. Every plausible
  rationalization here _sounds responsible_ ("I opened it so I own it", "the human
  already approved the filing", "CI is green so review is a formality", "I have
  admin so I am a maintainer", "`--auto` isn't merging"), so the corpus is
  enumerated rather than left to judgment.
- **Structure** — a fail-closed `selfRepoRef` fence on `completeUpflowPR` in BOTH
  adapters, reducing to _you may only complete a PR on the repo you are_. Absent
  or malformed `selfRepoRef` **refuses**, so a caller that never considered the
  invariant cannot merge by omission. Both providers in the same change per
  `security.md` § Enforcement-Surface Parity — fencing one relocates the bypass.
- **Prose** — `sync-flow.md` consumer lane restated as exactly two methods plus a
  Step-7c stop-point; `commands/codify.md` Step 7c(5) gains "OPEN ONLY"; the inbox
  README states it in the consumer's own terms (the accountability/transparency half).
- **Fixtures** — 7 cases, both providers, each asserting the transport **never
  fired** rather than merely `ok === false`.

**Severity routing (deliberate):** regression-within-grace routes to the existing
`critical` cross-repo-write trigger (→ L1), not the generic one-step key. A
downstream merging into an upstream IS a cross-repo write; routing it softer would
make this clause weaker than the rule it composes with.

## Why the fence is worth the weight

The upstream's ingest is the only place an offer is scrubbed against the upstream's
denylist, reviewed as untrusted data, deduped, and lane-checked. A self-merged offer
skips **all four** while still producing an `ingest_disposition` receipt that reads
as though they ran — an unreviewed change wearing a reviewed change's provenance,
cascading to every sibling consumer that pulls. Worse than an unmerged PR.

## Same-session correction, recorded because it matters more than the fix

Earlier in this session I ingested a downstream Route-A filing (#74) as a
**confirmed CRIT fail-open** in `signing-mutation-guard.js` and ranked it the #1
fix-now item in `SWEEP-2026-08-03.md`. **That was wrong.**

The guard is correct. Its degraded-mode block sits behind the MO-OPT coordination
opt-in gate, so on a coordination-OFF repo it passes through before that block is
evaluated — deliberately, because an absent signing key on a solo repo means
_un-enrolled_, not _degraded_. The harness drove both degraded lanes at a
coordination-OFF `cwd`. Driving the guard against a coordination-ON temp repo
produces exit 2 + `deny` + `[BLOCK]`, exactly as the fixture specifies.

The `npm test` exit 1 was real; the fail-open **diagnosis** was not. I reproduced a
symptom and inferred a cause. The filer's own caveat — "filed as a finding to
verify, not an established regression; my direct invocation may not reproduce the
harness's exact preconditions" — was correct, and I overrode it.

**Reproducing a symptom is not confirming a diagnosis** (`evidence-first-claims.md`
MUST-4). The durable fix is the fixture README now leading with the precondition, so
the next reader driving these by hand cannot re-derive the same wrong conclusion.

## Also landed

- **#75** — `sync-from-canon-fetch.mjs` static `loom_only` import → guarded dynamic
  import; absence collapses into the pre-existing typed error. Sweep confirms the
  class is closed, not just the instance.
- **#76** — `journal-reserve.js` now honors the coordination opt-out like its
  sibling `codify-lease.js`. **This entry exists because of that fix** — the last
  cycle's provenance had to fall back to PR bodies.
- **New finding** (anchored backlog, invisible to memory): the `.codex-mcp-guard`
  suite writes 10 synthetic records per run into the live `violations.jsonl`
  (measured 67 → 77). 55 of this cycle's 87 backlog items were that pollution, and
  they carry no `rule_id`, so they can never drain.

## Open — requires co-owner direction

The self-referential gate **fired Tier-1** (six allowlisted files, enforcement-bearing).
`self-referential-codify.md` Rule 1 mandates a parallel multi-agent
redteam-with-tests round (reviewer + security-reviewer + cc-architect). I ran the
mechanical half only; the adversarial round was **not dispatched**, per a standing
session instruction not to spawn agents unrequested. That is a **named gap, not a
silent skip** — it needs authorization before this proposal reaches loom Gate-1.
