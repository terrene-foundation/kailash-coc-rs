# 0025 — DECISION — Derive, don't duplicate: the root cause behind a permanently-red validator

**Type:** DECISION · **Date:** 2026-08-12 · **Phase:** 05-codify · **Status:** landed (ours) + filed (loom's)

**verified_id:** 548F2C562EB4246D025FA80A70552B124755B685 · **display_id:** jack-hong

## What was decided

Stop adding a parity check per drift instance. **Derive the dependent copy instead**, and retire the check.

Landed here for the one pair this repo owns both sides of; filed as a proposal for the eight that live in synced artifacts.

## The measurement that drove it

Classified every `validate-emit.mjs` check that has ever failed at this template. **Nine of eleven are one defect** — one fact stored in two artifacts, reconciled by a hand-written checker added after someone was burned:

`settings-hook-registration` (hook on disk ↔ settings.json) · `paths-annotation-consistency` (CLAUDE.md ↔ rule `paths:`) · `provenance-parity` (declared ↔ registered) · `provenance-subagent-hooks` (manifest ↔ agent frontmatter) · `hook-delivery` (hooks ↔ `hook_delivery`) · `consumer-efficacy` (emitted ↔ content) · `codex-policies-fresh` (committed ↔ fresh extraction) · `gitignore-learning-parity` (loom `.gitignore` ↔ `gitignore_additions`) · `claude-md-surface-role-parity` (surface_roles ↔ CLAUDE.md prose).

Only `command-frontmatter` and `command-line-cap` are genuine single-source shape rules.

The strongest evidence sits inside the failure text: `codex-policies-fresh` reports the committed file _"diverges from a fresh extraction"_. **The generator already exists and we commit a copy anyway.** That is the existence proof that derivation is tractable for this class, not a speculative refactor.

## What was done here

`.github/scripts/gen-claude-md-sections.mjs` derives the CLAUDE.md surface-roles block from `sync-manifest.yaml::surface_roles`. CI runs `--check` in both `validate` jobs. Parity check still `[ok]`; validate-emit unchanged at 801 pass / 35 fail.

**Placement is load-bearing.** `.claude/**` is Class-A here — the next `/sync-to-use` rebuilds it — so a generator placed there would be deleted by the sync it exists to survive. `.github/` is repo-owned; CLAUDE.md is template-owned and sync-preserved. Both halves outlive a sync, which is the whole reason this one pair was fixable locally when the other eight are not.

Fails closed: unreadable or unparseable source exits **2**, not 0. An empty parse and a genuinely empty config must not produce the same output.

## The part worth remembering

**This retired my own fix from two days earlier.** On 2026-08-10 I cleared 18 `claude-md-surface-role-parity` findings by hand-writing 18 command names into prose that the manifest already declared. It worked, it was verified, and it was an instance of the disease — it would have drifted on the next command added.

Knowing the defect class did not stop me producing a tenth instance of it. That is the argument for removing the authorship rather than documenting the discipline: the pull toward "just write the second copy correctly" survives knowing better.

## Scope honestly stated

One pair, and the easiest one. The other eight live entirely in synced artifacts and cannot be fixed durably at a consumer — filed as a root-cause proposal rather than patched, because a local patch would be Class-A and rebuilt away.

## Receipts

- Fix + generator: PR #143 (`fix(drift): derive CLAUDE.md's surface-roles block instead of re-checking it`)
- Root-cause proposals: PR #144 (three entries — derive-don't-duplicate, aggregate-then-exit, author-time staleness)
- Superseded patch: PR #135 (the hand-written block this replaced)

## Cross-references

- `rules/artifact-flow.md` § Distribution-Durability Invariants — why `.github/` and not `.claude/bin/`
- `rules/verify-claims-before-write.md` — the class the duplicated-fact defect belongs to at the claim layer
- Manifest entry `.claude/bin/validate-emit.mjs` (2026-08-12) — the filed proposal
