# Spec — CI & Multi-Arch

## Authority

How the Dockerfile is exercised across architectures in CI. Implements ADR-09; serves
NFR-04. Complements the existing `.github/workflows/validate.yml` (structure-only, does
NOT build Docker).

## Arch model

- Developers: arm64 (Apple Silicon) — native build, no emulation.
- CI / Codespaces: amd64.
- ONE arch-agnostic Dockerfile builds on both (no hardcoded `--platform`, no
  arch-specific URLs; rustup/apt/npm/Features resolve per-arch).

## CI build check (the build IS the test)

> **Runner-fleet reality (resolves the amd64-vs-arm64 contradiction):** the current
> CI runner fleet is **amd64-only** (`runs-on: ubuntu-latest`, verified in
> `validate.yml`). Building `linux/arm64` on an amd64 runner REQUIRES QEMU emulation —
> which is slow and is NOT the "build IS the test" fast path. The matrix below resolves
> this explicitly rather than implying free dual-arch builds.

- **amd64 leg (default, blocking):** a NEW workflow/job (NOT an edit to `validate.yml`)
  runs `docker buildx build --platform linux/amd64` NATIVELY on `ubuntu-latest`. Fast;
  this is the "build IS the test" pass criterion.
- **arm64 leg (validated by Mac developers natively, per ADR-09):** Apple Silicon devs
  build arm64 natively in their normal inner loop — that IS the arm64 validation. The
  default CI matrix does NOT QEMU-build arm64 on every PR.
- **Optional arm64 CI leg:** MAY be added as an explicitly `qemu`, slow, **non-blocking**
  job — only if/when an arm64 runner is provisioned or a periodic (non-PR) emulated build
  is wanted. It is NOT on the blocking PR path. (Existence of any arm64 runner is
  unverified per `verify-resource-existence.md` — do not assume one.)
- This PR-gate workflow (`docker-build.yml`) does NOT push — build success = pass.
  Publishing is a SEPARATE tag-gated workflow `.github/workflows/docker-publish.yml`
  (multi-arch, multi-registry, on `v*` tags; ADOPTED 2026-05-29, journal/0018).
- After the amd64 build: run the smoke tests (`bindings-runtime.md` Rust-path assertion;
  `cli-toolchain.md` `claude/codex/gemini` on PATH + guard `--self-check`) inside the
  built image.

## Per-arch binding availability

- Both bindings ship prebuilt for arm64 + amd64 (`bindings-runtime.md`), so the common
  path needs no compiler on either arch.
- A hypothetical arch gap → the opt-in Rust layer (ADR-03) source-builds; CI documents
  this path but the default matrix asserts the prebuilt path.

## Disclosure gate in CI (FR-21)

- CI runs the disclosure scanner / a grep for `/Users/`, `/home/`, hostnames, and
  non-public org slugs over the committed Docker artifacts → fail on any hit.

## Edge cases

- QEMU emulation is used only if a CI runner lacks a native arch; documented as slow,
  not the default inner loop.
- Published images (`docker-publish.yml`) follow the tag-gated release + dry-run
  discipline (`ci-runners.md` §8): a `workflow_dispatch` dry-run proxy + `v*`-tag publish.
