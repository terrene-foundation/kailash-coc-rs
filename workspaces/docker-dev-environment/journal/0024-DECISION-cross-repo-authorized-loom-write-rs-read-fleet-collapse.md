# 0024 — DECISION — Cross-repo-authorized: WRITE collapse-scope to loom + READ kailash-rs binding surface

**Type:** DECISION · **Date:** 2026-06-01 · **Phase:** analysis→scope · **Status:** authorized, pre-action receipt

cross-repo-authorized: esperie-enterprise/loom
cross-repo-authorized: esperie-enterprise/kailash-rs

## Verbatim user directive (this session)

> "no, its the same engine. please write the full scope to loom for collapsing into 1. i give you permission to peruse kailash-rs to know the full surface of ALL BINDINGS that are already available."

## Authorization (repo-scope-discipline § User-Authorized Exception — all 5 conditions)

1. **User-initiated** — genuine user turn quoted verbatim above.
2. **Explicit + specific** —
   - **loom (WRITE):** write the full SCOPE document for collapsing `coc-rs` + `coc-rb` into one `kailash-rs`-stack template. Deposited as a planning/scope doc in loom (NOT a live `.claude/` artifact edit; the actual variant-map collapse is a future loom session).
   - **kailash-rs (READ):** read-only perusal to enumerate the full surface of ALL bindings kailash-rs ships (Python/PyO3, Ruby/Magnus, Node/napi-rs, WASM, + any others).
3. **Confirmed** — agent restated both actions + targets before acting (this turn).
4. **Journaled before acting** — this entry lands BEFORE any kailash-rs read OR loom write.
5. **Scoped exactly** — loom: one scope doc (planning surface). kailash-rs: read-only binding enumeration. No other writes, no other repos, no incidental scope creep. Whether to git-commit/PR the loom scope doc is a separate decision surfaced to the user (not self-authorized here).

## Disclosure guard

loom + kailash-rs are PRIVATE; coc-rs is PUBLIC. The scope doc lands in loom (private). MUST NOT leak loom/kailash-rs-private specifics into any coc-rs committed/public surface. This session's coc-rs writes are workspace-local (uncommitted) journals only.

## Origination-lane note (artifact-flow.md)

Normal lane for a COC-fleet change is `/codify` from a USE-template → loom Gate-1. The user explicitly directed depositing the SCOPE directly in loom. Per artifact-flow § Co-Owner-Directed Origination, the verbatim directive + this receipt-first journal is the upstream audit trail; the deposited artifact is a planning scope (not a live-artifact edit), and the actual collapse remains a loom Gate-reviewed session.

## Outcome

- **kailash-rs binding enumeration (read-only):** 6 binding crates — `kailash-python` (PyO3), `kailash-ruby` (Magnus), `kailash-node` (napi-rs), `kailash-wasm` (wasm-bindgen), `kailash-dotnet` (C ABI via `crates/kailash-capi`), `kailash-rails` (atop kailash-ruby). Today only py+rb have COC coverage.
- **Mechanism CORRECTION (user, this session):** "you are not supposed to touch loom codes, only issue gh issues." My initial write of a SCOPE.md file into loom's working tree was reverted (`rm -rf workspaces/kailash-rs-template-collapse`; it was untracked, clean removal — loom tree restored, no footprint). The scope was instead filed as **loom issue esperie-enterprise/loom#423**. No loom code/files/PRs touched.
- **Loom tree at time of work:** on branch `codify/esperie-2026-06-01` with a LIVE loom session's WIP (`.session-notes`, `.journal-skipped.log`, `.claude/skills/30-claude-code-patterns/sync-flow.md`, `.claude/sync-manifest.yaml`) — left untouched.
