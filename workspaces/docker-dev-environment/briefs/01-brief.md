# Brief — Dockerized Full Development Environment for kailash-coc-rs

## Request (verbatim intent)

> Create a full development environment in Docker for this `kailash-coc-rs` USE
> template, including all CLIs (Claude Code, Codex, Gemini) and all dependencies.
> Also make it possible for users to install additional dependencies as their
> projects require. The same work is asked of `kailash-coc-py`, but this template
> has **multiple bindings** (Python + Ruby) on top of the Rust runtime.

## What this template is (context)

`kailash-coc-rs` is the **multi-CLI COC USE template** for building Python or
Ruby applications that consume the Kailash **Rust** SDK through its bindings
(PyO3 wheels for Python, Magnus gems for Ruby). Downstream developers do NOT
write Rust — they write Python or Ruby that calls into the Rust runtime via the
binding layer.

The template ships one knowledge surface to three driving CLIs:

- **Claude Code** (`CLAUDE.md` + `.claude/`)
- **OpenAI Codex** (`AGENTS.md` + `.codex/` + `.codex-mcp-guard/`)
- **Gemini CLI** (`GEMINI.md` + `.gemini/`)

The hooks layer is Node.js (`.claude/hooks/*.js`); the Codex MCP guard is a
Node MCP server (`@modelcontextprotocol/sdk`, requires Node ≥18).

## Goal

A reproducible, batteries-included container environment that a downstream user
gets when they clone this template, such that they can immediately:

1. Drive development with **any of the three CLIs** (Claude Code, Codex, Gemini).
2. Run the **Node.js hook/guard layer** the COC artifacts depend on.
3. Consume the Kailash Rust SDK via the **Python binding** (`kailash-rs` wheel)
   AND the **Ruby binding** (`kailash` gem) — both runtimes present.
4. Run the Kailash frameworks (DataFlow, Nexus, Kaizen, PACT) against **real
   backing infrastructure** (rules require real Postgres / real bindings in
   Tier-2/3 tests — NO mocking at the FFI boundary).
5. **Add their own project dependencies** (pip / gem / apt / npm) cleanly,
   without forking the base image design.

## Confirmed decisions (operator, this session)

| Decision         | Choice                                                                                                                                                                                                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Topology**     | Devcontainer + docker-compose. One `workspace` service (Rust+Python+Ruby+3 CLIs); editor + Codespaces entry via `.devcontainer/devcontainer.json`; plain `docker compose` also works.                                                                                                                                                                    |
| **Services**     | Bundle PostgreSQL wired to `DATABASE_URL` out of the box. Redis/others commented-out, opt-in.                                                                                                                                                                                                                                                            |
| **CLI auth**     | Both — API keys from `.env` (headless/CI) AND bind-mount host CLI config (`~/.claude`, `~/.codex`, `~/.gemini`) so existing subscription/OAuth logins carry in.                                                                                                                                                                                          |
| **Distribution** | **CORRECTED 2026-05-29 (journal/0018):** DUAL model — (a) ship the `Dockerfile` + build-on-first-use (kept first-class) AND (b) publish a prebuilt **multi-arch image to Docker Hub (public namespace) on version tag** so users may `docker pull`-to-run. (Prior "no registry" line was an unquoted summary; reversed per verbatim co-owner directive.) |

## Hard constraints (from repo rules)

- **Binding-consumer perspective** — examples/docs use Python or Ruby, never
  `cargo` / `use crate::`. The container provides the Rust _toolchain_ only
  insofar as building bindings from source may require it; the user-facing
  surface is Python + Ruby.
- **.env is the single source of truth** for API keys + model names; never
  hardcode keys or model strings. `.env` is gitignored; `.env.example` is the
  template.
- **No secrets baked into image layers** (security.md: secrets via env only;
  git history / image layers are permanently extractable).
- **Cross-template consistency** — the same deliverable is requested for
  `kailash-coc-py`. The design must be authored so loom can manage/sync it
  consistently across all `kailash-coc-*` templates (the rs variant adds the
  Ruby binding + Rust runtime that py does not have). **Do NOT read the py
  sibling repo** (repo-scope-discipline) — design for consistency by
  construction, surface the provenance/sync question as an ADR.
- **Regeneration boundary** — `CLAUDE.md`, `.env.example`, `README.md`,
  `.gitignore` are template-owned (preserved across `/sync`). Where the Docker
  artifacts live in the loom→template emission flow is an open architectural
  question for the analysis to resolve.

## Public-surface constraint (operator, this session — CRITICAL)

> "please note that this docker will be in public, so please ensure no
> sensitive and confidential data"

Every Docker artifact (`Dockerfile`, `.devcontainer/devcontainer.json`,
`docker-compose.yml`, supporting scripts, README docs) ships in a **public**
template repository. Therefore:

- **No secrets in any committed file or image layer** — no API keys, tokens,
  passwords, DB credentials, JWT secrets. Keys arrive only at _runtime_ via
  `.env` (gitignored) or the host-mounted CLI config dirs. `.env.example`
  carries placeholders only.
- **No operator/host-specific identifiers** — no `/Users/<name>/...` absolute
  paths, no machine hostnames, no GitHub org slugs beyond the public
  `terrene-foundation` / `esperie` references already in the README, no
  internal infra references. Bind-mount host paths via `${HOME}` / compose
  variable interpolation, never a literal home directory.
- **No client / engagement / workspace identifiers** — same disclosure class as
  the `ci-runners.operator.local.md` gitignored-values split (issue #260/#252)
  and the Gate-1/Gate-2 disclosure-scrub fences. Any deployment-specific value
  belongs in a gitignored `*.local` file with a shipped `.example` schema.
- **Default Postgres credentials must be obviously-throwaway** (e.g.
  `postgres`/`postgres` on a non-exposed internal compose network) AND
  documented as dev-only, never reused for anything real.
- The analysis MUST include a **disclosure-scrub checklist** for the eventual
  artifacts and verify the design surfaces zero sensitive data when public.

## Out of scope (this phase)

- Actually building/publishing images (that is `/implement`).
- Modifying the COC artifact set itself (agents/skills/rules/commands).
- Any work in sibling repos.

## Success criteria

- A downstream user runs one documented command and gets a working shell with
  all three CLIs, Node hooks, Python+Ruby bindings, and a live Postgres.
- Adding a project dependency is a documented one-liner that survives rebuilds.
- The design is multi-arch aware (Apple Silicon arm64 + amd64 CI).
- Credentials never enter an image layer.
- The artifact set is consistent-by-construction with the py template and
  loom-syncable.
