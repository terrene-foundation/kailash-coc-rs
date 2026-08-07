# 0023 — DECISION — Cross-repo-authorized: read-only loom access for single-template analysis

**Type:** DECISION · **Date:** 2026-06-01 · **Phase:** analysis · **Status:** authorized, pre-action receipt

cross-repo-authorized: esperie-enterprise/loom

## Authorization (repo-scope-discipline § User-Authorized Exception — all 5 conditions)

1. **User-initiated** — genuine user turn this session: "i approve your cross-repo read into loom".
2. **Explicit + specific** — target: `loom` (on-disk `/Users/<operator>/repos/loom`, slug `esperie-enterprise/loom`); action: **READ-ONLY** access to ground the single-kailash-coc-template-for-all-bindings analysis (the user's standing analysis request). No writes.
3. **Confirmed** — agent flagged the scope limitation (analysis is a loom-architecture question; coc-rs scope barred loom reads); user responded with the explicit approval above; agent restates scope here as read-only-for-analysis before acting.
4. **Journaled before acting** — this entry (with the `cross-repo-authorized:` marker above) lands BEFORE any loom read.
5. **Scoped exactly** — read-only inspection of loom's template-fleet architecture (sync-manifest, variant system, emit pipeline, guides/co-setup, the actual template repo set). NO loom writes, NO writes to any other repo, NO incidental scope creep.

## Disclosure guard (loom is PRIVATE; coc-rs is PUBLIC)

loom is a PRIVATE repo. The analysis output is delivered in-conversation + (if written) to the coc-rs workspace, which is LOCAL/uncommitted by convention. MUST NOT leak loom-private specifics into any committed or public-surface artifact (PR bodies, issues, committed files). Per session-notes standing trap: "coc-rs is PUBLIC, loom is PRIVATE — never leak private repo refs into public issues/comments."

## Outcome

(loom-read findings folded into the analysis synthesis; see the single-template analysis deliverable)
