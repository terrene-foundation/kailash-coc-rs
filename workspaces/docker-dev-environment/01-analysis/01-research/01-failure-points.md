# Failure-Point & Risk Analysis — Dockerized Dev Environment for kailash-coc-rs

> Source: `risk-analyst` agent (read-only), persisted + path-scrubbed by orchestrator.
> All paths repo-relative (workspace docs may be committed to a public repo).
>
> **SUPERSEDED NOTE (resolves R1/C1 — read this first):** this doc was authored
> BEFORE the live binding research landed and still frames R1 + some success criteria
> around `pip install kailash-rs`. That premise is **resolved**: `kailash-rs` is 404 on
> PyPI; the Rust-powered Python binding is **`kailash-enterprise`** (manylinux wheels,
> both arches). Wherever this doc says `kailash-rs` (R1 row, the Phase-1 gate, the
> success criterion), read **`kailash-enterprise`**. R1 is therefore NOT a blocking
> unknown — both bindings ship prebuilt for arm64 + amd64 (see
> `02-external-toolchain-research.md` + `02-requirements.md` § C1).

## Executive Summary

A Dockerized polyglot (Rust + Python + Ruby + Node + 3 CLIs + Postgres) dev
environment for this public template is **buildable but carries one CRITICAL
blocking unknown and one CRITICAL live disclosure finding** that must be
resolved before `/implement`.

- **Blocking unknown (R1):** whether the `kailash-rs` PyPI wheel and `kailash`
  RubyGems gem actually exist for arm64 AND amd64. The image's core value
  proposition (real bindings, real Postgres, no FFI mocking) collapses if they
  do not. → depends on the `toolchain-researcher` findings.
- **Live disclosure finding (R2):** `.claude/settings.json` already ships
  hardcoded `/Users/<operator>/repos/...` operator paths (lines 36–43) into this
  public template, and line 3 mislabels the rs template "(Python)". Pre-existing
  leak in an EMITTED artifact — the Docker work must not replicate the pattern,
  and the leak should be fixed at the loom emitter (covers all templates), not
  hand-patched here.

**Complexity: Complex.** Polyglot multi-arch + public-disclosure surface +
loom-provenance question + a hard external dependency on artifacts whose
existence is unverified.

## Verified Ground Truth (re-derived from the repo, not the brief)

| Claim                                          | Verified state                                                                                                             | Source                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Hooks need `npm install`                       | **FALSE** — hooks are zero-dependency Node (`#!/usr/bin/env node`, no external require/import). Need a Node _runtime_ only | grep for non-relative requires in `.claude/hooks/` → none; 29 hooks |
| `.codex-mcp-guard` is the only npm-dep surface | **TRUE** — `@modelcontextprotocol/sdk` ^1.29, `zod` ^4, `node>=18`; committed `package-lock.json` (→ `npm ci`)             | `.codex-mcp-guard/package.json` + lockfile                          |
| MCP guard is Codex-only                        | **FALSE** — load-bearing for BOTH Codex AND Gemini                                                                         | `.codex/config.toml` + `.gemini/settings.json` both spawn it        |
| Guard depends only on its npm deps             | **FALSE** — `server.js` spawns `node ../hooks/<source_file>` subprocesses → needs Node + hooks present                     | `.codex-mcp-guard/server.js`                                        |
| `auto-format.js` needs formatter binaries      | **TRUE but degrades gracefully** — shells black/ruff/`npx prettier`, try/catch returns "not found"                         | `.claude/hooks/auto-format.js`                                      |
| Docker artifacts already exist                 | **FALSE** — greenfield (no Dockerfile/.devcontainer/compose)                                                               | Glob → none                                                         |
| CI arch                                        | **amd64 only** (`runs-on: ubuntu-latest`)                                                                                  | `.github/workflows/validate.yml`                                    |
| Template ships operator paths                  | **TRUE — LIVE LEAK** at `.claude/settings.json` lines 36–43                                                                | `.claude/settings.json`                                             |

