# Red-Team Round 2 — Implementation Validation (Docker artifacts)

**Date:** 2026-05-29 · **Phase:** /redteam (post-/implement, pre feat-PR) · **Posture:** L5_DELEGATED (`/redteam` Round-1 optional at L5; this round + R3 run because the user directed "/redteam to convergence").

**Scope:** adversarial validation of the IMPLEMENTED Docker dev-environment artifacts
(`Dockerfile`, `docker-compose.yml`, `.devcontainer/devcontainer.json`, `bin/dev`,
`.github/workflows/docker-build.yml`, overlay scaffolds, `.dockerignore`, `.gitignore`,
`.env.example`, README § "Run in Docker") against the 9 `specs/`, the brief, the
FR/NFR requirements, and the 12 ADRs. R1 (`round-1-analysis-redteam.md`) validated the
_analysis_; this round validates the _shipped artifacts_.

**Static-scope bound (honest):** a live `docker build` + the T17 user-flow walks
(clone→`./bin/dev`→3 CLIs+bindings+Postgres; `--no-cache` survival; signing) require a
Docker daemon + a multi-GB build, NOT available this session. Those remain
`UNVERIFIED — live build` and are tracked in `todos/active/04-verification-walks.md`
(T17) + the UNVERIFIABLE-STATICALLY list below. The CI `docker-build.yml` job is the
live-build verification surface that fires on the feat PR. This round delivers the
static adversarial + spec-compliance + disclosure + CI-correctness layers.

## Receipts (durable, per verify-resource-existence.md MUST-4)

Three core red-team agents dispatched in parallel against the artifacts:

| Lane                     | Agent             | Background task ID  | R2 verdict                        |
| ------------------------ | ----------------- | ------------------- | --------------------------------- |
| Artifact code quality    | reviewer          | `a531d49593e408264` | GAPS-REMAIN: 1 HIGH, 2 MED, 2 LOW |
| Public-surface / secrets | security-reviewer | `ae9807e541244d6d5` | GAPS-REMAIN: 1 HIGH, 4 MED, 3 LOW |
| Spec compliance          | analyst           | `a2739f48bd1b9d2ab` | GAPS-REMAIN: 2 HIGH, 4 MED, 3 LOW |

**Reconciled (deduplicated): 0 CRITICAL, 4 HIGH, 9 MED, 6 LOW.** reviewer H1 ≡
security M3 (README GPG mount) — convergent across two agents (rated HIGH by the
governing agent). Orchestrator delegation note: analyst was dispatched read-only
(`Read/Grep/Glob`) but tasked to WRITE `.spec-coverage-v2.md` — a tool-inventory
mismatch per `agents.md` § "Verify Specialist Tool Inventory"; analyst correctly
refused the write and returned the table inline; the orchestrator persisted it.

## Findings + dispositions (ALL fixed this round — `/redteam` fixes autonomously)

