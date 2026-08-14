# 0032 — AMENDMENT — F15 withdrawn (0029 already discharged it, and rejected the split); Tier-1 redteam dispositions

**Type:** AMENDMENT · **Date:** 2026-08-14 · **Phase:** 05-codify · **Status:** applied
**relates_to:** 0031-jack-hong-DECISION-agent-result-delivery-second-mode

**verified_id:** 548F2C562EB4246D025FA80A70552B124755B685 · **display_id:** jack-hong

Amends `0031`, which is immutable (the journal-write-guard blocked an in-place edit —
correctly; that is the rule working).

## Correction 1 — `0031` Decision 3 is WRONG. The (a') WAS discharged, by `0029`.

`0031` states: _"`0028` fired Rule 11 and recorded disposition (a') as 'owed, not
discharged.' It was not discharged."_

**False.** `journal/0029-jack-hong-DECISION-wiring-is-39pct-of-baseline.md`, dated the same
day, is a complete (a') discharge on the identical `(agents.md, baseline)` lane, carrying all
four Rule-11 sub-elements, and a matching manifest entry was filed alongside it.

I asserted non-discharge after checking `0028` and the manifest but never reading `0029` —
two journal slots before the one I was writing. That is the same "checked against a corpus
that could not hold the record" error `0028` documents about itself, repeated one slot over.
The structural validator found it independently.

## Correction 2 — F15 is WITHDRAWN. It recommended the option `0029` had already rejected.

F15 (filed in `0031`) recommended **SPLIT**. `0029` rejects exactly that:

> **Split `agents.md` into sibling baseline rules** — two `scope: baseline` rules emit the
> same total bytes as one. Relieves nothing on the axis Rule 10 gates, and fragments the
> orchestration contract every delegation consults.

That is correct and I have no counter-evidence. A split relocates bytes between files without
reducing always-on emission, which is the only axis Rule 10 measures. F15 also "rejected"
DEMOTE — which `0029` had likewise rejected — so the single alternative F15 weighed was
already disposed of, while the option `0029` actually recommended went unmentioned.

**F15 is withdrawn, not downgraded.** Two contradictory corpus dispositions for one lane,
filed the same day in the same tree, is worse than either alone: a Gate-1 reader would have
no way to tell which governs.

**The governing disposition is `0029`'s:** route `## Trust Posture Wiring` blocks to the
skill/reference channel rather than the always-on baseline (Rule 11's fourth option), on the
measurement that wiring is 44,666 of 112,816 baseline bytes — 39.6% — with `agents.md` itself
at 72%.

**This cycle CORROBORATES `0029` rather than competing with it**, and the corroboration is
strong: `0029` predicted `agents.md` would keep re-triggering Rule 10 _because_ every new MUST
drags a baseline-emitted wiring block with it. One day later, this change's +1,705 B is
majority wiring-block edits, not clause body. The prediction held within 24 hours.

## Correction 3 — the proximity-band citation in `0031` is doubly-unrun

`0031` cites `validate-proximity-band.mjs` for the Rule-10 disposition. The tool ALSO printed
`proposal diff: 0 total MUST/MUST NOT/BLOCKED additions` — and at that moment `HEAD`, `main`,
and `origin/main` were all `e26d788`, so it diffed an **empty range**. That `0` is an artifact
of the change being uncommitted; it would read identically had I added twenty MUST clauses.

The Rule-10 conclusion still stands, because the emit-dry-run leg fails independently
(validator-16 halts before `validateAggregateHeadroom`, verified directly). But the
diff-side half of the predicate was never measured, and `0031` does not say so.

## Tier-1 redteam dispositions (three arms, all delivered)

Two arms independently reached the same highest-severity finding. Every item below was FIXED
in this cycle, not deferred.

| #   | Finding                                                                                                                                                             | Arm                                       | Disposition                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | **Discriminator confounded.** Keying recovery on "was a report written" contradicts the file's own headline that `toolUseId` decides delivery; two variables covary | correctness + adversarial (independently) | FIXED — re-keyed on the RETURN PATH; it is also the only variable observable at decision time              |
| 2   | **Untested quadrant given a verdict.** Named-and-stalled was never measured                                                                                         | correctness                               | FIXED — marked UNTESTED explicitly; no verdict inferred                                                    |
| 3   | **Mode-1 mechanism may be wrong.** A named agent WITH a `SendMessage` instruction delivers, so the failed re-requests may have omitted the reply channel            | correctness                               | RECORDED as a live unrefuted hypothesis with its discriminating experiment named                           |
| 4   | **Unbounded resume = convergence hole.** fragment → resume → fragment → "this one has findings, clean" was fully sanctioned                                         | adversarial                               | FIXED — ONE resume per lane; acceptance test; UNRESOLVED items are OPEN FINDINGS and do not count clean    |
| 5   | **Agent-triggerable scope relaxation.** A subagent could name a BRIEF constraint as its blocker and the sanctioned reply marks it optional                          | adversarial                               | FIXED — release only a SELF-ASSIGNED sub-goal; a brief item ESCALATES. Now in the RULE, not only the skill |
| 6   | **DELIVERY GATE overreach.** Unbounded "a fragment is zero evidence" would flag a terse "CLEAN — no findings" and invert the clean-round counter                    | correctness                               | FIXED — a fragment is defined by announcing work TO COME, not by brevity                                   |
| 7   | **Severity field stale.** Still tested "returned a payload" — the test this extension declares too weak; both instances would have PASSED gate-review               | correctness                               | FIXED                                                                                                      |
| 8   | **Regression-within-grace rationale false for mode 2** ("recoverable from transcripts" — the report was never written)                                              | adversarial                               | FIXED — scoped to the SPAWN-CONTRACT part, weakness stated                                                 |
| 9   | **Detection (c) over-claimed Phase-1-only** and had no durable artifact                                                                                             | correctness + adversarial                 | FIXED — correct home named (`PostToolUse` on the delegation tools); ledger transition now required         |
| 10  | **NO PROPOSAL APPEND — the fix would not cascade.** `.claude/**` here is Class-A non-durable; the next `/sync-to-use` deletes it                                    | structural                                | FIXED — two entries appended (127 → 129), verified parse-clean with zero prior entries altered             |
| 11  | **Mode-2 DO/DO-NOT absent**, so the rule's redirect resolved to a file but not a clause                                                                             | correctness + structural                  | FIXED — block added; `^# DO` sweep now 6 in the second-mode section (was 0; control 4 in mode-1)           |
| 12  | Verbatim internal WIP quoted into a cascading skill                                                                                                                 | adversarial                               | FIXED — genericized                                                                                        |
| 13  | "three halves"; stale one-mode self-description                                                                                                                     | all three                                 | FIXED                                                                                                      |

**Not fixed, recorded:** the Rule-10 obligation stays OPEN — this is its third consecutive
cycle. The structural validator's point is accepted: re-citing `0028` a third time turns an
honest fail-closed note into wallpaper. The closing path is not another exception but
**validator-16** (issue 125 — a `coc-use-template` must not carry a local `sync-manifest.yaml`,
and this one does because every sync delivers it). Until that is resolved, no baseline-rule
codification in this repo can measure its own headroom. That is the thing to fix, and it is
loom's.

## For Discussion

1. `0029`'s disposition has now been corroborated by a same-week recurrence it predicted. Does
   that change its priority at Gate-1, or is a 39.6%-of-baseline measurement already past the
   threshold where more evidence changes nothing?
2. Three consecutive cycles have recorded the Rule-10 obligation as open because validator-16
   blocks the measurement. At what point does the unmeasurable-gate itself become the
   higher-priority defect than any rule it is gating?
3. Both redteam arms found the confounded discriminator; neither found the missing proposal
   append — only the structural arm did, and it was outside the scope I gave it. What would a
   scope have looked like that surfaced "does this cascade at all?" from the correctness lens?
