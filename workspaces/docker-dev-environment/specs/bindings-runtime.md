# Spec — Kailash Bindings Runtime

## Authority

How the Python and Ruby bindings to the Kailash Rust SDK are installed and verified.
Implements ADR-04; serves FR-04, FR-05, FR-18. Resolves brief corrections C1/C2/C3.

## Python binding

- **Package: `kailash-enterprise`** (Rust-powered wheel). `kailash-rs` is **404 on
  PyPI** — do NOT use it. `import` is `import kailash`.
- Distribution: manylinux_2_28 wheels for aarch64 + x86_64 (cp310–cp314) → installs
  prebuilt on both arches, no compiler (ADR-03).
- **C2 trap:** a plain `kailash` (and `kailash-dataflow`/`-nexus`/`-kaizen`) exists on
  PyPI but is **pure-Python** (`py3-none-any`) — the kailash-py SDK, NOT the Rust
  binding. The install + smoke test MUST assert the Rust-backed path.

## Ruby binding

- **Gem: `kailash`** (Rust-powered). v4.2.0 ships precompiled `x86_64-linux` +
  `aarch64-linux` + `arm64-darwin` platform gems. Sub-gems (`kailash-dataflow` etc.)
  are 404 — the single gem bundles everything.
- `require "kailash"` is the import.

## Install contract

- Default: prebuilt artifacts only (no Rust toolchain).
- Fallback: if an arch lacks a prebuilt artifact, the opt-in Rust layer (ADR-03)
  enables a source build; document this as the recovery path.

## Smoke test (Rust-path assertion — closes C2)

The build pins the **dist-name discriminator** (`/implement` selected it from the
candidates below, most-robust-first):

- **Python (shipped):** the Dockerfile build asserts
  `python -c "import importlib.metadata as m; assert m.version('kailash-enterprise'); import kailash"`
  (`Dockerfile` § "Python venv + Rust-backed Kailash binding"), and the CI smoke test
  re-runs the same dist-name assertion in the built image
  (`.github/workflows/docker-build.yml` smoke step (1)). This raises
  `PackageNotFoundError` if only the pure-Python `kailash` look-alike was installed
  (the C2 trap), independent of any in-module marker.
  - Secondary discriminator (available, not currently asserted): `kailash.__file__`
    (or a submodule) resolving to a compiled extension (`.so` / native ext) rather
    than a pure-Python `.py`.
  - Live verification that the assertion actually FAILS the build on a wrong-package
    install requires a `docker build` and is tracked as a T17 user-flow walk.
- **Ruby:** `gem install kailash` is unambiguous (RubyGems has no pure-Ruby
  look-alike; sub-gems 404). The CI smoke test asserts install-presence
  (`gem list kailash | grep -q '^kailash '`). The `require "kailash"` load-time
  native-ext probe remains **UNVERIFIED — blocked on the upstream gem ABI defect**
  (`esperie-enterprise/kailash-rs#1151`, journal/0006), NOT a stale design hedge.

## Real-infrastructure contract (FR-18)

- Tier-2/3 tests run against the live `db` Postgres (`services.md`) AND the real
  binding — NO mocking at the FFI boundary (repo rule). The binding + a healthy
  Postgres are the test prerequisites.

## Edge cases

- A future rs-native ML wheel (none today) would extend the opt-in ML layer
  (`extensibility.md`), not this base contract.
- Version pinning: pin the binding versions in a hash-locked manifest (NFR-07).
