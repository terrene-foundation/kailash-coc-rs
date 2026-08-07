# 0003 — CONNECTION — "Slim default, opt-in heavy" is one principle across three axes

**Date:** 2026-05-27 · **Phase:** /analyze

## Connection

Three independently-arrived decisions are the SAME underlying principle — keep the
default image lean and fast to first-run, push weight behind explicit opt-in:

1. **Rust toolchain opt-in (ADR-03)** — research showed prebuilt multi-arch
   wheels/gems make a compiler unnecessary for the common path; ~1.5 GB of toolchain
   becomes a one-flag add-on.
2. **Heavy ML/Align opt-in (ADR-12, operator directive)** — torch-class deps (multi-GB)
   live behind a compose `--profile ml` gate, not the base.
3. **Opt-in services (FR-08)** — Redis et al. ship commented-out; the base bundles only
   Postgres (the one framework prerequisite).

## Implication

The implementation should express all three through ONE consistent opt-in mechanism
(compose profiles + build-args + the project-owned overlay), not three bespoke
switches. This keeps the slim-base contract auditable (NFR-01/03) and the mental model
single: "default = binding-consumer essentials; everything heavy is a named opt-in."

## Connection to the two-layer ownership model

The opt-in layers are the template-owned counterpart to the project-owned overlay
(`extensibility.md`): the template decides what's opt-in-available (Rust, ML, services);
the project decides what to actually enable + adds its own deps. Both halves share the
"don't bloat the default; make additions explicit and reproducible" goal.

## Cross-template note

The rs template applies every Python mechanism twice (Python + Ruby). The slim/opt-in
principle keeps that doubling from compounding into a heavy default — the Ruby binding
is in the slim base (it's a core consumer surface), but Ruby-side heavy extras would
follow the same opt-in pattern if they ever exist.
