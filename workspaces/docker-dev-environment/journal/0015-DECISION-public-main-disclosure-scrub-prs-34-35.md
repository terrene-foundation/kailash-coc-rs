---
type: DECISION
date: 2026-05-28
created_at: 2026-05-28T15:50:00Z
author: co-authored
session_id: continue-from-2026-05-28
session_turn: 2
project: docker-dev-environment
topic: Q2 — public-main disclosure scrub via dedicated PRs #34 + #35
phase: implement
tags:
  [
    security,
    disclosure-scrub,
    defense-in-depth,
    must-4-same-class-fix,
    redteam-convergence,
  ]
---

# 0015 — DECISION — Q2 closure: public-main disclosure scrub via PRs #34 + #35

## Operator directive

> "continue from last session, /autonomize in parallel and /redteam to convergence"

Operator then selected the recommended target via AskUserQuestion:

> "Q2: settings-leak scrub PR on main (Recommended)"

## Scope and outcome

Two atomic PRs landed on `origin/main` (4069a8d3, 2026-05-28T15:45Z):

| PR  | Merge SHA  | Scope                                                                                                          | Outcome                                                                                                 |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| #34 | `816b3e48` | `.claude/settings.json` operator-absolute-paths + (Python)→(Rust)                                              | Cherry-picked commit `4475933` from feat branch onto fresh `fix/` branch off main                       |
| #35 | `4069a8d3` | `.gitignore` operator-local sibling coverage + `git rm --cached` of active leak `ci-runners.operator.local.md` | Surfaced via Round 1 security-reviewer same-class sweep on PR #34; expanded via Round 1 sweep on PR #35 |

## How the autonomous-execution.md MUST-4 chain played out

PR #34 carried the originally-known leak (the local scrub commit `4475933` that the previous session staged but never opened as a standalone PR). PR #34's Round 1 security-reviewer flagged `MED-L1` (`.claude/operator-id`) + `MED-L2` (`.claude/logs/`) as latent same-class gaps fitting one shard budget. Per `rules/autonomous-execution.md` MUST Rule 4 (Fix-Immediately When Review Surfaces A Same-Class Gap Within Shard Budget), these landed as PR #35 in the same session — NOT a follow-up issue.

PR #35's Round 1 then surfaced a CRITICAL escalation: `.claude/rules/ci-runners.operator.local.md` was **already tracked on public main** since 2026-05-22 (commit `ffee6f7`) carrying ~19 operator-identity tokens (enterprise org slug + runner hostnames + launchd service label) despite its own preamble declaring "Gitignored — never committed, never synced." Plus two additional same-class siblings (`.claude/bin/loom-links.local.json` + `.claude/bin/repin-targets.local.json`) whose `.local.example.json` schemas direct operators to populate the gitignored sibling. Plus `.claude/worktrees/` uncovered. All four landed in PR #35's amendment commit (`e89fe31`) — same-shard, narrow per-dir patterns chosen to avoid over-ignoring audit-fixtures under `.claude/audit-fixtures/**/*.operator.local.*` that are intentionally tracked.

## Round history (receipt per verify-resource-existence MUST-4)

| Phase  | Half              | Verdict                                | SHA reviewed |
| ------ | ----------------- | -------------------------------------- | ------------ |
| #34 R1 | reviewer          | APPROVE clean                          | `6171833`    |
| #34 R1 | security-reviewer | APPROVE-WITH-CONCERNS (2 latent → #35) | `6171833`    |
| #35 R1 | reviewer          | REQUEST-CHANGES (4 findings)           | `6ae8c2f`    |
| #35 R1 | security-reviewer | REQUEST-CHANGES (3 HIGH siblings)      | `6ae8c2f`    |
| #35 R2 | reviewer          | APPROVE                                | `e89fe31`    |
| #35 R2 | security-reviewer | APPROVE                                | `e89fe31`    |

Convergence reached at PR #35 R2 (both halves APPROVE same SHA). Agent task IDs captured in transcript; SHAs are the durable cryptographic receipt.

## User-flow walk receipts (scrubbed per user-flow-validation MUST-6)

**Authoritative surface = `origin/main` after both merges (`4069a8d3`).** Verified via fresh-clone simulation:

```
$ git show origin/main:.claude/settings.json | grep -c '/Users/<operator>'
0
$ git show origin/main:.claude/settings.json | grep -c '(Python)'
0
$ git show origin/main:.claude/settings.json | grep '"description"'
  "description": "Kailash COC (Rust) - Claude Code hooks configuration",

$ git ls-tree origin/main .claude/rules/ci-runners.operator.local.md
(empty — file removed from tracked tree)

$ git -C <fresh-clone> check-ignore -v --no-index --stdin <<EOF
.claude/operator-id
.claude/logs/coc-telemetry-autocommit.log
.claude/rules/ci-runners.operator.local.md
.claude/bin/loom-links.local.json
.claude/worktrees/agent-1/x
EOF
.gitignore:65:.claude/operator-id           .claude/operator-id
.gitignore:66:.claude/logs/                 .claude/logs/coc-telemetry-autocommit.log
.gitignore:75:.claude/rules/*.operator.local.md  .claude/rules/ci-runners.operator.local.md
.gitignore:76:.claude/bin/*.local.json      .claude/bin/loom-links.local.json
.gitignore:79:.claude/worktrees/            .claude/worktrees/agent-1/x
```

