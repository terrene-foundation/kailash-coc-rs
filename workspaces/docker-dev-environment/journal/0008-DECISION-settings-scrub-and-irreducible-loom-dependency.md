# 0008 — DECISION — Flagged-item resolution: in-scope done; loom-side (F5) is irreducible

**Date:** 2026-05-27 · **Phase:** /implement → /wrapup

## Operator directive

> "we need to resolve the flagged items, /wrapup for next session"

## Resolved THIS session (in-scope, kailash-coc-rs)

- **F6 — open GitHub issues:** `gh issue list --repo terrene-foundation/kailash-coc-rs
--state open` → empty (exit 0). **No open issues.** F6 closed.
- **settings.json disclosure leak (local half):** scrubbed the 8 operator-absolute-path
  `permissions.allow` entries (`/Users/<operator>/repos/...`) + corrected the "(Python)"
  mislabel → "(Rust)". Commit `4475933`. Entries were non-load-bearing under
  `defaultMode: bypassPermissions` and meaningless in a downstream clone; JSON re-validated.
- **Open question "commit workspace/process docs?":** RESOLVED — they stay untracked/internal
  (public repo ships deliverables only). Established by the M1 commit pattern; no gitignore
  policy change made (avoids template-wide churn).

## NOT resolvable from this repo — requires a loom session (F5, reduced scope)

Per `repo-scope-discipline.md`, the agent MUST NOT edit loom from a kailash-coc-rs session,
and the loom-side work is a multi-file workstream (not a bounded user-authorized exception):

1. **Durable settings.json fix at the loom emitter** — the local scrub (4475933) is
   defense-in-depth; if loom regenerates `.claude/settings.json` on `/sync`, the leak
   returns unless loom's source is fixed. AND the local scrub sits on `feat/...`, so public
   `main` still carries the leak until either this branch lands or a dedicated scrub PR merges.
2. **Add the Docker artifact paths to loom's template-owned preserve-list** (FR-20) — else
   the next `/sync rs` clobbers M1's Docker files.
3. **Mirror the Docker env to the other `kailash-coc-*` templates** (NFR-10 cross-template
   consistency) + fix the README `kailash-rs` → `kailash-enterprise` string at the source.

**Disposition:** F5 stays BLOCKED on a loom session. The honest boundary: I cannot
"resolve" F5 from here without violating repo-scope; recommending the operator open a loom
session is the correct path, not a self-authorized cross-repo reach.

## Still externally blocked (unchanged)

- **F4 Ruby binding** — upstream gem defect `esperie-enterprise/kailash-rs#1151`.
