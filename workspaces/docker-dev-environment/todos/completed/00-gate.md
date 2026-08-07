# Milestone 0 — Pre-Flight Gate (Shard 0)

**Value anchor:** `briefs/01-brief.md` § Confirmed decisions + § Hard-constraints —
these gates protect the brief's "consistent-by-construction + public-safe" requirements.
Build MUST NOT start until all three gate items are confirmed.

## T00.1 — Binding package name (RESOLVED, record only)

- [x] Python Rust binding = `kailash-enterprise` (not `kailash-rs`, 404). Ruby = `kailash` gem.
      Resolved by live research (`01-analysis/01-research/02-external-toolchain-research.md`);
      README corrected this session. Implements: `specs/bindings-runtime.md`.

## T00.2 — Provenance classification (CONFIRMED by user)

- [x] Docker artifacts are **template-owned, sync-preserved** (operator decision, this session).
      Added to the loom template-owned preserve-list is a follow-up at loom, NOT this repo.
      Implements: `specs/provenance-sync.md` (ADR-10).

## T00.3 — Pre-existing settings.json leak (routed upstream, NOT fixed here)

- [x] `.claude/settings.json` operator-path leak + "(Python)" mislabel → fix at the loom
      emitter via the USE-template→loom `/codify` proposal channel (operator decision).
      Do NOT hand-patch here (emitted file; sync would clobber). Tracked in `journal/0002`.

**Gate status: SATISFIED.** Proceed to Milestone 1.
