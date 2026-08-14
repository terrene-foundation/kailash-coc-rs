# 0031 — DECISION — The delivery gate missed a third mode, and agents.md has now taken three Rule-10 additions in 27 days

**Type:** DECISION · **Date:** 2026-08-14 · **Phase:** 05-codify · **Status:** applied

**verified_id:** 548F2C562EB4246D025FA80A70552B124755B685 · **display_id:** jack-hong

## What was codified and why

`0027`/`0028` codified the agent-result-delivery class one day ago. It recurred **twice in this
session** — in a mode neither existing half covers, and the recurrence is the evidence.

Both lanes were spawned CORRECTLY (no `name`, `toolUseId` present) and both notifications
carried a real `result` field. What arrived was a status fragment where the findings belonged:

- `"readPosture needs a real checkout. Building git-backed harnesses with a planted L3 posture."` — after 16 tool calls
- `"Now the adversarial fuzz the lost lane never finished: what does the narrowing let through?"` — after 85 tool calls

Both read as delivered lanes on every surface. This is neither existing half:

- NOT the SPAWN CONTRACT failure — nothing was named.
- NOT the DELIVERY GATE as written — "a lifecycle/idle notification is NOT a delivery signal"
  does not reach a payload that EXISTS and is merely a progress line.

| Artifact                                                  | Action | Why there                                                         |
| --------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `rules/agents.md` § Agent-Result-Delivery                 | modify | Extends the DELIVERY GATE + adds a RECOVERY half (+1,705 B)       |
| `skills/30-claude-code-patterns/agent-result-delivery.md` | modify | The depth: second-mode measurement, the two-mode table (+3,211 B) |

## Decision 1 — the resume finding CONTRADICTED the skill's own BLOCKED corpus, and the resolution is a scope, not an override

The skill already listed **"I'll just ask it again with SendMessage"** as BLOCKED —
_"a re-request to an agent that ALREADY ended its turn under the task contract returns nothing
again — tried twice, failed twice."_ I measured the opposite twice today: `SendMessage` resumed
both stalled lanes and both delivered in full.

Both measurements are correct. They are different cases, and the discriminator is **whether a
report was ever written**:

|                  | first mode (named agent) | second mode (status fragment) |
| ---------------- | ------------------------ | ----------------------------- |
| report written?  | YES — into the void      | NO — stalled before writing   |
| re-asking it     | returns nothing (2×)     | returns the full report (2×)  |
| correct recovery | read the transcript      | `SendMessage` to resume       |

There is nothing to re-ask for in the first mode; the text is already on disk. In the second the
agent has not finished, so resuming lets it continue. The existing BLOCKED entry is now **scoped
to the first mode** rather than deleted — deleting it would re-open the failure it records.

Recorded because shipping the new finding without this scoping would have put a flat
contradiction into the corpus, and the next reader would have had no way to tell which entry
governed their case.

## Decision 2 — Rule 10 is INDETERMINATE, fail-closed. Following `0028`, not re-deriving it.

`agents.md` is `priority: 0` + `scope: baseline`, so Rule 10's proximity-band gate applies.

- **Measured:** `agents.md` 18,536 → 20,241 B = **net +1,705 B**, no extraction. First cut was
  +2,228 B; compressed by moving the resume procedure into the skill (skill-channel, not
  baseline) — the depth lane grew +3,211 B, which is the correct home for it.
- **Path (a) NOT satisfied** — it requires recovering AT LEAST the bytes added; this is net
  positive with no extraction.
- **Path (b) NOT satisfiable** — its sub-fields need a numeric pre/post `headroom_pct`, and
  `emit.mjs --all --dry-run` still cannot reach `validateAggregateHeadroom`: validator-16 FAILs
  first (`class:coc-use-template → manifest FORBIDDEN`, issue #125) and halts.
- **The repo's own instrument was RUN, and it declines to issue a verdict.**
  `validate-proximity-band.mjs` → `emit dry-run: exit=2, 0 lane(s) scanned`,
  `verdict: unrun_no_coverage`, and verbatim: **"THIS RUN IS NOT EVIDENCE."**

So neither path is satisfied. Recorded as an **open obligation for Gate-1**, not as compliance —
the disposition `0028` established one day ago for the identical predicate.

## Decision 3 — Rule 11 FIRES, this is the THIRD invocation in 27 days, and `0028`'s escalation was never discharged

Prior Rule-10-mandated invocations on the (`agents.md`, baseline) lane inside the 30-day window:

| date       | invocation                                | source                                             |
| ---------- | ----------------------------------------- | -------------------------------------------------- |
| 2026-07-18 | § Triad clause, Rule-10 paired extraction | `agents.md:117` Origin, `journal/0543` (loom-side) |
| 2026-08-13 | § Agent-Result-Delivery clause            | `journal/0028`                                     |
| 2026-08-14 | **this change**                           | this entry                                         |

`0028` fired Rule 11 and recorded disposition (a') as **"owed, not discharged."** It was not
discharged. So this is not a fresh firing — it is a **compounding** one, and Rule 11's BLOCKED
corpus names exactly this shape: _"We can keep applying Rule 10 indefinitely as long as each
invocation balances."_

Taking disposition **(a') corpus-level review**, and discharging it here rather than deferring a
third time. Forest item **F15** filed below with all four mandatory sub-elements.

### F15 — corpus-level review of `agents.md`

**(i) Recommended disposition — SPLIT.** `agents.md` carries three separable concerns:
delegation/specialist-selection, parallel-execution + worktree orchestration, and gate/review
discipline (redteam dispatch, correctness-vs-security, result delivery). The gate/review cluster
is the one absorbing every recent addition (2026-07-18, 08-13, 08-14 are all in it). Recommend
splitting the gate/review cluster into a sibling rule sharing the orchestration glob.

**(ii) Alternative considered and rejected — DEMOTE to `path-scoped`.** Rejected: the delegation
and parallel-execution halves are genuinely always-on (they govern the FIRST dispatch decision of
a session, before any file is touched, so no `paths:` glob fires in time). Demoting the whole rule
would make the always-on half unreachable — the exact reachability failure `issue-triage-routing.md`
was created to fix. A split keeps the always-on half baseline and moves only the gate/review
cluster, which fires at gate time when a glob CAN match.

**(iii) Both triggering Rule-10 invocations:** `journal/0028` (2026-08-13) and this entry,
`journal/0031` (2026-08-14); the 2026-07-18 § Triad invocation is journaled loom-side at
`journal/0543` and is cited from `agents.md:117` rather than from a local entry — the local
`journal/` tree structurally cannot hold it, which is the check `0028` got wrong.

**(iv) Value-anchor (source (d), literal user quote, this session):** _"continue from last
session, keep parallelized fleet full at all time, do not idle."_ `agents.md` IS the rule that
governs keeping the fleet full — and this session's two lost lanes are precisely the failure it
governs. A rule too budget-saturated to absorb its own recurring lessons cannot serve that
directive; every future orchestration finding hits the same gate. The split delivers user value
by making the orchestration corpus extensible again, not by tidying it.

## Instruments that failed first, recorded

- **The proximity-band measurement is unobtainable, not skipped.** Stated with the verbatim
  `unrun_no_coverage` output rather than as an assumed pass.
- **A per-function `awk` leaked the whole-file count**, reporting an identical figure for five
  distinct functions. Identical counts across distinct subjects is the tell; re-instrumented with
  a declaration-line index and controlled against two pure predicates that correctly return 0.
- **`gh api pulls/N/files --status=removed` is rename-blind** — reported 7 deletions where
  `git diff --no-renames --diff-filter=D` finds 8.
