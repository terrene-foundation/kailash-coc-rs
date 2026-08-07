---
type: DECISION
date: 2026-05-28
created_at: 2026-05-28T01:25:00Z
author: human
session_id: m2-extensibility-secrets
session_turn: codify-handoff
project: docker-dev-environment
topic: User-authorized cross-repo issue filing against esperie-enterprise/loom for F5/#32 work
phase: codify
tags: [cross-repo-authorized, loom, f5, issue-filing, repo-scope-discipline]
---

# 0010 — DECISION — Cross-repo authorized filing: 4 loom issues for F5/#32 work

**cross-repo-authorized: esperie-enterprise/loom**

## Verbatim user directive

> "please file the issues to loom"

## Confirmed scope (per AskUserQuestion approval in-session)

- Target repo (user-confirmed): `esperie-enterprise/loom`.
- Issues to file (user-approved per-issue): **A + B + C + D** (all four drafts).
- Filing flow (user-approved): journal + `gh issue create` per approved item, in this session.

## Bounded action (User-Authorized Exception #5)

The authorized action is `gh issue create --repo esperie-enterprise/loom`
**executed exactly four times**, one per approved draft (A, B, C, D). A single
`gh issue list --repo esperie-enterprise/loom` dedup pre-check precedes the
`create` calls to avoid duplicate filings — this dedup READ is included under
the named action's scope (it is the structural precondition of responsible
filing). No incidental reads of loom source / specs / journals. No edits, no
comments, no PRs, no other repos.

## What is being filed

- **A** — `chore(emitter): scrub /Users/... operator paths from kailash-coc-* settings.json emission + correct rs template label`
- **B** — `feat(sync): add Dockerfile + docker-compose.yml + bin/dev + overlay scaffolds to template-owned preserve-list`
- **C** — `feat(templates): mirror multi-CLI Docker dev environment to kailash-coc-py (+ kailash-coc-rb if present)`
- **D** — `fix(README): replace stale 'kailash-rs' references with 'kailash-enterprise' in kailash-coc-* README emission`

All four bodies were drafted in this session, scrubbed per
`upstream-issue-hygiene.md` MUST-2 (no operator IDs, no workspace paths, no
finding tags, no session-bound timestamps tied to consumer work), presented
to the user verbatim, and approved per-issue via AskUserQuestion.

## What is explicitly NOT being filed under this authorization

- The 3 `/codify` candidates from the closure-parity agent (bundler-pin
  discipline, npm-ci-vs-install branch, .dockerignore defense-in-depth) —
  those route via `/codify` proposal origination from this repo per
  `artifact-flow.md`, not direct loom issues; filing them direct would bypass
  Gate-1 classification.
- The Ruby gem ABI defect — already filed at `esperie-enterprise/kailash-rs#1151`
  per session-notes F4; BUILD-repo lane, distinct authorization required if
  any further action is requested.

## Pre-existing F5 / #32 context

Session notes' forest ledger has carried F5 ("loom session: durable
settings-leak fix at emitter + Docker preserve-list (FR-20) + cross-template
mirror (NFR-10) + README fix at source") as TRACKED-as-#32 across both this
session and the prior. The user's directive lifts this work from "tracked" to
"filed against loom" — each of A/B/C/D maps to one of the four F5 sub-items.

## Consequences

- Four new issues land on `esperie-enterprise/loom`.
- Each is world-readable forever once on the public record.
- The settings.json scrub PR on this consumer's `feat/docker-dev-environment`
  branch (commit `4475933`) becomes the local interim fix until A is closed;
  the consumer's PR landing (whenever) carries that scrub forward to its own
  `main`, but loom emitter re-emission post-A is what closes the leak class
  durably for all kailash-coc-\* consumers.
- The consumer's M2 work (commits `c7e52ee`, `9d88900`, `022ddf5`) cannot
  safely land to `main` until B is closed (or the consumer accepts the risk
  of the next `/sync rs` clobbering Docker artifacts).

## For Discussion

1. **Counterfactual:** if A is fixed without B (settings.json scrub but no Docker preserve-list), the consumer's M2 PR could still land — but the first post-merge `/sync rs` would clobber Dockerfile + bin/dev + overlay scaffolds. Should A and B be ordered (B first, then A), or is independent landing acceptable since the consumer can defer the post-merge `/sync` until B closes?
2. **Data check:** Issue C (cross-template mirror to py + rb) was framed as "loom origination". Per `artifact-flow.md` "loom Splits, Never Originates", does C need a `/codify` proposal from the kailash-coc-rs side first (the mirror IS the rs pattern propagated), or does loom's role as the central distributor cover "lift a verified-in-rs pattern to py + rb" without an explicit `/codify` cycle? The verbatim co-owner directive here ("please file the issues to loom") may serve as the co-owner-directed origination exception per `artifact-flow.md` § "Co-Owner-Directed Origination" — this journal entry IS the receipt-first provenance that exception requires.
3. **Receipt mechanism:** the filed issue numbers will be reported back to the user + appended to this journal as a follow-up edit (immutable per `journal.md` MUST NOT, so a sibling note `0010a` if reference is needed). Is that traceability sufficient, or should each filed issue also be cross-referenced from the workspace `.session-notes` for next-session pickup?
