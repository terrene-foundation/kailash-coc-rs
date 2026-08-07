# 0013 — DECISION: M4 T18 cross-template consistency contract verified

**Date:** 2026-05-28
**Phase:** M4 (verification walks)
**Task:** T18 — cross-template consistency contract per `specs/provenance-sync.md` NFR-10

## Audit: rs-only delta is isolated to clearly-marked sections

The 80% agnostic base + rs-only delta contract per `specs/provenance-sync.md`
holds across every Docker artifact:

| Artifact                             | Language-agnostic body                                                                                                | rs-only delta (clearly marked)                                                                                                                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                         | base image, vscode user, /opt/venv setup, CLI install, MCP guard deps, GPG_TTY env                                    | Ruby block (lines 40–94: `GEM_HOME`/`GEM_PATH`, `ruby-full ruby-dev`, bundler + kailash gem install); opt-in Rust toolchain (lines 29, 97–101 `INCLUDE_RUST` build-arg). Header comments name the rs-only nature explicitly. |
| `docker-compose.yml`                 | services topology, `env_file`, Postgres throwaway creds, profiles                                                     | NONE — fully language-agnostic. Py mirror copies this file verbatim.                                                                                                                                                         |
| `bin/dev`                            | overlay framework, env load, MCP-guard install, Python overlay, npm overlay, GPG keyring bootstrap                    | Ruby overlay branch in `INSTALL_OVERLAYS_SH` (`has_gem_decl Gemfile.user` → `BUNDLE_PATH`-unset bundle install). Comment cites NFR-12 shared-env trap.                                                                       |
| `Gemfile.user`                       | (scaffold-only)                                                                                                       | All of it — file's header line 2 explicitly declares: `(rs-template delta vs kailash-coc-py — Python templates have no Ruby overlay.)`                                                                                       |
| `Dockerfile.user`                    | scaffold for project apt overlay                                                                                      | NONE — agnostic.                                                                                                                                                                                                             |
| `compose.override.yml.example`       | host CLI-config mounts (.claude, .codex, .gemini), GPG side-mount, env overrides, build-args, Dockerfile.user pointer | NONE — `.gemini` mount line is parallel to `.claude` + `.codex`, not rs-specific.                                                                                                                                            |
| `.devcontainer/devcontainer.json`    | container service + postCreate                                                                                        | NONE — agnostic.                                                                                                                                                                                                             |
| `requirements-user.txt`              | scaffold-only                                                                                                         | NONE — Python overlay scaffold is the same shape in py.                                                                                                                                                                      |
| `.github/workflows/docker-build.yml` | path-filter, disclosure-scrub, slim build, smoke tests                                                                | Ruby smoke test (line 173 `gem list kailash`) is rs-only — but is correctly placed in the smoke section; py mirror drops it.                                                                                                 |

Mirror-ability test: removing the boxed rs-only sections from each artifact
above produces the py-template shape **by construction** — no shared logic
needs re-derivation. The py mirror is "the same files minus those sections",
exactly as `specs/provenance-sync.md` § "Cross-template consistency (NFR-10)
— by construction, not by code" promises.

## Note for the loom owner

These items are tracked as the four loom issues filed 2026-05-28 per
journal/0010 + journal/0011:

| Issue                            | Disposition                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| loom #386 (settings.json scrub)  | Public `main` STILL carries the operator-path leak in `.claude/settings.json` (feat-branch scrub `4475933` is interim only). Durable fix is loom-side. Note for the loom owner.                                                                                                                                                                                                                              |
| loom #387 (Docker preserve-list) | **PR-blocking** per `.session-notes:21`. Until loom adds Dockerfile + docker-compose.yml + bin/dev + .devcontainer/ + .dockerignore + requirements-user.txt + Gemfile.user + Dockerfile.user + compose.override.yml.example + .github/workflows/docker-build.yml to the template-owned preserve-list, `/sync rs` will clobber every Docker artifact on next run. The feat PR cannot land before #387 closes. |
| loom #388 (py mirror)            | When py's M2-equivalent Docker workstream lands, the rs-axis Docker artifacts above are the source-of-truth. Walk 4 R1+R2 GPG-agent fix (side-mount `/host-gnupg:ro` + prune-then-copy + denylist tar) applies UNCHANGED to py — the rs/py delta is the Ruby overlay only; the GPG-agent ABI gap is a host:Linux concern shared by both bindings. py inherits by construction.                               |
| loom #389 (README fix)           | Package-name accuracy (`pip install kailash-enterprise` for Python, `gem install kailash` for Ruby) — same fix shape applies to py mirror.                                                                                                                                                                                                                                                                   |

## M4 R1+R2 Walk 4 cross-template inheritance

When loom mirrors this template to kailash-coc-py per #388, the Walk 4 R1+R2
gpg-agent fix is inherited by construction:

- `compose.override.yml.example` § "GPG commit-signing key" — comment block
  - side-mount syntax `${HOME}/.gnupg:/host-gnupg:ro` is agnostic to which
    binding the user signs commits from. Copy verbatim.
- `bin/dev` § "GPG keyring bootstrap" inside `INSTALL_OVERLAYS_SH` — the
  prune-then-copy + denylist tar pipe + 700-mode lockdown is agnostic.
  Copy verbatim.
- `specs/credentials-secrets.md` § "Commit-signing key (FR-25)" — the spec
  text describes a property of the Docker dev container, not the binding;
  re-derive in the py workspace as needed but the contract holds.

No additional loom work is required to inherit the Walk 4 fix in py beyond
mirroring the rs-axis Docker artifacts (already tracked by #388).

## T18 closure

Both T18 acceptance bullets met:

- [x] 80% agnostic base authored with rs-only delta isolated to clearly-marked sections (audit above).
- [x] Loom-owner note recorded (this journal + the four loom issues #386/#387/#388/#389 already filed per journal/0010 + journal/0011 + .session-notes:33).

M4 T18 disposition: COMPLETE.
