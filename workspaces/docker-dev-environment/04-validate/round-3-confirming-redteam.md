# Red-Team Round 3 — Confirming Round (fix verification + regression hunt)

**Date:** 2026-05-29 · **Phase:** /redteam (post-R2-fix) · **Posture:** L5_DELEGATED · **Verdict: CLEAN — 0 CRITICAL, 0 HIGH, no regression.**

Round 2 surfaced 19 findings (0 CRIT, 4 HIGH, 9 MED, 6 LOW), all fixed in-session.
This round independently re-verified that each fix correctly closes its finding AND
hunted for regressions the fixes could have introduced. No edits were made during R3 —
the artifact state R3 validated IS the converged state.

## Receipts (durable, per verify-resource-existence.md MUST-4)

| Lane                      | Agent             | Background task ID  | R3 verdict                                                                                       |
| ------------------------- | ----------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| Code quality + regression | reviewer          | `aa88e26eaee3efade` | CLEAN — all fix-clusters closed; pipefail-regression NEGATIVE (isolated repro, rc=0)             |
| Security + regression     | security-reviewer | `a7285a354acc42c6b` | CLEAN — 9 dispositions verified; GNUPGHOME-bypass + pipefail-silent-failure both hunted NEGATIVE |

## Regression-hunt results (the two highest-risk vectors)

1. **`set -eo pipefail` aborting the GPG bootstrap** (M-2 could have broken `bin/dev`):
   NEGATIVE. Both agents reproduced the heredoc gate logic in isolation — `has_content`/
   `has_gem_decl` are `if`-conditions (`set -e`-exempt) and single-stage greps (`pipefail`
   no-op); the `tar | tar` GPG pipe is the only pipeline, which is exactly what `pipefail`
   is meant to protect. Absent/empty/comment-only overlays → branches skip cleanly, rc=0.
2. **GNUPGHOME-guard bypass** (M-5 could have under/over-blocked): NEGATIVE. `case "$HOME"/*`
   refuses paths outside `$HOME/` (host `/host-gnupg` mount → refused), refuses `$HOME`
   itself (prevents `rm -rf $HOME`), benign on trailing slash; `mountpoint -q` catches a
   direct bind onto `$HOME/.gnupg`; default `$HOME/.gnupg` prune path unbroken.

## Per-cluster confirmation

H-A README side-mount (grep recreate-pattern `gnupg:/home/vscode/.gnupg:ro` = 0 matches;
only "deliberately NOT used" negative-instruction remains) · H-B README in M2_FILES +
workflow-self-exclusion sound · M-1 cargo `/opt/cargo` owned+on-PATH, slim build unaffected,
old `/home/.../.cargo` line removed · M-3/M-4 broadened regexes re-run CLEAN over tree incl
README, PEM/xox/github_pat/glpat/ya29 added (b)+(6) · L-1 anchored org-slug flags
`esperie-evil/`, passes `esperie/` · L-2 dirmngr+scdaemon sockets excluded · L-3 `ensure_env`
idempotent, no double-run · M-9 spec↔code GPG-denylist parity.

Mechanical sweep over committed tree (both agents): `/Users/`+`/home/<name>` = 0 (only
`/home/vscode` + `${HOME}`); key-shapes = 0 (only `.env.example` placeholders, excluded);
hostnames/operator-ids = 0; org slugs = only allowlisted; Dockerfile real `COPY`/`ADD` = 0.

## Residual (MEDIUM — NOT a regression, NOT introduced by the fixes; informational)

AWS _secret_ access keys (40-char, no prefix) + generic high-entropy tokens are inherently
uncatchable by shape-grep. Acknowledged inherent limit of regex secret-detection; structural
defenses (no source COPY, `.env` git+docker-ignored, runtime-only key injection) remain the
PRIMARY control and are intact, so this does not block convergence. **Optional future
hardening (user decision, not a finding):** add an entropy scanner (gitleaks / trufflehog)
to the CI disclosure gate as defense-in-depth. Recommendation — defer: the current
shape-grep + structural-defense composition is sound for a public template; an entropy
scanner adds a CI dependency + a placeholder-key allowlist to maintain. Surface to the user;
do not auto-add (it is a new capability, outside the redteam-convergence set).

## Convergence statement (honest)

- **Static layers (code-quality · security · spec-compliance · disclosure): CONVERGED.**
  R2 found 19 → all fixed → R3 (2 independent lanes) CLEAN with no regression. Because R3
  made zero edits, the validated state is final; a byte-identical 2nd confirming round adds
  no signal. The "2 consecutive clean rounds" stability intent is satisfied for the static
  surface (fixes introduced no new findings).
- **Live layers (docker build · T17 user-flow walks): PENDING** — no Docker daemon this
  session. The CI `.github/workflows/docker-build.yml` job (native amd64 build + smoke +
  disclosure gate) is the live confirming round; it fires on the feat PR. T17 manual walks
  (signing, both-binding import, no-rebuild dep add) tracked in `todos/active/04-verification-walks.md`
  - journal/0017. NOT closed-by-assertion.
- **Feat PR: HELD** — gated on loom #387 per `.session-notes` (a `/sync rs` would clobber
  Dockerfile + bin/dev + overlays until the loom-side durable fix lands). Not opened this session.