## Risk Register (severity-sorted)

| #   | Risk                                                                                                                 | Sev      | Likelihood          | Blast radius                            | Mitigation                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------- | ------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | `kailash-rs` wheel / `kailash` gem may not exist per-arch — image's core promise unverifiable                        | **CRIT** | Unknown (blocking)  | Whole deliverable                       | Block `/implement` on live `pip index versions kailash-rs` + `gem search ^kailash$` per-arch. Rust-toolchain source-build fallback (ADR-002)     |
| R2  | Hardcoded `/Users/<operator>/...` paths already in `settings.json` + risk Docker artifacts replicate literal home paths | **CRIT** | High (pre-existing) | Public repo, permanent in git           | Disclosure-scrub checklist; bind-mounts via `${HOME}`/compose `${VAR}`; fix the existing `settings.json` leak at the loom emitter                |
| R3  | Host CLI-config bind-mount → host OAuth tokens leak into a committed image layer if `COPY`'d instead of mounted      | **CRIT** | Med                 | Permanent credential exposure           | Mounts are runtime volumes ONLY, never `COPY`/`ADD`; `.dockerignore` excludes `.env` + config dirs; no `--build-arg` secrets                     |
| R4  | glibc vs musl: PyO3 manylinux wheels + Magnus native gems need glibc; Alpine silently breaks FFI at runtime          | **HIGH** | High if Alpine      | Bindings unusable                       | Mandate Debian/Ubuntu glibc base; reject Alpine in an ADR                                                                                        |
| R5  | Multi-arch wheel/gem gap: arm64 prebuilt exists but amd64 not (or vice versa)                                        | **HIGH** | Med                 | Half of users broken/slow               | Per-arch verification (R1); QEMU fallback documented; source-build covers the gap arch                                                           |
| R6  | Loom `/sync` clobbers hand-added Docker files OR they drift from py template                                         | **HIGH** | Med-High            | Silent loss of infra on sync            | ADR resolving provenance (template-owned + preserve-list, like `CLAUDE.md`); design for by-construction mirror-ability with py                   |
| R7  | Interactive OAuth login inside container needs a browser callback a headless container lacks                         | **HIGH** | High                | CLI auth unusable for sub users         | Host-config bind-mount carries existing OAuth in (primary); `.env` API keys headless fallback; no in-container browser login                     |
| R8  | UID/GID mismatch: root-in-container creates root-owned files on host bind-mount; Codespaces vs local differ          | **HIGH** | High                | Permission denial / fouled tree         | Non-root `dev` user + `USER_UID`/`USER_GID` build args; devcontainer `remoteUser` + `updateRemoteUserUID`                                        |
| R9  | Fat image / cold-build time: Rust+Py+Ruby+Node = multi-GB, 15–45min first build                                      | **HIGH** | High                | Poor first-run; promise at risk         | Multi-stage (drop Rust build toolchain from runtime); BuildKit cache mounts; named volumes for cargo/pip/bundle/npm; deps-before-source layering |
| R10 | CLI install drift: 3 fast-moving npm CLIs; latest-vs-pin                                                             | **MED**  | High                | Reproducibility vs staleness            | Pin CLI versions in Dockerfile; upgrade = one-line bump + rebuild (tools, not libs → pin is correct)                                             |
| R11 | Node too old: sdk ^1.29 + zod ^4 need Node ≥18; distro default may be 12/16                                          | **MED**  | Med                 | MCP guard dies → Codex+Gemini unguarded | Install Node 20 LTS explicitly; `npm ci` in `.codex-mcp-guard/`; global npm bin on PATH                                                          |
| R12 | Postgres readiness race: workspace connects before DB ready                                                          | **MED**  | High                | First-run failure                       | `healthcheck: pg_isready` + `depends_on: condition: service_healthy`; throwaway creds, non-exposed net                                           |
| R13 | User-dependency extensibility friction: added deps lost on rebuild                                                   | **MED**  | High                | Users fork base (defeats sync)          | Two-layer model: project-owned overlay files + shared-env install; named cache volumes; documented one-liner                                     |
| R14 | Rust toolchain bloat when bindings are prebuilt (toolchain unused at runtime)                                        | **MED**  | Med                 | Image size, build time                  | Multi-stage: toolchain in build stage for fallback only; runtime stage omits it when prebuilt resolves                                           |
| R15 | Postgres data persistence ambiguity                                                                                  | **LOW**  | Low                 | Dev confusion (non-exposed)             | Named volume for `/var/lib/postgresql/data` + documented reset command; obviously-throwaway creds                                                |
| R16 | **(peer-validated)** "add package without rebuild" silently broken — base & overlay install to DIFFERENT locations   | **HIGH** | High                | Headline feature silently dead          | ONE shared environment per language. **rs: applies TWICE** — shared Python env AND shared Ruby `GEM_HOME`/bundle path                            |
| R17 | **(peer-validated)** gpg installed but signing still broken — signing key + terminal handling missing                | **HIGH** | High                | Multi-operator signing broken           | `gnupg` in inventory; signing key mounted READ-ONLY from host; `GPG_TTY`/pinentry handling                                                       |
| R18 | **(operator directive)** heavy ML/Align (torch-class, multi-GB) bloat first-run + image size                         | **HIGH** | High                | Slow first-run for everyone             | Opt-in heavy layer (compose profile / build-arg), NOT in base; default image slim                                                                |
| R19 | **(peer-validated)** `sudo` shortcut undoes the non-root security model                                              | **MED**  | Med                 | Security model defeated                 | No `sudo` in running container; OS packages via `Dockerfile.user` rebuild                                                                        |
| R20 | Two-layer model failure modes: overlay drift; sync clobbers base while overlay references a removed base package     | **MED**  | Med                 | Broken overlay after sync               | Overlay references are additive-only; base removals documented in template CHANGELOG; overlay setup script tolerant of missing base deps         |

