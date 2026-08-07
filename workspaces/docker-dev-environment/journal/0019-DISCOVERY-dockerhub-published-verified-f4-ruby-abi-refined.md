# 0019 — DISCOVERY — Image PUBLISHED + pull-verified; F4 Ruby root-cause refined

**Type:** DISCOVERY · **Date:** 2026-05-29 · **Status:** F9 live (manual publish); CI-path + F4 still open

## Published (receipt)

`terrenefoundation/kailash-coc-rs` — tags **`2.23.1`** (= coc-rs version) + **`latest`**,
**public** (`is_private:false`), multi-arch **linux/amd64 + linux/arm64**.
Manifest-list digest: `sha256:7481b274177be580947b180a34e3736287e86267626823c9ace355fe2c4aafb7`.
Pushed as `esperie` (member of `terrenefoundation`). Overview set from
`.github/DOCKERHUB-OVERVIEW.md` via Hub API PATCH; future publishes auto-sync it
(`peter-evans/dockerhub-description` step in `docker-publish.yml`, commit `c6d8543`).

## Live verification (clean pull, per user-flow-validation MUST-1+2)

Removed local images, pulled from the Hub, ran the PULLED image (arm64):

- `import kailash` → **OK**, `kailash-enterprise 4.3.0` (Rust-backed path confirmed).
- `claude --version` → `2.1.156` (CLI on PATH).
- Multi-arch tags `active` on the Hub (amd64+arm64).

## F4 root-cause REFINED (actionable)

`require "kailash"` fails in the pulled image with:
`libruby-3.1.so.3.1: cannot open shared object file` from
`/opt/gems/gems/kailash-4.3.0-aarch64-linux/lib/kailash/kailash.so`.

The precompiled gem's native extension is linked against **Ruby 3.1** (`libruby-3.1.so`),
but the image ships **`ruby-full` 3.2.3** (per `cli-toolchain.md`). So F4 is a **Ruby
ABI/version mismatch**, not (only) a generic upstream gap. Two paths to resolve, NOT acted
on this session (each needs its own verification + is a design decision):

1. **Upstream (canonical, kailash-rs#1151):** publish a `kailash` platform gem built for
   Ruby 3.2 (or a 3.1+3.2 fat gem). When that lands, the next `:x.y.z` rebuild is seamless.
2. **Local workaround (faster, needs verification):** pin the image's Ruby to **3.1** to
   match the gem's current target. Trade-off: 3.1 is older; must re-verify the rest of the
   Ruby toolchain (bundler, overlay path) under 3.1. Candidate for a follow-up if Ruby is
   needed before upstream ships a 3.2 gem.

Surfaced to the co-owner. Not filed upstream (cross-repo; needs human gate per
`upstream-issue-hygiene.md`).

## Still open

- **CI publish path UNEXERCISED:** the manual `docker buildx --push` is verified; the
  `docker-publish.yml` tag-triggered + overview-auto-sync path has NOT run (needs the GH
  repo to have `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` secrets + `DOCKERHUB_NAMESPACE` var,
  then a `v*` tag or `workflow_dispatch`). The workflow is statically + security-reviewed
  (commit `ab3a2ff`), not live-run.
- F4 (above) — Ruby load broken until path 1 or 2.
- Feat PR still held on loom #387 (F5).
