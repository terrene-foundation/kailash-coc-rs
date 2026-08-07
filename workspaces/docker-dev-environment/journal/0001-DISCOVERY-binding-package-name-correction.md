# 0001 — DISCOVERY — Python binding is `kailash-enterprise`, not `kailash-rs`

**Date:** 2026-05-27 · **Phase:** /analyze

## Finding

The brief (inherited from `README.md:116`) said the Python binding installs via
`pip install kailash-rs`. Live PyPI research found **`kailash-rs` returns HTTP 404** —
it does not exist. The Rust-powered Python binding is **`kailash-enterprise`** (v4.2.2,
manylinux_2_28 wheels for aarch64 + x86_64, cp310–cp314). This matches the repo's own
`CLAUDE.md:155/161`, which already says `pip install kailash-enterprise`.

## Trap (C2)

A plain `kailash` (and `kailash-dataflow`/`-nexus`/`-kaizen`) DOES exist on PyPI but is
**pure-Python** (`py3-none-any`) — the kailash-py SDK, NOT the Rust binding. A naive
`import kailash` could silently resolve the wrong package. The Dockerfile's smoke test
MUST assert the Rust-backed path.

## Why it matters

A Dockerfile hardcoding `kailash-rs` would 404 at build; one installing pure-Python
`kailash` would "work" but give the wrong runtime. Both break the brief's "real
bindings, no FFI mocking" promise silently.

## Disposition

- Use `kailash-enterprise` (Python) + `kailash` gem (Ruby, holds as written). ADR-04.
- Smoke test asserts Rust path. `bindings-runtime.md`.
- README's stale `kailash-rs` string → doc-consistency follow-up (out of this scope).

## Receipt

Live registry verdicts in `01-analysis/01-research/02-external-toolchain-research.md`
(toolchain-researcher agent, completed 2026-05-27).
