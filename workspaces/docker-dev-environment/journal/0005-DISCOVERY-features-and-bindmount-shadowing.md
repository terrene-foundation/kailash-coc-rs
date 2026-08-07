# 0005 — DISCOVERY — Features don't apply to plain compose; bind-mount shadows guard node_modules

**Date:** 2026-05-27 · **Phase:** /implement (M1)

## Two implementation-time findings that revise the analysis

### 1. devcontainer Features ≠ plain `docker compose` (revises ADR-02)

ADR-02 said "glibc base + devcontainer Features (node/python/ruby)". But devcontainer
**Features are a devcontainer-CLI construct** — they are applied only when an editor /
Codespaces / `devcontainer` CLI builds the container. Plain `docker compose build` (FR-17,
an explicit brief requirement) does NOT apply Features. If runtimes came from Features,
plain-compose users would get NO Node/Python/Ruby.

**Resolution:** install Node 20 + Python + Ruby + the 3 CLIs + gnupg DIRECTLY in the
Dockerfile (apt/curl), so BOTH paths (devcontainer AND plain compose) get identical
runtimes from ONE source of truth. `devcontainer.json` points at the compose service and
does NOT rely on Features for core runtimes. `specs/base-image.md` + ADR-02 updated.

### 2. Runtime bind-mount shadows build-time `.codex-mcp-guard/node_modules` (revises T06)

The repo source (including `.codex-mcp-guard/`) is bind-mounted at runtime so host edits
reflect in the container. A bind-mount OVERLAYS the image's contents at that path — so an
`npm ci` run at BUILD time inside `.codex-mcp-guard/` is hidden the moment the host dir is
mounted over it. The guard would silently lack its deps.

**Resolution:** the guard's `npm ci` runs at RUNTIME (via `bin/dev` startup +
devcontainer `postCreateCommand`), after the bind-mount is in place, installing into the
bind-mounted dir on the host. `.codex-mcp-guard/node_modules` is gitignored + dockerignored.
This is the standard devcontainer pattern for bind-mounted Node projects.

### Corollary — shared-env install targets must live OUTSIDE the repo (M2 prep)

For the same reason, the Python venv (`/opt/venv`) and Ruby `GEM_HOME` (`/opt/gems`) are
placed OUTSIDE the bind-mounted repo so the base binding install is NOT shadowed AND the M2
overlay install (T08) targets the same path. The bindings themselves install into these
out-of-repo locations, so they CAN bake at build time (unlike the guard's in-repo node_modules).