Schemas + audit fixtures verified NOT ignored:

- `.claude/rules/ci-runners.operator.local.example.md` → no match (preserved)
- `.claude/bin/loom-links.local.example.json` → no match (preserved)
- `.claude/audit-fixtures/.../variants/rs/rules/ci-runners.operator.local.md` → no match (preserved)
- `.claude/audit-fixtures/.../bin/loom-links.local.json` → no match (preserved)

Disposition: fresh-clone operators see the targeted paths auto-ignored. The session-start hook will no longer flag these as drift on a clean clone.

## Caveats

1. **Defense-in-depth, NOT durable.** `.claude/settings.json` AND `.gitignore` are emitted/regenerated by the upstream emitter on every downstream `/sync`. The next sync cycle WILL re-introduce the operator-path leak unless the upstream emitter source is corrected. That fix is F5 (user-owned, externally gated on a loom session per `rules/repo-scope-discipline.md`). This session's PRs scrub the public record NOW; F5 closes the regression vector.

2. **Local `feat/docker-dev-environment` is not yet rebased onto main.** The branch is now 11 ahead / 5 behind main (feat's own work + the two scrub PRs). The previous session noted "rebase before opening the feat PR once loom #387 closes." Rebase is a clean fast-forward of the scrub PRs onto feat (different files entirely).

3. **`ci-runners.operator.local.md` removed from index, retained on operator disk.** `git rm --cached` removes from the tracked tree; the file stays available locally for the operator's runner protocols. The CI runbook in `ci-runners.md` already references the generic placeholder schema; the operator-local values live in the gitignored sibling.

## Brief-corrections / forest-ledger update

- **F5** (loom-side gates): expanded scope — durable upstream-emitter fix for `.claude/settings.json` AND `.gitignore` operator-local sibling coverage now both belong to F5. Filing additional loom-side concerns is BLOCKED by `rules/repo-scope-discipline.md` (cross-repo write); user-owned.
- **New closed item** (not previously in ledger): `ci-runners.operator.local.md` as a tracked-on-main leak — discovered + closed in same session via PR #35 R1 sweep.

## For Discussion

1. **Counterfactual — should the audit-fixture re-include pattern be added defensively?** The narrow `.claude/rules/*.operator.local.md` + `.claude/bin/*.local.json` patterns work TODAY because audit-fixtures live at `.claude/audit-fixtures/**` (different prefix). If a future emitter change moved fixtures under `.claude/rules/` or `.claude/bin/`, the patterns would silently start over-ignoring them. Is the durable defense (a) keep narrow patterns + name the dependency in the .gitignore comment (current state), (b) add `!.claude/audit-fixtures/**` re-include defensively, or (c) move to broad `**/*.operator.local.*` + explicit `!.claude/audit-fixtures/**`?

2. **Data — Round 1 surfaced 4 new same-class gaps; what does that say about the per-session capacity budget for security scrub PRs?** The original PR #34 carried 1 finding (the known leak). R1 expanded to 5 total findings, all same-class. Per `rules/autonomous-execution.md` MUST-4 "Fix-Immediately when Review Surfaces a Same-Class Gap Within Shard Budget" — should security scrub PRs default to a longer R1 reviewer prompt that explicitly enumerates the full same-class sibling sweep (operator-id / logs / _.operator.local._ / \*.local.json / worktrees / sessions / cache / state) up-front, rather than discovering siblings round-by-round? Trade-off: longer prompt up-front vs more reviewer rounds.

3. **Should the loom-side F5 fix include a CI assertion that no `/Users/<anything>/repos/` paths appear in any synced `.claude/` artifact?** The `scan-synced-disclosure.mjs` tool exists for exactly this (per the audit-fixtures we just confirmed). Is it currently wired into a CI gate, or only invoked manually at sync-time? If manual, a CI gate would convert this disclosure class from "operator vigilance" into "structural impossibility."

## Receipts

- PR #34 merged: `816b3e48` (2026-05-28T15:34:56Z)
- PR #35 amendment: `e89fe31` (post-R1 R2-convergent SHA)
- PR #35 merged: `4069a8d3` (2026-05-28T15:45:17Z)
- Origin/main HEAD post-merge: `4069a8d3`
- Pre-existing leak file: blob `4b6bb7d` at `.claude/rules/ci-runners.operator.local.md`, introduced commit `ffee6f7` 2026-05-22 — REMOVED from tracked tree at merge
- Walk receipts: § "User-flow walk receipts" above (5 patterns matched against fresh-clone simulation; 0 drift count for the targeted patterns)
