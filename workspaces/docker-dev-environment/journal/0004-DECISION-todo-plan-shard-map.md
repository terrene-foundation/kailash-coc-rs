# 0004 — DECISION — Build plan: 4 milestones, value-ranked, UNVERIFIED items as ACs

**Date:** 2026-05-27 · **Phase:** /todos

## Decision

The build plan maps the architecture shard map (Shard 0 gate + Shards 1–3) to 4 milestones
in `todos/active/`, value-ranked by `briefs/01-brief.md` Goals:

1. **M1 Core image + topology** (HIGHEST — brief Goals #1–4 + Topology/Services/Distribution):
   the one-command working shell. Build+wire split: T01–04 build the image/compose/devcontainer/
   entry; T05–06 wire the bindings + guard.
2. **M2 Extensibility + secrets** (Goal #5 + the CRITICAL public-surface directive): two-layer
   overlays + the shared-env pinning (the peer-validated trap) + credentials + disclosure fence.
3. **M3 Multi-arch CI + opt-in layers + docs** (Success criteria + the opt-in-ML directive).
4. **M4 Verification walks** (the `user-flow-validation.md` last-mile gate).

## Why this ordering (value, not fittability)

M1 is the brief's core promise; nothing downstream has value until the shell works. M2 is the
explicitly-stated Goal #5 + the operator's CRITICAL public-data constraint. M3/M4 harden and
prove. This is value-rank-first per `value-prioritization.md` MUST-1, anchored to the brief.

## Red-team UNVERIFIED items wired as acceptance criteria (not deferred silently)

The R1 red-team's three `UNVERIFIED — /implement MUST confirm` items are embedded as ACs in
the owning todos, each naming the concrete check:

- HIGH-1 Rust-path discriminator → T05 AC (importlib.metadata dist-name preferred).
- MED-1 shared Ruby/Python env paths → T08 AC + Tier-2 overlay-import test (both langs).
- MED-2 Ruby native-ext probe → T05 AC.
- LOW-2 single-vs-multi-stage → T01 AC (prefer single-stage; Rust already opt-in-excluded).

## Build/wire split (per /todos discipline)

Every consuming component has a build todo AND a wire todo: image structure (build) vs
bindings/guard/deps actually flowing end-to-end (wire). A green build is NOT a green wire.

## Risk

The single highest "looks-fine-but-silently-broken" surface is T08 (shared-env, ×2 for
Python+Ruby). It carries a Tier-2 overlay-import test as the structural proof, per the
peer-validated R16 trap.
