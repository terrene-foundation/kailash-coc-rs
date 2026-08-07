# Red-Team Round 1 — Analysis Validation

**Date:** 2026-05-27 · **Phase:** /analyze (pre-/todos gate)
**Reviewer:** `reviewer` agent (read-only; Read/Bash/Grep/Glob), background task `a9a4ddefbccf3db73`
**Verdict (R1):** GAPS-REMAIN — 3 HIGH + 4 MED + 1 LOW (no CRIT; analysis sound, does not restart)

## Mechanical sweeps (reviewer, verbatim results)

- Sweep 1 `grep kailash-rs`: 20 hits, ALL in correction/"do-not-use"/404 context — no spec/ADR/plan prescribes installing `kailash-rs`. PASS (one stale residual → HIGH-2).
- Sweep 2 `grep /Users/ \| /home/`: 19 hits, all either quoted settings.json-leak finding or "do NOT use literal path" guidance. No accidental operator-path leak. PASS.
- Sweep 3 `grep kailash-enterprise`: consistent across specs + ADRs. PASS.
- Sweep 4 traceability: every brief item maps; no unmapped requirement. PASS (FR-03 under-specified → MED-3).
- Sweep 5 `ls specs/`: 9 specs + `_index.md`, all present, none phantom. PASS.

## Findings + dispositions (all closed this session via the reviewer's prescribed remedy)

| ID     | Finding                                                                                  | Disposition (closed)                                                                                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH-1 | Smoke-test "Rust-build marker" was an unverified mechanism asserted as settled           | `bindings-runtime.md` § Smoke test rewritten: `UNVERIFIED — /implement MUST confirm`; concrete candidate discriminators (importlib.metadata dist-name; `.so` native-ext) ordered most-robust-first.                         |
| HIGH-2 | Stale `pip install kailash-rs` in `01-failure-points.md` (R1 row, gate, success crit)    | SUPERSEDED banner added at top of `01-failure-points.md` resolving every `kailash-rs` → `kailash-enterprise`; R1 reclassified as non-blocking.                                                                              |
| HIGH-3 | CI "buildx amd64+arm64" contradicted "no QEMU" on the amd64-only runner fleet            | `ci-multiarch.md` § CI build check + ADR-09 rewritten: amd64-native blocking leg; arm64 validated natively by Mac devs; optional arm64 leg explicitly QEMU/slow/non-blocking.                                               |
| MED-1  | NFR-12 shared-env invariant unreconciled with ADR-02 Features (rvm gemset / py site-pkg) | `extensibility.md` § Concrete env-pinning contract added: explicit `GEM_HOME`/`BUNDLE_PATH`/`BUNDLE_PATH` + shared Python interpreter; `UNVERIFIED — /implement MUST verify` + Tier-2 overlay-import test (both languages). |
| MED-2  | Ruby native-ext assertion was a placeholder                                              | `bindings-runtime.md` Ruby probe concretized + `UNVERIFIED — /implement confirms`.                                                                                                                                          |
| MED-3  | FR-03 acceptance conflated guard self-check with hooks-fire                              | FR-03 acceptance split into (a) guard `--self-check` exit 0 AND (b) ≥1 hook fires end-to-end.                                                                                                                               |
| MED-4  | Disclosure checklist missed the runtime host-config bind-mount path                      | `credentials-secrets.md` checklist item added: bind-mount source `${HOME}`-interpolated, never committed path.                                                                                                              |
| LOW-2  | Multi-stage Dockerfile possible gold-plating (Rust already opt-in-excluded)              | `base-image.md` § Multi-stage: `/implement` MUST confirm multi-stage earns complexity; prefer single-stage absent a real build-only dep.                                                                                    |
| LOW-1  | ADR-10 provenance open question — `/todos` must gate on it                               | Already gated at Shard 0 (architecture plan); confirmed. User selected template-owned this session.                                                                                                                         |
| LOW-3  | Inline throwaway Postgres DSN                                                            | Sanctioned exception (NFR-09); flagged so `/redteam` does not re-raise. No change.                                                                                                                                          |

## Peer red-team parity (6 peer-validated failure modes)

5/6 fully closed at R1 (DB-from-compose, gpg key+TTY+gnupg, version-locking, no-sudo, ML opt-in); shared-env (#4) was NAMED-but-under-specified → closed by MED-1's concrete env-pinning contract.

## Convergence disposition (honest)

All R1 must-fix items are closed via the reviewer's own prescribed remedies (doc edits;
no design change). Two items resolve to **`UNVERIFIED — /implement MUST confirm`**
(HIGH-1 binding discriminator, MED-1 shared-env paths + MED-2 Ruby probe) — this is the
CORRECT disposition for greenfield design specs per `spec-accuracy.md` (do not assert an
unimplemented mechanism as settled), NOT a lingering gap; each names the concrete
candidate to verify and a Tier-2 test that proves it at `/implement`. No independent
Round-2 re-verification was run — the fixes are the reviewer's prescribed remedies
applied verbatim; a second LLM pass has low marginal value here. The `/implement`
UNVERIFIED gates are the live-runtime verification surface.

**Receipt:** reviewer task `a9a4ddefbccf3db73` (full findings in its returned report);
this round doc is the durable convergence receipt per `verify-resource-existence.md` MUST-4.
