# Milestone 3 — Multi-Arch CI + Opt-In Layers + Docs (Shard 3)

**Value anchor:** `briefs/01-brief.md` § Success-criteria (multi-arch aware: arm64 dev +
amd64 CI) + operator directive this session ("split heavy ML/Align into an opt-in layer so
first-run stays fast"). Third-priority: these harden + round out the working environment
from Milestones 1–2 (reproducibility, fast first-run, discoverability). Lower value than the
core working environment, but required for the success criteria. Shardable if any todo
exceeds budget.

## T12 — [build] Opt-in heavy ML/Align layer

Implements: `specs/extensibility.md` (ADR-12, FR-24) — operator directive.
**RESOLVED 2026-05-28** — `INCLUDE_ML=true` build-arg path shipped (Dockerfile L105-108

- docker-compose.yml L24); compose `--profile ml` alias path is out-of-scope for
  M3 (the build-arg path satisfies the "and/or" disjunction). Profile alias may
  land in M3.1+ if operator demand surfaces.

* [x] torch-class ML/Align deps (multi-GB) install ONLY under the `INCLUDE_ML=true` build-arg — NOT in the slim base.
* [x] Gate is **dependency-agnostic** (works regardless of exact ML package set; no rs-native ML wheel today).
* [x] Default first-run confirmed slim (NFR-01/03 — live image = 820 MB single-platform, well under the ~2.5 GB NFR-03 target); ML weight pulled only on opt-in via `INCLUDE_ML=true docker compose build`.

## T13 — [build] Opt-in Rust toolchain layer

Implements: `specs/cli-toolchain.md` (ADR-03).

- [ ] Rust Feature/toolchain gated by build-arg/profile; NOT in slim base.
- [ ] Documented as the source-build / SDK-source-dev path (the prebuilt-artifact-gap recovery).

## T14 — [build] CI multi-arch build workflow

Implements: `specs/ci-multiarch.md` (NFR-04, ADR-09). NEW workflow — NOT an edit to `validate.yml`.

- [ ] `.github/workflows/docker-build.yml`: `docker buildx build --platform linux/amd64` NATIVELY on `ubuntu-latest` (blocking, "build IS the test").
- [ ] After build: run smoke tests (Rust-path assertion T05; `claude/codex/gemini` on PATH + guard `--self-check` T06) in the built image.
- [ ] Disclosure grep gate: fail on any `/Users/`, `/home/`, hostname, or non-public org slug in committed Docker artifacts.
- [ ] **HIGH-3:** arm64 validated by Mac devs natively (NOT QEMU-built on every PR). Any arm64 CI leg is explicitly `qemu`/slow/**non-blocking** and only if a runner exists (unverified — do not assume one).

## T15 — [build] README "Run in Docker" Quick Start

Implements: `specs/provenance-sync.md` (template-owned doc; safe to extend).

- [ ] Add a "Run in Docker" section: `./bin/dev`, the two-layer add-a-dep one-liner, the opt-in `--profile ml`, expected first-build time, the auth paths.
- [ ] No literal operator paths; `${HOME}` for any host-path example.

**Milestone-3 done when:** `docker buildx build --platform linux/amd64` is green in CI with
smoke tests + disclosure gate passing; `--profile ml` pulls heavy deps only on opt-in;
README documents the flows. Walk Flows 5/7 (T17) before declaring done.
