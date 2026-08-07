# 0014 — DECISION: /codify cycle — M2+M4 Docker dev-env patterns lifted to loom

**Date:** 2026-05-28
**Phase:** /codify (after M4 closure)
**Branch:** `codify/jack-hong-2026-05-28`
**Proposal:** `.claude/.proposals/latest.yaml` (status: `pending_review`)

## Two patterns proposed for lifting

### Pattern A — Cross-platform GPG keyring bootstrap (FR-25)

Surfaced by M4 Walk 4: direct mount of host `~/.gnupg` into a Linux
container cannot deliver `git commit -S` on macOS hosts (gpg-agent ABI
gap). Side-mount `/host-gnupg:ro` + prune-then-copy + denylist tar in
`bin/dev setup` is the structural fix.

Receipts: `0012-DECISION-walk4-gpg-agent-host-linux-abi-gap.md`,
commits `176bd0b` + `e1142b2`, live verification 2026-05-28.

Cross-template inheritance: when loom kailash-coc-py's Docker mirror
lands (loom #388), Pattern A applies unchanged — gpg-agent ABI is a
host:Linux concern, not language-specific.

### Pattern B — Bundler shared-env trap (Ruby NFR-12)

Surfaced by M2 R1: `BUNDLE_PATH=<anything>` forces bundler's nested-
layout install which breaks plain-shell `require`. Defense:
`env -u BUNDLE_PATH -u BUNDLE_APP_CONFIG` in every install path AND a
CI smoke test asserting both unset.

Receipts: `0009-DECISION-ruby-overlay-bundle-no-bundlepath.md`,
commit `9d88900`.

### Pattern C — Docker disclosure-scrub 7-check pattern (deferred to second skill)

Surfaced by M3 R1 + verified live by M4 Walk 7. Lifted as a separate
skill (`skills/18-security-patterns/docker-disclosure-scrub.md`) so
public-template fleet across SDKs can adopt mechanically.

## Self-referential surface check

Per `rules/self-referential-codify.md` Rule 2, this codify's proposal
file (`.claude/.proposals/latest.yaml`) is NOT on the self-referential
surface allowlist. The proposed loom-side files
(`skills/10-deployment-git/docker-dev-env-patterns.md`,
`skills/18-security-patterns/docker-disclosure-scrub.md`) WOULD be on
the allowlist (`skills/30-claude-code-patterns/**` is allowlisted; for
adjacent skill paths the rule's boundary-favoring-the-gate disposition
applies — when loom Gate-1 classifies these, the multi-agent redteam-
with-tests gate fires at loom's `/codify`-equivalent step). At the
USE-template `/codify` originator side, the proposal itself is not in
the surface — but the cc-architect + reviewer + security-reviewer team
runs anyway per `rules/cc-artifacts.md` Rule 6 ("every `/codify`
deploys cc-architect") to validate proposal-structure compliance with
the Step 7b schema.

Bootstrap-circularity carve-out: N/A — neither pattern is a meta-rule
about `/codify` itself.

## Trust Posture Wiring for proposed rules

Both patterns ship as skills, not rules. The new skills carry their own
MUST clauses (Pattern A: "MUST use side-mount + prune-then-copy +
denylist tar"; Pattern B: "MUST `env -u BUNDLE_PATH -u BUNDLE_APP_CONFIG`
in every bundle-install path"). Per `rules/trust-posture.md` MUST Rule
7, IF loom Gate-1 classifies these as RULE additions (not skill-only),
the Trust Posture Wiring 8-field section will be required. The proposal
flags this for the loom Gate-1 classifier:

- If classified as **rule additions** (e.g., to `rules/deployment.md` or
  a new `rules/docker-dev-env.md`): wiring section required.
- If classified as **skill additions** (the suggested path): skill-MUSTs
  carry their own discipline without the wiring template — the wiring
  template applies to `rules/*.md`, not `skills/**`.

## Disclosure-scrub status

Proposal body scrubbed per `rules/upstream-issue-hygiene.md` MUST-2:

- No operator project names beyond first-party (kailash-coc-rs is a
  Foundation-public template, public-knowledge per its own README).
- No internal paths beyond the SDK / template surface
  (`bin/dev`, `compose.override.yml.example`, `Dockerfile`, etc. — all
  public-surface artifact names).
- No operator host identifiers (the `<HOSTNAME>.local.NNNNN` pattern in
  the proposal body is a generic shape illustrating the macOS lock-file
  format, not a captured operator hostname).
- No key fingerprints / IDs / emails (the live-verification claim cites
  "1 secret key" as an integer count, not key material).
- Tracked workspace identifiers (workspaces/docker-dev-environment/...)
  appear ONLY in the receipts list as commit-message-equivalent
  pointers, NOT in the proposed-skill prose. Loom Gate-1's intake-
  disclosure-scrub (`rules/artifact-flow.md` § "Intake Disclosure
  Scrub") will re-validate before placement.

## Origin

USE-template `/codify` origination per `rules/artifact-flow.md` §
"Authority Chain" + `skills/30-claude-code-patterns/sync-flow.md` §
"USE-Template Proposal Schema (Step 7b)". This is the authoritative
target flow for COC-artifact improvements from `kailash-coc-rs`.
Co-owner authorization via the AskUserQuestion answer "Run /codify
cycle (F6) now" (this session, 2026-05-28).
