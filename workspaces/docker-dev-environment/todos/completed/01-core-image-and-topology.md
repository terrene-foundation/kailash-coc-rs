# Milestone 1 — Core Image + Topology (Shard 1)

**Value anchor:** `briefs/01-brief.md` Goals #1 (three CLIs), #2 (Node hooks), #3 (both
bindings), #4 (real Postgres) + § Confirmed decisions (Topology, Services, Distribution).
This milestone delivers the brief's core promise: "one command → working shell with all
three CLIs, Node hooks, both bindings, and a live Postgres." HIGHEST user value — nothing
else matters until this works. Feedback loop: `docker buildx build` + smoke tests (3–5×
capacity multiplier).

## T01 — [build] Dockerfile (slim base)

Implements: `specs/base-image.md`, `specs/cli-toolchain.md`.

- [ ] Base `mcr.microsoft.com/devcontainers/base:ubuntu-24.04` **pinned by digest** (glibc; reject Alpine).
- [ ] Node 20 LTS (Gemini runtime floor); Python + Ruby via devcontainer Features (or explicit installs).
- [ ] 3 CLIs pinned to MAJOR line in one manifest: `@anthropic-ai/claude-code`, `@openai/codex`, `@google/gemini-cli`.
- [ ] `gnupg` + build prerequisites for native gems via apt.
- [ ] Non-root user = the base image's `vscode` (uid/gid 1000); `updateRemoteUserUID` remaps to host. (Deviation from "`dev`" — see container-topology.md.)
- [ ] Layer order: base → runtimes → CLIs → bindings → base manifests → (overlay last). Source bind-mounted, NOT `COPY`'d.
- [ ] **LOW-2 must-confirm:** decide single-stage vs multi-stage — Rust is opt-in-EXCLUDED (T13), so prefer single-stage UNLESS a real build-only dep materializes. Record the decision.
- [ ] No secrets, no `--build-arg` secret, no literal `/Users/` paths.

## T02 — [build] docker-compose.yml

Implements: `specs/container-topology.md`, `specs/services.md`.

- [ ] `workspace` service (builds the Dockerfile) + `db` (`postgres:16` digest-pinned).
- [ ] Postgres on internal network ONLY (no host port publish); throwaway `postgres`/`postgres`; `healthcheck: pg_isready`.
- [ ] `workspace` `depends_on: { db: { condition: service_healthy } }`; `DATABASE_URL` pre-wired.
- [ ] Named volume for `/var/lib/postgresql/data`; documented reset (`down -v`).
- [ ] Redis (and other) services shipped commented-out (opt-in); opt-in MUST NOT change default `DATABASE_URL`.

## T03 — [build] .devcontainer/devcontainer.json

Implements: `specs/container-topology.md`.

- [ ] References the compose file + `service: workspace` (`dockerComposeFile`, `service`, `workspaceFolder`); does NOT redefine the image.
- [ ] `remoteUser: vscode` + `updateRemoteUserUID: true`; `workspaceFolder` matches the compose bind-mount target.

## T04 — [build] .dockerignore + bin/dev

Implements: `specs/container-topology.md`, `specs/credentials-secrets.md`.

- [ ] `.dockerignore` excludes `.env`, `**/.env`, host config dirs, `.git`, `node_modules`, `secrets/`, `*.pem`, `*.key`, `.claude/learning/`.
- [ ] `bin/dev`: ensure `.env` (copy from `.env.example` + warn if missing), `docker compose up -d`, wait for `db` healthy, `exec workspace bash`.

## T05 — [wire] Kailash bindings + Rust-path smoke test

Implements: `specs/bindings-runtime.md` (Goal #3, #4).

- [ ] `pip install kailash-enterprise` (Python) + `gem install kailash` (Ruby) in the base, prebuilt (no compiler).
- [ ] **HIGH-1 UNVERIFIED — confirm against the installed wheel:** smoke test asserts the **Rust-backed** Python path (preferred: `importlib.metadata.version("kailash-enterprise")` resolves; secondary: `kailash` native `.so`). Pick the discriminator the installed artifact actually supports; exit non-zero if the pure-Python `kailash` was resolved instead.
- [ ] **MED-2 UNVERIFIED — confirm:** Ruby `require "kailash"` + a concrete native-ext probe.
- [ ] `import kailash` (Py) and `require "kailash"` (Ruby) succeed against the live Postgres — Tier-2, no FFI mocking.

## T06 — [wire] MCP guard + hook layer

Implements: `specs/cli-toolchain.md` (Goal #2).

- [ ] `npm ci` in `.codex-mcp-guard/` at build (lockfile present); hooks present alongside (guard spawns `node ./hooks/<file>`).
- [ ] **FR-03 split AC:** (a) `node .codex-mcp-guard/server.js --self-check` exits 0; AND (b) ≥1 hook fires end-to-end (guard spawns a hook subprocess, or session-start banner appears).
- [ ] Confirm guard is live for BOTH Codex AND Gemini.

**Milestone-1 done when:** `./bin/dev` yields a shell with `claude`/`codex`/`gemini` on
PATH, guard self-check green + a hook fires, `import kailash` + `require "kailash"` succeed
(Rust-backed), and `psql "$DATABASE_URL"` connects. Walk Flow 1 (T17) before declaring done.

## Verification (2026-05-27, /implement — Flow 1 walk receipts)

Build: `docker compose build workspace` → exit 0 (incl. the baked Rust-path assertion layer).
Walk (scrubbed; the DSN is the committed dev-only throwaway, not a secret):

```
$ docker compose up -d                 → db Healthy, workspace Started
$ git check-ignore .codex-mcp-guard/node_modules → .gitignore:53 (IGNORED ✓; not in git status)
$ npm ci (.codex-mcp-guard, runtime)   → OK
$ node .codex-mcp-guard/server.js --self-check
    tool=apply_patch entries=2 ... HOOKS_DIR=/workspace/.claude/hooks hooks_dir_exists=true  (✓ FR-03 a+b)
$ claude --version → 2.1.152   $ codex --version → codex-cli 0.134.0   $ gemini --version → 0.43.0   (✓ T02)
$ python -c "import importlib.metadata as m, kailash; m.version('kailash-enterprise')"
    → kailash-enterprise 4.2.2 (Rust-backed) OK   (✓ T05 Python; HIGH-1 discriminator green, build-gated)
$ psql "$DATABASE_URL" -tAc "select 'postgres OK'" → postgres OK   (✓ T07/db, real infra)
$ ruby -e 'require "kailash"' → LoadError: libruby-3.1.so.3.1 not found   (✗ UPSTREAM DEFECT — journal/0006)
```

**Status: COMPLETE (Ruby = accepted known-upstream-limitation per operator decision).**
T01/T02/T03/T04/T06 ✓; T05-Python ✓. **T05-Ruby BLOCKED on a verified upstream gem packaging
defect** (`kailash` 4.2.0 native ext links libruby-3.1 but gemspec floor is 3.2; no
consumer-side fix) — filed upstream as **esperie-enterprise/kailash-rs#1151**; `journal/0006`

- `journal/0007`. Operator chose "document as known limitation + continue" (the env is fully
  functional for Python today; Ruby unblocks when the SDK republishes). M1 closed on that basis.

**Review fixes applied:** HIGH-1 gitignore ✓ (verified) · MED-1 dev→vscode spec deviation ✓ ·
MED-2 Rust-path build assertion baked ✓ · MED-3 postgres digest-pin note ✓ · LOW gpg-pinentry →
M2/T10 · LOW bin/dev dedup → cosmetic, deferred. Security review: CLEAN (2 LOW non-blockers).