## Per-Axis Detail (condensed)

1. **Multi-arch** — binding artifacts are arch-specific native builds; no universal wheel/gem. QEMU works but 5–20× slower. Base images are multi-arch and not the constraint — the bindings are. Verify both arches live (R1/R5).
2. **glibc vs musl** — manylinux is a glibc ABI contract; Alpine/musl breaks at runtime `import`, not install (passes naive build check). Debian/Ubuntu base; reject Alpine.
3. **Rust toolchain** — ~1.5GB; needed only for the source-build fallback. Multi-stage isolates it to a build stage; runtime stays thin when prebuilt wheels/gems resolve. Honors the binding-consumer constraint (toolchain is infra, never user-facing).
4. **CLI install drift** — pin exact versions; layer-cache makes build-on-first-use cheap; upgrade is explicit.
5. **Node runtime** — guard is a security boundary for TWO of three CLIs; Node ≥18 mandatory; `npm ci` in guard dir; prettier on PATH.
6. **Credential leakage (public-repo core)** — runtime bind-mounts ONLY; `.dockerignore` blocks `.env` + config dirs; zero build-arg secrets; surface the pre-existing `settings.json` leak.
7. **User extensibility** — two-layer model: baked manifests (rebuild path) + overlay files + shared-env install (no-rebuild path) + named cache volumes. **rs adds a Ruby overlay alongside the Python one.**
8. **UID/GID** — non-root `dev` user; build-arg UID/GID; document Mac-vs-Codespaces UID difference.
9. **Postgres lifecycle** — healthcheck + `service_healthy` dependency; throwaway creds, non-exposed net; named volume + reset.
10. **Provenance / loom regeneration** — Docker files are NEW + unclassified in the emission flow. ADR: template-owned + preserve-list (like `CLAUDE.md`), designed for mirror-ability with py. Do NOT read the py repo.
11. **Interactive auth** — host-config bind-mount carries existing OAuth in; `.env` fallback; fresh in-container OAuth NOT supported (re-auth on host; mount carries it in).
12. **Image size / cold-build** — multi-stage; BuildKit cache mounts; deps-before-source; document expected first-build time.

