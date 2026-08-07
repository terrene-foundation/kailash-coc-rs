# 0017 — GAP — Live-build user-flow walks remain unverified after static /redteam

**Type:** GAP · **Date:** 2026-05-29 · **Phase:** /redteam Round 2 (implementation) · **Status:** OPEN (deferred to T17, Docker-available session)

## What

The R2 implementation /redteam ran STATIC only — no Docker daemon available this session.
Seven assertions are UNVERIFIABLE-STATICALLY and remain `UNVERIFIED — live build`:

1. Slim image size = 820 MB (README/T12 claim; needs `docker image inspect`).
2. Installed `kailash-enterprise` version (resolves the old spec-coverage `4.2.2`/`4.3.0`
   discrepancy at build time).
3. FR-03 (b) "≥1 hook fires end-to-end" inside the running container.
4. Ruby `require "kailash"` load behavior (blocked upstream: kailash-rs#1151, journal/0006).
5. The Python Rust-path discriminator actually FAILS the build on a wrong-package install.
6. `docker history` shows zero secrets in any layer (CI smoke (6) asserts this in CI).
7. `INCLUDE_RUST=true` build yields a `vscode`-invocable `cargo`/`rustc` (the M-1 fix).

## Why it matters

`user-flow-validation.md` MUST-1: tests/static-review are necessary but INSUFFICIENT —
the literal user walk is the last mile. These 7 are precisely the composition-level
behaviors static review cannot confirm. Declaring the deliverable "done" before the walk
is BLOCKED.

## Disposition

Tracked in `todos/active/04-verification-walks.md` (T17) with scrubbed-receipt requirements.
The CI `.github/workflows/docker-build.yml` job is the live verification surface for
(1)(2)(5)(6)(7) and fires on the feat PR (gated on loom #387 per `.session-notes`). Items
(3)(4) need a manual in-container walk. NOT closed-by-assertion — these are honest open
gaps, not silent passes.

## Institutional lesson

Static /redteam can converge the code-correctness + spec-compliance + disclosure layers to
0 CRIT/0 HIGH, but the "2 consecutive clean rounds" convergence criterion's LIVE half is
satisfied only by the CI build + the T17 walk. A static-only "converged" claim would be the
`verify-resource-existence.md` MUST-4 failure mode (convergence asserted without the live
receipt).
