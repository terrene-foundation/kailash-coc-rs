# 0022 — DECISION — Cross-repo-authorized: reopen + comment kailash-rs#1151 (libruby soname residual)

**Type:** DECISION · **Date:** 2026-06-01 · **Phase:** /implement (F4b) · **Status:** authorized, pre-action receipt

cross-repo-authorized: esperie/kailash-rs

## Authorization (repo-scope-discipline § User-Authorized Exception — all 5 conditions)

1. **User-initiated** — genuine user turn this session ("please check if upstream is already done" → "its fixed, please check" → chose **Symlink + file upstream** → chose **Comment on #1151 (reopen)**).
2. **Explicit + specific** — target repo `esperie/kailash-rs`, exact action: reopen issue **#1151** + post one scrubbed comment documenting the libruby-soname residual.
3. **Confirmed** — agent presented the full scrubbed comment body + the reopen-vs-new choice via AskUserQuestion; user selected "Comment on #1151 (reopen)".
4. **Journaled before acting** — this entry (with the `cross-repo-authorized:` marker above) lands BEFORE any `gh` write.
5. **Scoped exactly** — only `gh issue reopen 1151` + `gh issue comment 1151` against `esperie/kailash-rs`; no incidental reads/writes, no other repo.

## Requester / target / action

- **Requester:** user (jack@kailash.ai, owner / `esperie`)
- **Target:** `esperie/kailash-rs` issue **#1151**
- **Action:** reopen + comment (scrubbed, SDK-API-surface minimal repro per `upstream-issue-hygiene` Rule 3)
- **Timestamp:** 2026-06-01

## Why reopen

#1151 was closed COMPLETED on 2026-05-30 by PR #1172 (fat-gem) + released v4.3.1 (#1178). The 05-28 "deferred" disposition explicitly invited reopen "when a real consumer is blocked". The fat-gem fixed the ABI-version dir but the per-ABI native ext hard-links the vanilla soname `libruby.so.3.2`, absent on Debian/Ubuntu (which name it `libruby-3.2.so.3.2`). A real consumer (this image) is blocked by the residual; consumer-side reconciliation is a libruby soname symlink + ldconfig (verified working — `require "kailash"` loads, binding live).

## Scrub note (upstream-issue-hygiene Rule 2/3)

Comment body carries ONLY: affected API (`require "kailash"`), generic Ubuntu 24.04 / Ruby 3.2.3 / gem 4.3.1 repro, expected-vs-actual root cause (soname mismatch), MEDIUM severity, acceptance criteria. NO consumer/template/image name, NO workspace paths, NO finding tags, NO private-repo refs.

## Receipt

The `gh issue comment` URL + reopen confirmation are appended to § Outcome after the command runs.

## Outcome

- Reopened `esperie/kailash-rs#1151` (now OPEN). Repo redirects to canonical `esperie-enterprise/kailash-rs` — same repo, in scope.
- Comment posted: https://github.com/esperie-enterprise/kailash-rs/issues/1151#issuecomment-4589964720
- Scrub verified: no consumer/template/image name, no workspace paths, no finding tags, no private-repo refs in the body.