## Disclosure-Scrub Checklist (public-repo gate — MUST pass before `/implement` ships)

- [ ] No `/Users/<name>/...` or `/home/<name>/...` absolute paths in any committed Docker file (host paths via `${HOME}`/`${PWD}`/compose `${VAR}` only)
- [ ] No API keys, tokens, JWT secrets, passwords in `Dockerfile` / `docker-compose.yml` / `devcontainer.json` / scripts
- [ ] No `--build-arg` carrying a secret (`docker history` would not reveal it)
- [ ] No `COPY .env` / `COPY ~/.claude` / `ADD` of any config or secret dir
- [ ] `.dockerignore` present, excludes `.env`, `**/.env`, host config dirs, `.git`, `node_modules`, `secrets/`, `*.pem`, `*.key`, `.claude/learning/`
- [ ] Postgres creds obviously-throwaway (`postgres`/`postgres`), non-exposed network, documented dev-only
- [ ] No GitHub org slugs beyond public `terrene-foundation`/`esperie` already in README
- [ ] No hostnames, machine names, internal infra, client/engagement/workspace identifiers
- [ ] Any deployment-specific value lives in a gitignored `*.local` file with a committed `.example` schema (the `ci-runners.operator.local.md` #260 pattern)
- [ ] Disclosure scanner run against new Docker artifacts → exit 0
- [ ] **Adjacent finding flagged:** pre-existing `/Users/<operator>/...` leak in `.claude/settings.json` lines 36–43 + the "(Python)" mislabel on line 3 → surfaced to user; fix at loom emitter

## Implementation Roadmap (autonomous-execution cycles, not human-days)

- **Phase 1 (blocking gate):** researcher verifies live existence of `kailash-rs` wheel + `kailash` gem per-arch (R1/R5); resolve ADR provenance with the user. No Docker work proceeds until R1 returns.
- **Phase 2:** author Dockerfile (multi-stage, glibc base, Node 20, pinned CLIs, conditional Rust toolchain) + `.dockerignore` + `docker-compose.yml` (workspace + healthchecked Postgres + opt-in ML profile) + `.devcontainer/devcontainer.json` (non-root dev user) + overlay scaffolds (`requirements-user.txt`, Ruby overlay, `Dockerfile.user`, `compose.override.yml`) + `bin/dev`.
- **Phase 3:** disclosure-scrub pass + literal user-flow walk (clone → `./bin/dev` → 3 CLIs + Node hooks + both bindings + live Postgres + add-a-dep one-liner, with verbatim receipts) + `/redteam`.

## Success Criteria (measurable)

- [ ] `pip install kailash-rs` AND `gem install kailash` resolve on arm64 AND amd64 (or source-build fallback verified for the gap arch)
- [ ] One documented command → shell with all 3 CLIs invocable, Node ≥18, both bindings importable, live Postgres via `DATABASE_URL`
- [ ] `import kailash` (Python) and `require "kailash"` (Ruby) succeed against real Postgres — no FFI mocking
- [ ] `docker history <image>` reveals zero secrets; grep for `/Users/`/`/home/` in Docker files → zero; checklist 100% green
- [ ] Adding a project dep is a documented one-liner surviving rebuild
- [ ] `.codex-mcp-guard` `npm ci` succeeds + `node server.js --self-check` passes (guard live for Codex + Gemini)
- [ ] Bind-mounted source files created in-container owned by host user, not root
- [ ] First-run brings Postgres up healthy before workspace connects
- [ ] A future `/sync rs` does not clobber the Docker artifacts (preserve-list verified)
- [ ] Heavy ML/Align deps absent from default image; present only under the opt-in profile
