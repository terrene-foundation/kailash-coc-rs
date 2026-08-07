# 0007 — DECISION — Cross-repo filing authorized: Ruby gem ABI defect → esperie/kailash-rs

**Date:** 2026-05-27 · **Phase:** /implement (M1 closure)

cross-repo-authorized: esperie/kailash-rs

## Authorization (repo-scope-discipline § User-Authorized Exception — all 5 conditions)

1. **User-initiated:** operator answered the in-session approval question.
2. **Explicit + specific:** target repo `esperie/kailash-rs`; action = file the ONE drafted
   bug issue at `04-validate/upstream-issue-draft-ruby-gem-abi.md`.
3. **Confirmed:** the approval option read verbatim "Yes — file it now … against
   esperie/kailash-rs"; operator selected it.
4. **Journaled before acting:** this entry lands BEFORE the `gh issue create` command.
5. **Scoped exactly:** only `gh issue create` against `esperie/kailash-rs` with the
   scrubbed draft body; no incidental cross-repo reads/writes.

## Verbatim instruction (operator selection)

> "Yes — file it now (Recommended) … I file the scrubbed draft (minimal repro, no
> internal/template identifiers) against esperie/kailash-rs, logging the authorization
> first per the cross-repo protocol."

## Body compliance (upstream-issue-hygiene)

Body is the 5-section minimal-repro shape (MUST-3), scrubbed of consumer/workspace/template
identifiers (MUST-2). Human gate satisfied (MUST-1). No auto-cross-file to a sibling.

## FILED (receipt)

- **Issue:** esperie-enterprise/kailash-rs#1151 — https://github.com/esperie-enterprise/kailash-rs/issues/1151
- Note: `esperie/kailash-rs` (the name authorized + cited in CLAUDE.md/README) redirects to
  the canonical `esperie-enterprise/kailash-rs` org; gh resolved it automatically. Same repo,
  same authorization scope.
- Existence check before filing: `gh repo view` confirmed repo exists + issues enabled; authed as `esperie`.

## Ruby disposition (operator decision)

Document as known upstream limitation + continue. M1 ships functional for Python; Ruby
unblocks when the SDK republishes a correctly-built gem. M2/M3/M4 proceed.
