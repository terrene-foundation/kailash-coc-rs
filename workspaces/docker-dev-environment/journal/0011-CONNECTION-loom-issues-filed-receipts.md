---
type: CONNECTION
date: 2026-05-28
created_at: 2026-05-28T01:32:00Z
author: agent
session_id: m2-extensibility-secrets
session_turn: codify-handoff
project: docker-dev-environment
topic: Receipts for the 4 loom issues filed under journal/0010 authorization
phase: codify
tags: [cross-repo-authorized, loom, f5, issue-filing, receipts]
---

# 0011 — CONNECTION — Loom issues filed (receipts for 0010 authorization)

References authorization receipt: `journal/0010-DECISION-cross-repo-authorized-loom-issues.md`.

## Filed (4/4)

| Draft | Loom issue                                            | Title                                                                                                                   |
| ----- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A     | https://github.com/esperie-enterprise/loom/issues/386 | `chore(emitter): scrub /Users/... operator paths from kailash-coc-* settings.json emission + correct rs template label` |
| B     | https://github.com/esperie-enterprise/loom/issues/387 | `feat(sync): add Dockerfile + docker-compose.yml + bin/dev + overlay scaffolds to template-owned preserve-list`         |
| C     | https://github.com/esperie-enterprise/loom/issues/388 | `feat(templates): mirror multi-CLI Docker dev environment to kailash-coc-py (+ kailash-coc-rb if present)`              |
| D     | https://github.com/esperie-enterprise/loom/issues/389 | `fix(README): replace stale 'kailash-rs' references with 'kailash-enterprise' in kailash-coc-* README emission`         |

## Dedup pre-check (per journal/0010 bounded action)

Ran `gh issue list --repo esperie-enterprise/loom --state open --limit 100` plus four targeted `--search` queries before any `gh issue create`. Zero overlap with the 4 drafts. The 5 currently-open `deferred`-labeled loom issues (#181 / #353 / #367 / #371 / #382) are unrelated scope.

## Lane disposition

Each of the 4 maps to one sub-item of F5/#32 in the workspace forest ledger:

- A → "durable settings-leak fix at the emitter"
- B → "Docker preserve-list (FR-20)"
- C → "cross-template mirror (NFR-10)"
- D → "README fix at source"

F5/#32 is therefore now FILED (not yet CLOSED). The original "#32" placeholder in `.session-notes` is superseded by the concrete loom issue numbers; updated in this commit.

## Ordering implications (for the user's planning)

Issue B is the **time-sensitive gate** for landing the consumer's M2 feat-branch PR — without B closed, the next `/sync rs` clobbers the Docker artifacts. The consumer-side mitigation (defer post-merge `/sync rs` until B closes) is workable but fragile.

Issue A is the **highest-leverage durable closure** for the disclosure leak class — the local scrub at commit `4475933` is interim only; the durable fix is loom-side.

Issues C and D are quality-of-life follow-ups with no consumer-PR blocking semantics.

## For Discussion

1. **Counterfactual:** if A closes but B does not (loom prioritizes the visible disclosure over the silent clobber risk), the consumer's M2 PR is no safer to land than it is today. Should the consumer comment on B to surface its PR-blocking semantics, or trust loom prioritization?
2. **Data check:** the dedup pre-check used `gh issue list --search` — that scans titles + bodies. A loom issue whose TITLE doesn't mention "Docker" but whose body references the same artifacts could be missed. Acceptable risk for this filing batch (4 narrow titles); flag if a future batch is broader.
3. **Receipt mechanism:** this entry IS the agent-readable receipt for journal/0010's "## For Discussion #3" question — the filed issue numbers are journaled (here) AND will land in `.session-notes` for next-session pickup. Sufficient traceability?
