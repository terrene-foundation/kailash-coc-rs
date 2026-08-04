# sync-preflight-local-mods audit fixtures

Per `cc-artifacts.md` Rule 9. Behavioral fixtures for
`.claude/bin/sync-preflight-local-mods.mjs`, the pre-flight report that makes
issue #64's silent loss visible before a `/sync-from-template` runs.

```bash
node .claude/audit-fixtures/sync-preflight-local-mods/run.mjs
# exit 0 = all 18 checks behaved as expected; 1 = a regression
```

Every case builds a synthetic template + consumer pair in `os.tmpdir()` and
removes both. Nothing here touches a real template or a real consumer.

## What is being pinned

`/sync-from-template` promised "a **merge**, not an overwrite" four lines above
specifying "the template version wins" — which IS an overwrite. There is no
three-way merge and no conflict surface; preservation is by PATH CATEGORY only.
The tool does not change that. It answers one question per shared artifact
before the sync runs: _would this discard work someone here authored?_

The load-bearing distinction, and the reason a naive version of this tool would
be useless:

- **DIFFERS + only sync-shaped commits → STALE.** The template moved ahead.
  Replacing it is the sync working correctly. NOT reported as at-risk.
- **DIFFERS + ≥1 consumer-authored commit → AT RISK.** Local institutional
  knowledge is about to be discarded silently.

On a healthy consumer nearly every shared artifact differs, so "differs" alone
flags everything and gets ignored. T2 pins the split for exactly that reason.

## Discrimination — the mutation table

Per `instrument-discipline.md` MUST-2(b), a mutation that does not red leaves
two live hypotheses, so each row below was confirmed APPLIED (non-empty diff)
before its result was read. Re-derive by editing a copy and running with
`TOOL=<copy>`:

| Mutation to `sync-preflight-local-mods.mjs`             | Reds                       |
| ------------------------------------------------------- | -------------------------- |
| drop the local-vs-sync split (`atRisk.push` everything) | T2 ×2, T6, T7 (4 failures) |
| remove the `isPreserved(rel)` exclusion                 | T4                         |
| remove the identical-file `if (same) continue`          | T3                         |
| change the usage-error path to `process.exit(0)`        | T8 ×2                      |
| drop `team-memory/` from `PRESERVED_PREFIXES`           | T5, T9-parity              |
| drop `team-memory/**` from the command's Preserved list | T9 AC4 row                 |

Each mutation reds ONLY its own predicate — that per-predicate precision is what
makes the greens readable.

## The default sync-subject pattern is derived, not guessed

`DEFAULT_SYNC_SUBJECT_RE` classifies a commit as a sync by SUBJECT. The first
cut matched only `chore(sync)` / `chore(coc-sync)` / `sync:` and, run against a
real 25-commit window of this repo, misclassified **59 of 82** differing
artifacts as consumer-authored — because real syncs also land as `chore(coc):`,
`sync(loom):`, `sync(coc):`, `release(coc-template):`, and a one-off
`feat: … first-sync from loom`. Correcting the pattern against observed history
took it to **10 at-risk / 72 stale**, and the residual 10 are genuine local
authorship (`fix(upflow): …`, `chore: fix ungrammatical prose …`).

Re-derive the shapes for another repo with:

```bash
git log --format=%s -- .claude/rules/ | sed -E 's/[0-9]+/N/g' | sort | uniq -c | sort -rn
```

A consumer whose sync convention is unrecognized sees its own syncs counted as
local authorship — which **over-reports** (a false at-risk) and never silently
misses a real loss. `--sync-subject-re` is the supported override (T7).

## T9 — the parity test is the anti-recurrence lock

#64 IS a contract stated in two places that drifted. Having fixed it, the same
drift must not reopen between the command's Preserved list and the tool's
`PRESERVED_PREFIXES`. T9 parses the list out of
`.claude/commands/sync-from-template.md` and asserts set equality against the
constant, then asserts `rules/project/`, `commands/project/` and `team-memory/`
are each documented. Both directions were mutation-confirmed above.

## Audience caveat

The intended subject is a CONSUMER (`coc-project`). Run inside a TEMPLATE repo
the tool over-reports by construction — a template's own authoring commits are
genuinely local authorship of files that are, from its perspective, shared
artifacts. Not a defect; worth knowing before reading a large at-risk count as
alarming.
