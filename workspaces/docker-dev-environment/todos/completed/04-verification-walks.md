# Milestone 4 — Verification (User-Flow Walks + Consistency)

**Value anchor:** `briefs/01-brief.md` § Success criteria + the repo's `user-flow-validation.md`
rule ("NEVER give something that has NOT been FULLY TESTED — go through what a human user
will need to and ensure it works"). This milestone is the LAST mile before "done" applies to
the whole deliverable; it is not optional polish — it is the discipline gate.

## T17 — [verify] Literal user-flow walks with scrubbed receipts

Implements: all `specs/`; gated by `user-flow-validation.md` MUST-1+2+5.

For EACH flow in `03-user-flows/01-user-flows.md`, invoke the literal user path, capture
verbatim command + output + disposition (proceed/blocked/confused), embed scrubbed receipts
(per `user-flow-validation.md` MUST-6 — no secrets, no operator/host identifiers) in the PR:

- [ ] Flow 1 — clone → `./bin/dev` → 3 CLIs + hooks + both bindings (Rust-backed) + live Postgres.
- [ ] Flow 2 — add a dep (Python AND Ruby) via overlay → importable in same shell, no rebuild; survives `build --no-cache`.
- [ ] Flow 3 — both auth paths (`.env` keys; host-config mount).
- [ ] Flow 4 — `git commit -S` signs (gnupg + key + GPG_TTY).
- [ ] Flow 5 — `--profile ml` pulls heavy deps; default stays slim.
- [ ] Flow 7 — CI amd64 build + smoke + disclosure gate green.
- [ ] Disclosure-scrub checklist 100% green on the final artifact set (re-run, not assumed).

## T18 — [verify] Cross-template consistency contract

Implements: `specs/provenance-sync.md` (NFR-10). Do NOT read the py repo (repo-scope-discipline).

- [ ] Confirm the 80% agnostic base is authored so the rs-only delta (Ruby binding + opt-in Rust) is isolated to clearly-marked sections — the documented mirror-ability contract.
- [ ] Note for the loom owner: add the Docker artifacts to the template-owned preserve-list AND apply the same `settings.json`-leak fix + README package-name fix upstream (so all `kailash-coc-*` templates converge).

**Milestone-4 done when:** every flow has a scrubbed verbatim walk receipt in the PR and the
disclosure checklist is green. Per `user-flow-validation.md`, NOTHING is declared "done"
before these walks.
