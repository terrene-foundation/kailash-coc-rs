# 0026 — DISCOVERY — A required check must be able to report on every PR

**Type:** DISCOVERY · **Date:** 2026-08-12 · **Phase:** 05-codify · **Status:** applied

**verified_id:** 548F2C562EB4246D025FA80A70552B124755B685 · **display_id:** jack-hong

## The finding

**A `paths:`-filtered workflow cannot be a required status check.** It reports on some PRs and not others, and a required context that never reports leaves the PR parked at _"Expected — waiting for status to be reported"_ — not failing, not passing, with nothing to fix.

Measured rather than reasoned:

| PR                     | touched the manifest? | Gate C check runs |
| ---------------------- | --------------------- | ----------------- |
| #133 (journal cleanup) | no                    | **0**             |
| #135 (manifest edit)   | yes                   | 1                 |

Registering Gate C as-is would have parked every PR in this repo that doesn't touch `.claude/.proposals/latest.yaml` — which is most of them.

## Why this had been misdiagnosed for days

Across several sessions the disposition on Gate C was _"it's young and has had two defects — let it run a few more PRs first."_ That framed a **structural impossibility as a maturity judgement**, and no amount of additional PRs would ever have resolved it. The blocker was one line in the trigger, not confidence.

The generalisation worth carrying: when a gate "isn't required yet" and the reason is a judgement call, check whether it _can_ be required before re-litigating whether it _should_ be.

## The fix, and its ordering constraint

Remove the `paths:` filter, **then** register. Order is load-bearing — registering while the filter is still on `main` is precisely what parks PRs.

A PR that doesn't touch the manifest now gets a genuine `0 → 0` pass rather than a special-cased skip, so the result reads as the same measurement in both cases. The ~1-minute Actions minimum is paid deliberately and buys the gate's self-test running on every PR instead of only on the PRs that touch the gate itself.

**Proven, not assumed:** probe PR #145 touched only `README.md` and Gate C reported and passed. Closed unmerged.

## The same shape, one surface over

`validate` has the identical defect and it is **still live**: its `if:` fires only when the PR base is the default branch, so a stacked PR runs `validate-stacked` instead and `validate` never reports. Bounded by `enforce_admins: false` (admin-merge clears it) and documented in the workflow header rather than only in notes.

Deliberately **not** "fixed" by collapsing the two jobs into one context name — that would reintroduce the base-dependent fail-open the split exists to prevent. A check run is scoped to the head SHA, and that workflow's verdict depends on the base.

## Second discovery, unrelated but same session

**`gh pr merge --delete-branch` deletes the local branch too** — gh 2.97.0's help says _"Delete the local and remote branch after merge"_, and six merges here left zero local branches.

But `git branch -d` **refuses a branch checked out in any worktree**, and keeps refusing after merge:

```
error: cannot delete branch 'X' used by worktree at '<path>'
```

So in a worktree-heavy clone the local delete silently fails and branches accumulate. **Branch reaping is downstream of worktree reaping** (`worktree-isolation.md` Rule 8): reap the worktree first, then the branch becomes deletable.

This refuted an inbound proposal's stated mechanism ("the flag only deletes the remote") while confirming its observation. Recorded because the wrong diagnosis is the intuitive one.

## Receipts

- Filter removal + registration: PR #143; reachability probe PR #145 (closed unmerged)
- Live protection now carries three required contexts — read it live, never from a note
- Worktree/branch finding: PR #141 (relay of inbox offer #140, mechanism corrected at the hop)
