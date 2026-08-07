# Spec — Provenance & loom Sync

## Authority

Where the Docker artifacts live in the loom→template flow, so `/sync` does not clobber
them and they stay consistent across all `kailash-coc-*` templates. Implements ADR-10;
serves FR-19, FR-20, NFR-10.

## File classification (recommended: template-owned)

| File class                     | Examples (existing)                                    | Docker artifacts                                                                                      |
| ------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Template-owned (preserved)** | `CLAUDE.md`, `README.md`, `.gitignore`, `.env.example` | `Dockerfile`, `docker-compose.yml`, `.devcontainer/`, `bin/dev`, base manifests, `*.example` overlays |
| Emitted (regenerated)          | `AGENTS.md`, `GEMINI.md`, `.codex/`, `.gemini/`        | — (none; Docker files are NOT emitted)                                                                |
| Project-owned (user)           | —                                                      | `requirements-user.txt`, `Gemfile.user`, `Dockerfile.user`, `compose.override.yml`, `.env`, `*.local` |

The Docker artifacts are **template-owned, repo-root files** (root placement is
required — `docker compose` looks for `docker-compose.yml` at the project root; it
cannot live under `.claude/`). They are added to loom's template-owned preserve-list
so `/sync` does not regenerate or delete them.

## Cross-template consistency (NFR-10) — by construction, not by code

- The **80% agnostic base** (topology, base image, CLI install, Node, secrets model,
  extensibility mechanism, services) is authored IDENTICALLY across `kailash-coc-*`.
- The **rs-only delta** is isolated to clearly-marked sections: the **Ruby binding**
  (`gem install kailash`, `Gemfile.user`, shared `GEM_HOME`) and the **opt-in Rust
  toolchain**. The py template is "the same files minus those sections."
- Consistency is a documented CONTRACT (this analysis), NOT a runtime dependency. We do
  NOT read the py repo (repo-scope-discipline); the contract is what keeps them aligned.

## Sync behavior

- `/sync rs` MUST preserve the Docker artifacts (template-owned). Verify after a sync
  that they are unchanged (FR-20).
- State files (posture, coordination-log) are never synced (existing rule) — unrelated
  to the Docker artifacts, noted for completeness.

## Open question (loom owner)

Confirm **template-owned** (this recommendation) vs **emitted + variant-overlaid**
(central auto-distribution, where loom would emit the base from a shared neutral source
with an rs/py variant overlay). The latter gives single-point distribution but moves
the files into the regenerated class and requires a copy-out step for the root files —
a larger change, documented as the alternative.

## Edge cases

- A future Docker fix must be applied per-template (the cost of template-owned);
  mitigated by the by-construction agnostic-base contract (mechanical to mirror).
- If a downstream consumer repo (not a template) pulls updates, the same preserve
  semantics apply via its own pull.
