# journal-reserve-coordination-gate

Regression lock for `journal-reserve.js::reserveJournalSlotSigned`'s coordination
gate — issue #76, **and** the failure that #76's own fix re-opened one path over.

Run: `node .claude/audit-fixtures/journal-reserve-coordination-gate/run.mjs`
(exit 0 = pass, exit 1 = fail). No CI runner invokes it; like its sibling
`upflow-open-never-complete`, this tier is **committed-fixtures-manually-driven**,
not a live gate. Stated plainly rather than described as "blocking".

## The predicate under test

```js
isCoordinationEnabled(resolveMainCheckout(repoDir) || repoDir);
```

Both halves are load-bearing, and each has already failed once:

| Half dropped                                             | Failure                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| the gate entirely (`requireSigningIdentity` hard-true)   | a coordination-OFF repo cannot satisfy `/codify`'s mandatory journal receipt — the sibling `codify-lease.js` degrades cleanly while this one hard-fails on a null `person_id`. **Issue #76.**                                                                                                                                              |
| `resolveMainCheckout` (reading against the worktree cwd) | the tier-2 override `.claude/learning/coordination-mode.json` is GITIGNORED, so it is ABSENT inside a worktree — a tier-2-enrolled repo resolves OFF here while `journal-write-guard.js` reads it ON from main. No record reserved, then the Write halts for "slot unreserved". **#76's own failure class, re-opened by the fix for #76.** |

The second was caught by a Tier-1 redteam and shipped with **no fixture**. A
later adversarial round flagged that absence (`cc-artifacts.md` Rule 9 — a
security-relevant predicate ships with its fixtures). This directory is the
answer to that finding.

## Mutation results — measured, not asserted

Each mutation was applied in an isolated `cp -R` sandbox; the working tree was
never mutated.

| Mutation                                                                                                         | Cases redded                                                      |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| replace `isCoordinationEnabled(resolveMainCheckout(repoDir) \|\| repoDir)` with `isCoordinationEnabled(repoDir)` | exactly 1 — `coordination-on/worktree/resolves-main-not-worktree` |
| `requireSigningIdentity: false` (drop the gate open)                                                             | 2 — both `coordination-on/*` cases                                |
| `requireSigningIdentity: true` (revert the #76 fix)                                                              | exactly 1 — `coordination-off/main/unsigned-identity-accepted`    |

Every case is redded by at least one mutation, and the suite is **bipolar** — it
carries both a refusal polarity (coordination ON must refuse an unsigned
identity) and a permissive one (coordination OFF must still accept it). A
refusal-only suite cannot detect over-tightening, which is precisely what
reverting #76 looks like.

## The first cut of this fixture was vacuous

Recorded rather than quietly fixed, because it is the same class the fixture
exists to lock.

The two coordination-ON cases originally asserted only `r.ok === false`. Under
the hard-`false` mutation they stayed **green** — the call still returns
`ok:false`, but at `step: "emit:identity"` (the emitter catching the unsigned
identity downstream) rather than `step: "reserve"` (the gate). Both are
`ok:false`, so the assertion was consistent with the gate working _and_ with the
gate being disabled — no information (`instrument-discipline.md` MUST-1).

The cases now pin `step === "reserve"`. That is what makes the mutation red, and
what makes a green here evidence.

**Lever:** the injected identity carries `display_id` but no signing fields. It
is accepted when the gate resolves OFF and refused when it resolves ON, so the
same input yields opposite results either side of the predicate.
