# Architecture Plan — Dockerized Dev Environment (kailash-coc-rs)

Consolidates `01-analysis/` (failure points, requirements, ADRs, external research)
into the build plan. Phase output for `/analyze`; gates into `/todos`.

## Brief corrections (GATE before /todos)

All resolved this phase by live research — see `02-requirements.md` § Brief corrections.

- **C1 (was BLOCKING):** Python binding is **`kailash-enterprise`**, not `kailash-rs`
  (404 on PyPI). Resolved against the live registry + CLAUDE.md. README's `kailash-rs`
  string is stale (doc follow-up, out of scope).
- **C2:** Smoke test must assert the **Rust-backed** binding (pure-Python `kailash`
  is a look-alike trap).
- **C3:** Ruby `gem install kailash` holds (precompiled multi-arch).
- **C4:** Prebuilt artifacts cover both arches → **Rust toolchain is opt-in**, not base.
- **C5:** Node floor is **20** (Gemini runtime), not 18.
- **C8 (adjacent leak):** `.claude/settings.json` ships operator paths + a "(Python)"
  mislabel → fix at loom emitter, surfaced to user.

## Layered architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ ENTRY            ./bin/dev   |  "Reopen in Container" |  docker compose │
├─────────────────────────────────────────────────────────────────────┤
│ COMPOSE          workspace  ──DATABASE_URL──▶  db (postgres, internal)  │
│ (docker-compose) │                              healthcheck-gated       │
│                  │  + opt-in: redis (commented), ml profile             │
├─────────────────────────────────────────────────────────────────────┤
│ WORKSPACE IMAGE (slim base, template-owned, glibc ubuntu-24.04 @digest) │
│   runtimes: Node 20 · Python · Ruby     (Rust = OPT-IN layer)           │
│   CLIs (pinned major): claude · codex · gemini                          │
│   hooks (zero-dep Node) + .codex-mcp-guard (npm ci)                     │
│   bindings: pip kailash-enterprise (Py) + gem kailash (Ruby)            │
│   gnupg + GPG_TTY (commit-signing)                                      │
├─────────────────────────────────────────────────────────────────────┤
│ SHARED ENV       one Python env  +  one Ruby GEM_HOME  (base ∪ overlay) │
├─────────────────────────────────────────────────────────────────────┤
│ OVERLAY (project-owned, sync never touches)                             │
│   requirements-user.txt · Gemfile.user · Dockerfile.user · compose.override.yml │
├─────────────────────────────────────────────────────────────────────┤
│ SECRETS (runtime only, never in layers)                                 │
│   .env (env_file) · ${HOME}/.claude|.codex|.gemini (mounts) · signing key (ro) │
└─────────────────────────────────────────────────────────────────────┘
```

## File manifest (what /implement creates — all template-owned root files unless noted)

| File                                  | Purpose                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Dockerfile`                          | Multi-stage slim base; glibc; Node 20; CLIs; guard `npm ci`; bindings; gnupg.              |
| `docker-compose.yml`                  | `workspace` + `db` (healthchecked, internal); opt-in redis + `ml` profile.                 |
| `.devcontainer/devcontainer.json`     | Editor/Codespaces entry; delegates to compose service `workspace`.                         |
| `.dockerignore`                       | Excludes `.env`, host config dirs, `.git`, secrets, `.claude/learning/`.                   |
| `bin/dev`                             | One-command entry: ensure `.env`, `up -d`, wait healthy, exec shell.                       |
| `requirements.txt` (base, template)   | Base Python deps (incl. binding pin).                                                      |
| `Gemfile` (base, template)            | Base Ruby deps (incl. gem pin).                                                            |
| `requirements-user.txt` (overlay)     | **Project-owned** user pip deps (shipped empty + commented).                               |
| `Gemfile.user` (overlay)              | **Project-owned** user gems (rs delta; shipped empty + commented).                         |
| `Dockerfile.user` (overlay)           | **Project-owned** user apt/system deps (rebuild path).                                     |
| `compose.override.yml.example`        | Shipped example for project-owned services/mounts.                                         |
| `.env.example` (extend existing)      | Add any new placeholders (keys already present).                                           |
| `.gitignore` (extend existing)        | Add `*.local`, `compose.override.yml`, overlay-local patterns.                             |
| `README.md` (extend — template-owned) | "Run in Docker" Quick Start.                                                               |
| `.github/workflows/docker-build.yml`  | NEW — `docker buildx` amd64+arm64 build + disclosure grep (NOT an edit to `validate.yml`). |

## Shard map (within per-session capacity budget; mostly declarative config)

- **Shard 0 (gate):** confirm with user — (a) the `kailash-enterprise` resolution
  (already research-backed), (b) ADR-10 template-owned classification, (c) disposition
  of the C8 settings.json leak. No build until (b) confirmed.
- **Shard 1 — Core image + topology:** `Dockerfile` (slim base, Node 20, CLIs, guard
  `npm ci`, bindings, gnupg) + `.dockerignore` + `docker-compose.yml` (workspace + db) +
  `.devcontainer/devcontainer.json` + `bin/dev`. Feedback loop: `docker buildx build` +
  smoke tests. Then **walk the user flow** (`user-flow-validation.md`).
- **Shard 2 — Extensibility + secrets:** two-layer overlay files + shared-env wiring
  (NFR-12) + setup script (no-rebuild path) + `.env`/host-mount auth + signing-key mount
  - `*.local`/`.example` split + `.gitignore` updates. Walk the add-a-dep + auth flows.
- **Shard 3 — Multi-arch CI + opt-in layers + disclosure gate:** `docker-build.yml`
  (amd64+arm64) + disclosure grep gate + opt-in `ml` profile + opt-in Rust layer +
  README Quick Start. Walk the CI + ML-opt-in flows.

Each shard ≤ the load-bearing-logic / invariant / call-graph ceilings; Shard 1 has a
live build+smoke feedback loop (3–5× budget multiplier).

## Quality gates

- `/implement`: reviewer + security-reviewer (background) — security-reviewer focus =
  the disclosure-scrub checklist + no-secrets-in-layers (NFR-05) + the C8 leak.
- Every shard ends with a **literal user-flow walk + verbatim receipts**
  (`user-flow-validation.md`), scrubbed for public surface.
- `/redteam`: multi-arch matrix, credential-leak audit, the peer red-team's 6 findings
  re-verified against the rs artifacts, shared-env trap (×2: Python + Ruby).

## Cross-template consistency (NFR-10)

80% agnostic base authored identically across `kailash-coc-*`; rs delta (Ruby binding +
opt-in Rust) isolated to marked sections. Contract documented in `specs/provenance-sync.md`.
Do NOT read the py repo.
