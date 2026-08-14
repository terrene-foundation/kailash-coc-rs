---
type: DECISION
date: 2026-08-14
author: co-authored
project: docker-dev-environment
topic: Five #150 subtractions and six local defects resolve to one class; filed as two root-cause entries, not seven symptoms
phase: codify
verified_id: 548F2C562EB4246D025FA80A70552B124755B685
person_id: null
display_id: jack-hong
tags:
  [
    root-cause,
    derived-not-restated,
    sync-regression,
    gate-a,
    privilege-escalation,
    proposal,
  ]
relates_to: 0025-jack-hong-DECISION-derive-not-duplicate-root-cause
---

# The five subtractions are one loop, and the six defects are one class

## What was decided

Four Step-7b entries appended to `.claude/.proposals/latest.yaml` (122 → 126, zero prior
entries touched, Gate C exit 0 / 0 unverified): two ROOT-CAUSE entries and two instances.
Filing five symptom entries for the five #150 regressions was rejected — it would have
reproduced the defect being reported.

The co-owner's direction was explicit: _"approved, root cause long term fix please."_ The
same directive on 2026-08-13 produced forest item F14. This is its second application.

## The class, and why it is the root cause

Every finding this session has one shape: **a value owned by one authority, RESTATED as a
literal at another surface, with nothing that fails mechanically when the two diverge.** The
failure is always green-while-wrong.

| #   | authority                                                                         | restatement that drifted                                                                 |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | `guard-path-scope.js::PROTECTED_PATHS` (VERSION carries `surfaces:{bash,layer3}`) | `validate-bash-command.js` Layer-1/2 `why` enumerating four files, routing to `/posture` |
| 2   | sync commit history                                                               | `.claude/VERSION::upstream.loom_sha`                                                     |
| 3   | Gate A's actual query                                                             | a hand-rolled reconstruction diverging in four ways                                      |
| 4   | `.gitignore`                                                                      | `burn-down-reporting.md` MUST-3 asserting "the gitignored `.wave-tracker.d/`"            |
| 5   | the offer's own `template_version`                                                | its contradictory `base_version: 2.45.5`                                                 |
| 6   | one fact                                                                          | its copy in a second artifact — `0025`, nine of eleven validate-emit failures            |

Instance 6 is the decisive one. That work landed 2026-08-12, before PR #155 was read, and its
remediation — GENERATE the dependent copy (`gen-claude-md-sections.mjs`), delete the
authorship that drifts — **is** the offer's prescription, reached independently. The offer did
not teach us the class; it named a class we had already paid for.

That is why `derived-not-restated.md` is filed as the fix rather than as one more entry.

## The second root cause: the revert loop

A local correction to a synced artifact is Class-A non-durable, and the Gate-1 entry that
would make it durable can sit STILL-OPEN indefinitely. Nothing stops the next Gate-2 sync from
shipping the canonical copy that lacks the fix.

This manifest already carried two entries whose own reconciliation text reads _"reverted once
by an inbound sync and manually restored."_ PR #150 makes `upstream-issue-hygiene.md` MUST-4
**occurrence two** (`grep -c 'Open, Never Complete'` → ours 3, incoming 0, against a control
heading present in both at 1/1).

On the security surface the cycle is complete, and it is worth stating in order:

1. Sync `52ee39e` **introduced** the forged-authorization channel — issue #113 records `git log -S`
   naming that sync sole introducer of `readRepoClass` and its sink.
2. This template **closed** it locally with a positive charset allowlist.
3. Inbound #150 **removes** the allowlist.

Introduce → fix → remove. The proposal asks for the only surface that sees both halves: Gate-2
must not ship a file a STILL-OPEN entry names in the reverting direction.

## What settled R5, after two sessions could not

Two prior sessions left the `cross-repo-authorize` cluster UNRESOLVED because they reasoned
from keyword counts, and recorded honestly that a lexical match is not a verdict on a semantic
property. The settlement was behavioral: this repo's own committed fixture suite, run against
both binaries through its `TOOL=` seam.

- control (ours): **PASS 47 / FAIL 0**
- experiment (incoming): **PASS 34 / FAIL 13**

The falsifying result was named first: had the incoming tool held the same controls, it would
have scored 47/0 exactly as ours did. The suite's own header carried the trap that would have
produced a false verdict — the tool resolves `violation-patterns.js` relative to its own
location, so a `/tmp` extraction reds T7–T11 for reasons unrelated to the sync.

## Gate A cannot do what it claims

The 62-file "SYNC-ONLY, therefore safe" bucket is refuted at the source, not by argument.
`had_local=1` is set only on a NON-sync subject and the file-level gate depends on it — so Gate
A flags a file **only if it already found a non-sync commit**, making "every authoring commit is
a sync commit" false by construction for all 84 flags. The cap is handed to `git log` before the
subject filter, so it bounds all commits rather than local ones. Scope is `.claude/` only: 252 of
600 changed files received zero checking.

Underneath sits a category error worth naming separately: the premise reasons from
**provenance** to **safety**. Loom shipping a control in sync N and removing it in sync N+1 has
sync-only authorship at every step. That is the shape of all five regressions.

## Two corrections to the record

**Withdrawn.** The guard "fires on paths outside the repo, therefore over-reaches" finding is
wrong. `guard-path-scope.js` documents the suffix fallback as deliberate fail-closed behaviour
for a path in no repository. The mechanism description was right; the disposition was not.

**Narrowed.** The guard misattribution is real but confined to the Layer-1/2 branch. The
Layer-3 branch names `.claude/VERSION` correctly and cites #1399. One change updated one copy.

## Alternatives rejected

- **File five symptom entries for the five regressions.** Rejected: four of the five surfaces
  already carry entries (2 each for the adapters and `cross-repo-authorize`, 1 for MUST-4).
  Filing more would duplicate, and would leave the loop that reverts them unaddressed.
- **Re-apply the fixes locally.** Rejected: Class-A non-durable. MUST-4 has already been
  restored once and reverted again; a third pass is the same bet at worse odds.
- **Merge #150 and file the regressions after.** Rejected: ships a known privilege escalation
  on the promise of a later fix.
- **Patch the guard's four-item string to five.** Rejected: that is the symptom fix, and it
  re-arms the same drift on the next registry row. The fix is to derive the list.

## For Discussion

1. The revert-loop proposal couples Gate-2 to per-target proposal state — a new dependency
   direction for the distributor. If loom declines it as too invasive, what is the fallback
   that does not reduce to "this template re-applies the fix every sync forever"? The
   `ACK-DISCARD:` precedent suggests per-file acknowledgement, but that still requires the
   distributor to read the target's manifest.
2. **Counterfactual:** had the fixture suite not existed, R5 would still be UNRESOLVED — the
   lexical route had already failed twice. What other clusters in this manifest are sitting at
   UNRESOLVED for the same reason, and which of them have a suite that could settle them by
   execution rather than by grep?
3. Instance 6 (`0025`) found nine of eleven validate-emit failures were one duplicated fact,
   and the standing response had been to add another parity check. There are now ten such
   checks. If `derived-not-restated.md` lands, does the correct follow-up **delete** parity
   checks whose facts become derived — and who decides which of the ten are then dead code?
4. Gate A's `.claude/`-only scope left 252 of 600 files unchecked on this sync. Those are the
   `.coc/`, `.codex/` and `.gemini/` derived trees, which are _emitted_ rather than authored.
   Is discard-checking on a derived tree meaningful at all, or is the right fix to verify the
   emitter's inputs and stop scanning its outputs?
