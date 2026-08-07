# Spec — Base Image & Build

## Authority

Base OS, toolchain layering, reproducibility, image-size budget. Implements ADR-02,
ADR-03, ADR-09; serves NFR-01, NFR-03, NFR-04, NFR-07.

## Base

- `mcr.microsoft.com/devcontainers/base:ubuntu-24.04`, **pinned by digest** (not a
  floating tag) — NFR-07. glibc is mandatory: prebuilt manylinux Python wheels
  (`kailash-enterprise`) and precompiled Ruby `*-linux` gems reject musl (`bindings-runtime.md`).
- Toolchains installed EXPLICITLY in the Dockerfile (apt for Python/Ruby/gnupg; the
  NodeSource apt repo for Node 20), NOT via devcontainer Features — `cli-toolchain.md`.
  Rationale: devcontainer Features do not apply to a plain `docker compose build`, a
  required entry path (FR-17); baking the runtimes in the Dockerfile keeps the editor
  and plain-compose paths identical. The Rust toolchain is OPT-IN (ADR-03), gated by
  the `INCLUDE_RUST` build-arg.

## Layer ordering (cache discipline)

1. Base + OS packages (apt: `gnupg`, build prerequisites for native gems, `git`, …).
2. Language runtimes (explicit apt + NodeSource installs).
3. Pinned CLI install (`cli-toolchain.md`) + MCP-guard `npm ci`.
4. Kailash bindings install (`bindings-runtime.md`).
5. Base dependency manifests (template-owned).
6. **(last)** project-owned overlay deps (`extensibility.md`) — so a user dep add
   rebuilds only the cheap top layers, not the heavy base.

Source code is bind-mounted at runtime, NOT `COPY`'d (keeps the image source-agnostic
and avoids rebuild-on-every-edit).

## Multi-stage

- Default slim image: runtimes + CLIs + bindings, NO Rust toolchain.
- Opt-in `+rust` path adds the Rust toolchain (ADR-03) — used for source builds /
  SDK-source development only.

> **`/implement` MUST confirm multi-stage earns its complexity.** The original
> multi-stage rationale was "drop the heavy Rust build toolchain from the runtime layer"
> — but ADR-03 already makes Rust opt-in-EXCLUDED from the slim base, so there is no
> heavy build stage to drop on the default path. A single-stage slim image may be
> simpler with no size penalty. Keep multi-stage ONLY if a concrete build-only
> dependency (compiled at build, unwanted at runtime) actually materializes; otherwise
> prefer single-stage. This is a dev image — developers may rebuild bindings in place.

## Budgets (documented, not promised-tiny)

- NFR-01 cold build (slim, arm64 laptop): target ≤ ~10 min — document the real number.
- NFR-03 slim image size: target ≤ ~2.5 GB. Heavy ML/Align layer is separate
  (`extensibility.md` / ADR-12).

## Constraints

- Pin base by digest; pin the NodeSource major line + apt/CLI versions; no floating `latest` anywhere (NFR-07).
- No secrets in any layer; no `COPY .env`; no secret build-args (`credentials-secrets.md`).
- Arch-agnostic: no hardcoded `--platform`, no arch-specific download URLs (ADR-09).
