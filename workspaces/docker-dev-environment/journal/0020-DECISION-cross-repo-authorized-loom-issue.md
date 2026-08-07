# 0020 — DECISION — Cross-repo authorized: file GH issue into loom

**Type:** DECISION · **Date:** 2026-05-31 · **Status:** authorized, pre-action receipt

cross-repo-authorized: esperie-enterprise/loom

## Authorization (repo-scope-discipline § User-Authorized Exception)

- **Requester:** jack@kailash.ai (Jack Hong), repo owner — genuine user turn.
- **Verbatim instruction:** "i approved your filing of a gh issue into loom"
- **Target repo:** `esperie-enterprise/loom` (existence-checked; PRIVATE).
- **Exact bounded action:** file ONE GitHub issue capturing the cross-template
  Docker parity remainder (item 2 of kailash-coc-rs #32) — agnostic Docker base
  mirrored across all `kailash-coc-*` templates, language deltas isolated.
- **Scope guard:** only this one issue against only `esperie-enterprise/loom`;
  no other loom reads/writes; no scope creep.
- **Disclosure:** body scrubbed per `upstream-issue-hygiene.md` Rule 2 / proposal-intake
  lane — no operator identifiers, no absolute paths, no session IDs, no finding tags;
  references only loom's own template taxonomy (`kailash-coc-*`) + the public upstream
  ref `kailash-rs#1151`.

## Why

#32 item 2 is COC-source (loom) work, not completable from the rs template.
kailash-coc-rs #32 stays OPEN (not closed) until the loom work lands + syncs; this
issue is the loom-side tracker. rs #32 gets a pointer comment, not a close.

This entry lands BEFORE the `gh issue create` command per the exception's
journaled-before-acting condition.

## Outcome (post-action)

- Filed: **esperie-enterprise/loom#404** — "Docker dev-env: cross-template parity —
  mirror agnostic base to all `kailash-coc-*` templates" (scrubbed body).
- rs **#32 CLOSED** as superseded — items 1/3/4 delivered (PR #40 / `106193d`),
  item 2 routed upstream. Closure comment kept generic: coc-rs is PUBLIC + loom is
  PRIVATE, so the loom#404 pointer is recorded HERE (private/local), NOT in the
  public #32 comment (avoids leaking a private-repo issue ref).
- Scope honored: one issue against loom only; no other loom reads/writes.