| ID  | Sev    | Finding                                                                                                                                                                                                                                                           | Disposition (file:line, verified)                                                                                                                                                                                                                                                    |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H-A | HIGH×2 | README L177 told users to mount `${HOME}/.gnupg:/home/vscode/.gnupg:ro` — the broken direct-mount journal/0012's walk eliminated (silent `git commit -S` failure).                                                                                                | FIXED `README.md` — rewritten to the `/host-gnupg:ro` side-mount + `bin/dev setup` populate + the macOS/Linux socket-ABI rationale. (grep `host-gnupg:ro.*side-mount` = 1)                                                                                                           |
| H-B | HIGH   | Disclosure gate `M2_FILES` omitted README + the workflow itself (both ship public, unscanned).                                                                                                                                                                    | FIXED `.github/workflows/docker-build.yml` — `README.md` added to `M2_FILES`. Workflow self-scan deliberately NOT added (it holds the detection regexes as literals → guaranteed self-false-positive); documented in-file; its safety is PR review + literal-only content.           |
| H-C | HIGH   | `base-image.md`/`cli-toolchain.md`/ADR-02 asserted "devcontainer Features" as the install mechanism; code installs via apt + NodeSource, explicitly NOT Features (FR-17: Features don't apply to plain `docker compose`). spec-accuracy MUST-1 phantom-mechanism. | FIXED `specs/base-image.md` (×4), `specs/cli-toolchain.md`, `01-analysis/03-adrs/adrs.md` ADR-02 (title+decision+consequences+recommendation, "Revised at /implement" deviation note per specs-authority MUST-6).                                                                    |
| H-D | HIGH   | `extensibility.md`/ADR-12/Flow-5 asserted `docker compose --profile ml` — a no-op against the shipped compose (no `profiles:`); code ships `INCLUDE_ML=true` build-arg.                                                                                           | FIXED `specs/extensibility.md`, ADR-12, `03-user-flows/01-user-flows.md` Flow 5. Root-cause rationale recorded: compose profiles gate SERVICE startup, not build-time deps — a profile cannot bake pip packages; the build-arg is the correct primitive (ADR-12 "and/or" satisfied). |
| M-1 | MED    | `INCLUDE_RUST=true` ran rustup as root → `/root/.cargo` (unreadable + off-PATH for non-root `vscode`); `ENV PATH` pointed at `/home/vscode/.cargo/bin`; chown skipped cargo. Opt-in Rust layer shipped non-functional (zero-tolerance Rule 6).                    | FIXED `Dockerfile` — `ENV CARGO_HOME=/opt/cargo RUSTUP_HOME=/opt/rustup`, PATH→`/opt/cargo/bin`, `--no-modify-path`, build-gated `cargo --version`+`rustc --version` smoke, chown of both dirs inside the `INCLUDE_RUST` block.                                                      |
| M-2 | MED    | `bin/dev` heredoc had `set -e` but no `pipefail`; the GPG tar-pipe source-side failure was masked while a comment claimed it wasn't (Rule 3 overclaim).                                                                                                           | FIXED `bin/dev` — `set -eo pipefail`. (`bash -n` + heredoc parse OK)                                                                                                                                                                                                                 |
| M-3 | MED    | Disclosure (a) operator-home regex missed Windows / tilde-home / no-trailing-slash.                                                                                                                                                                               | FIXED gate (a) — added `~user/` + `C:\Users\` alternatives, dropped mandatory trailing slash. Re-run over tree incl README: CLEAN.                                                                                                                                                   |
| M-4 | MED    | Disclosure (b) + history (6) key-shape regexes missed PEM / `xox` / `github_pat` / `glpat` / `ya29`.                                                                                                                                                              | FIXED gate (b) + (6) — added those shapes (PEM highest-value). Re-run: CLEAN.                                                                                                                                                                                                        |
| M-5 | MED    | `rm -rf "$GNUPGHOME"` had no precondition; an inherited/mis-set GNUPGHOME or host-backed mount could be wiped.                                                                                                                                                    | FIXED `bin/dev` — refuse-if-outside-`$HOME` + refuse-if-mountpoint guard before the prune (sibling of git.md "reset --hard verify clean").                                                                                                                                           |
| M-6 | MED    | `credentials-secrets.md` C8 + requirements C8 flagged the settings.json `/Users/<operator>` leak as a LIVE finding — already RESOLVED on main (scrub PRs #34/#35). Stale phantom citation.                                                                           | FIXED both → "C8 — RESOLVED" with the PR #34/#35 receipt + loom #386–#389 durable-fix pointer.                                                                                                                                                                                       |
| M-7 | MED    | Prior `.spec-coverage-v2.md` was M2-milestone-scoped (omitted base-image Features / ci-multiarch ADR-09 / provenance-sync) + carried an internal `4.2.2`/`4.3.0` version contradiction; framed itself as whole-deliverable convergence.                           | FIXED — re-derived Round-2 assertion table written to `.spec-coverage-v2.md` (overwrite).                                                                                                                                                                                            |
| M-8 | MED    | `bindings-runtime.md` Python smoke-test still carried `UNVERIFIED — /implement MUST confirm` though the Dockerfile now pins the `importlib.metadata` discriminator.                                                                                               | FIXED — Python smoke § rewritten present-tense (shipped discriminator, grep-resolves Dockerfile + CI); live-fail-on-wrong-package noted as a T17 walk. Ruby probe KEPT `UNVERIFIED` (genuine upstream ABI blocker kailash-rs#1151, journal/0006).                                    |
| M-9 | MED    | `credentials-secrets.md` described an allowlist GPG copy; code ships a denylist (prune + socket/lock excludes).                                                                                                                                                   | FIXED spec → describes the shipped denylist + prune-revocation-safety + 0700-before-copy + the GNUPGHOME guard.                                                                                                                                                                      |
| L-1 | LOW    | Disclosure (g) org-slug allowlist matched substrings (`esperie` ⊂ `esperie-evil`).                                                                                                                                                                                | FIXED — anchored to `github.com/<slug>/`.                                                                                                                                                                                                                                            |
| L-2 | LOW    | GPG socket denylist missed `S.dirmngr` / `S.scdaemon`.                                                                                                                                                                                                            | FIXED `bin/dev` — added both (+`./` forms) to the tar excludes.                                                                                                                                                                                                                      |
| L-3 | LOW    | devcontainer `setup` path skipped `ensure_env` (.env bootstrap divergence vs `up`).                                                                                                                                                                               | FIXED `bin/dev` — `ensure_env` added to the host-side `setup` branch.                                                                                                                                                                                                                |
| L-4 | LOW    | Unconditional `/home/vscode/.cargo/bin` PATH prepend.                                                                                                                                                                                                             | FIXED — folded into M-1 (PATH now `${CARGO_HOME}/bin`, a real ENV-var location).                                                                                                                                                                                                     |
| L-5 | LOW    | `extensibility.md` two-layer overlay list omitted `package.json`/npm.                                                                                                                                                                                             | FIXED — `package.json` overlay row added.                                                                                                                                                                                                                                            |
| L-6 | LOW    | `Gemfile.user.lock` test residue (paint 2.3.0).                                                                                                                                                                                                                   | Disposition: it is UNTRACKED (`git status` `??`) so it does NOT ship to consumers; already in `.dockerignore`. Removed from the working tree (regenerable by `bin/dev setup`).                                                                                                       |

## Mechanical verification (this round, ground-truth)

- `git diff --stat` (tracked): `Dockerfile` +13/-2, `bin/dev` +23/-4, `docker-build.yml` +18/-4, `README.md` +1/-1.
- `bash -n bin/dev` → OK; extracted `INSTALL_OVERLAYS_SH` heredoc `bash -n` → OK (after `set -eo pipefail` + GNUPGHOME guard + tar-exclude additions).
- Broadened disclosure greps (a)+(b) re-run over all `M2_FILES` **including README** → CLEAN (no false-positive, no real leak).
- `.dockerignore` mandatory-entries check (e) → 10/10.
- Untracked workspace write-backs grep-verified present (base-image ×4, cli-toolchain, extensibility ×2, credentials ×2, bindings, user-flows, adrs ×3+, requirements, +L-5).

## UNVERIFIABLE-STATICALLY (require live `docker build`/run — T17 walk surface, NOT gaps)

1. Slim image size = 820 MB (README/T12 claim; needs `docker image inspect`).
2. Installed `kailash-enterprise` version (the old spec-coverage `4.2.2`/`4.3.0` discrepancy — resolved by overwrite; confirm at build).
3. FR-03 (b) "≥1 hook fires end-to-end" in the running container.
4. Ruby `require "kailash"` load behavior (upstream ABI defect; kailash-rs#1151).
5. The Python discriminator actually FAILS the build on a wrong-package install.
6. `docker history` shows zero secrets in layers (CI smoke (6) asserts this in CI).
7. `INCLUDE_RUST=true` build produces a `vscode`-invocable `cargo`/`rustc` (M-1 fix; CI/build confirms).

## Convergence status

- R2: 0 CRIT, 4 HIGH, 9 MED, 6 LOW found → **all 19 dispositions closed + mechanically verified** this round (live-build items deferred to T17 with explicit receipts, not closed-by-assertion).
- R3 (confirming round): reviewer + security-reviewer re-dispatched against the fix diff to verify each finding is correctly closed + no regression introduced (receipts appended on completion).
- Convergence criterion "2 consecutive clean rounds": R3 = round 1 of confirmation; the CI `docker-build.yml` live build (fires on the feat PR) is the live round 2. Feat PR remains GATED on loom #387 (`.session-notes`) — not opened this session.
