---
slot: "0002"
type: AMENDMENT
display_id: jack-hong
verified_id: unavailable-coordination-disabled
person_id: unavailable-coordination-disabled
date: 2026-08-03
topic: upflow fence derivation supersedes selfRepoRef
relates_to: "0001"
---

# AMENDMENT — journal/0001's structural description is superseded

`journal/0001` is the receipt for the MUST-4 ("Open, Never Complete") codify
cycle. It was written and committed at `b14d940`, **before** three Tier-1 redteam
rounds rewrote the structural half of the fix. Journals are append-only
(`journal.md` MUST NOT), so 0001 stands as written and this entry records what
has since changed. Anyone reading 0001's § Structure or § Fixtures should read
this first.

## What 0001 says that is no longer true

- **§ Structure (lines 54-57)** describes "a fail-closed `selfRepoRef` fence on
  `completeUpflowPR` in BOTH adapters … Absent or malformed `selfRepoRef`
  refuses." **There is no `selfRepoRef` field.** A Tier-1 redteam found that
  shape compared two operands off the same caller-authored object, so
  `{repoRef: X, selfRepoRef: X}` cleared it trivially.
- **§ Fixtures (line 62)** says "7 cases". The suite is now **22**.

## What replaced it, and the honest bound

The identity is DERIVED, not accepted. `hooks/lib/upflow-self-repo.js::
deriveSelfRepoRef` reads the live `git remote get-url origin` as the sole
authoritative source — routed through `git-subprocess-env.js` so an ambient
`GIT_DIR` cannot redirect it — with `.claude/VERSION::repo` demoted to a
refuse-only cross-check that can never SUPPLY an identity. The host is checked
against a closed per-provider set, ADO org/project/repo are all parsed from the
remote, and both adapters build the request path from the DERIVED identity so
the value compared and the value used are the same bytes.

**The bound 0001 did not state, because the correction had not happened yet:**
removing the parameter seams did NOT make the operand unauthorable. The identity
derives from `process.cwd()`, which is selected by whoever launches the process.
A scratch tree whose `origin` points at the upstream derives that upstream and
clears the fence. So the fence CLOSES the accident class — an agent following
stale prose is refused before the transport fires, and that accident IS the
originating incident — and RAISES THE COST of a deliberate act. It is NOT a
boundary against a caller that can choose its own working directory, and cannot
be: a caller able to run arbitrary in-process code can replace the module.

## Why this amendment exists at all

The caller-authored operand MOVED FOUR TIMES before it was removed —
`selfRepoRef` → `_deriveSelfFn` → `prRef.cwd` → `process.cwd()` — and after each
removal the prose asserted the CLASS was closed rather than the instance. That
over-claim recurred on **six** surfaces across three rounds: the rule, both
adapter docstrings, `sync-flow.md`, the fixture files, and
`.claude/.proposals/latest.yaml`. Each round fixed the surfaces it looked at and
missed one. 0001 is the last of them, and the only one that cannot be edited.

A second class recurred five times: a comparison leg or guard that no fixture
case could distinguish, so deleting it left the suite fully green — ADO `org`,
GitHub `owner`, ADO `project`, the `GITHUB_HOSTS` check, and the `#`/`?`
authority truncation. Three were found only by exhaustive predicate enumeration;
hand-picked mutation missed them repeatedly. Two of them were themselves fixes
from a PREVIOUS round, shipped with no instrument.

Both classes share a root worth recording: **a green suite and confident prose
are compatible with a control that does nothing.** The defenses that actually
caught these were mutation-with-an-applied-check and enumerating the whole
predicate set rather than the predicates someone thought of.

## Receipts

Round-by-round findings, the per-mutation verdicts, and the live-vs-sandbox
provenance for each measurement are in
`.claude/audit-fixtures/upflow-open-never-complete/README.md` § Mutation
validity (six passes). The rule's own § Origin records the three prose
corrections in sequence.
