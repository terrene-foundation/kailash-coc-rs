# 0021 — DECISION — Cross-repo authorized: file 2nd GH issue into loom (VERSION drift)

**Type:** DECISION · **Date:** 2026-05-31 · **Status:** authorized, pre-action receipt

cross-repo-authorized: esperie-enterprise/loom

## Authorization (repo-scope-discipline § User-Authorized Exception)

- **Requester:** jack@kailash.ai (Jack Hong), repo owner — genuine user turn.
- **Verbatim instruction:** "please file as a loom issue" (re: the VERSION-drift fix).
- **Target repo:** `esperie-enterprise/loom` (existence-checked earlier this session; PRIVATE).
- **Exact bounded action:** file ONE GitHub issue describing the `version-utils.js`
  `KNOWN_TEMPLATE_REPOS` gap that auto-corrects multi-CLI USE templates'
  `coc-use-template` VERSION to `coc-project` every session (perpetual drift).
- **Scope guard:** one issue against `esperie-enterprise/loom` only; no other reads/writes.
- **Disclosure:** body references only loom-internal artifact names + loom's own template
  taxonomy (`terrene-foundation/kailash-coc-*`); no operator identifiers, absolute paths,
  or session IDs.

This entry lands BEFORE the `gh issue create` command (journaled-before-acting condition).
Root cause diagnosed in-repo: `version-utils.js::isActualTemplateRepo` + `checkVersion`
auto-correct path; `KNOWN_TEMPLATE_REPOS` omits the multi-CLI templates.

## Outcome (post-action)

- Filed: **esperie-enterprise/loom#407** — "version-utils.js: multi-CLI USE templates
  mis-corrected coc-use-template → coc-project every session (perpetual VERSION drift)".
- Scope honored: one issue against loom only. (Companion to loom#404.)
