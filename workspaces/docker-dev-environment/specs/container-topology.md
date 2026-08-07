# Spec — Container Topology

## Authority

Defines how the dev environment is structured and entered. Implements ADR-01; serves
FR-01, FR-15, FR-16, FR-17, FR-22.

## Components

- **`docker-compose.yml`** (repo root) — defines services:
  - `workspace` — the single dev container (runtimes + 3 CLIs + hooks; see
    `cli-toolchain.md`). Bind-mounts the repo source at a stable in-container path;
    runs as a non-root user (`credentials-secrets.md`, `base-image.md`).
    **Deviation (2026-05-27, /implement):** the user is the devcontainers base image's
    pre-existing `vscode` user (uid/gid 1000), NOT a newly-created `dev` user — reusing the
    base user avoids uid-collision and `updateRemoteUserUID` complexity. The home is
    `/home/vscode`; M2's host-config mounts target there.
  - `db` — PostgreSQL (`services.md`).
- **`.devcontainer/devcontainer.json`** — references the SAME compose file +
  `service: workspace` (`dockerComposeFile`, `service`, `workspaceFolder`). It MUST
  NOT redefine the image — it delegates to compose, so editor and terminal paths
  resolve one definition (no drift).
- **`bin/dev`** — the single documented entry. Resolves to: ensure `.env` exists
  (copy from `.env.example` with a warning if missing), `docker compose up -d`, wait
  for `db` healthy, then `docker compose exec workspace bash` (or the user's shell).

## Entry flows (all yield the SAME `workspace` container)

1. **Editor:** "Reopen in Container" / Codespaces → reads `devcontainer.json` →
   compose `up` → attaches to `workspace`.
2. **Terminal (wrapper):** `./bin/dev` → the steps above.
3. **Terminal (raw):** `docker compose up -d && docker compose exec workspace bash`.

## Contracts

- One service definition is the single source of truth; `devcontainer.json` never
  duplicates image/build config.
- `workspaceFolder` and the compose bind-mount target MUST match so the editor and
  terminal see identical paths.
- First `up` builds (no cache); subsequent `up` uses layer cache (`base-image.md`).

## Edge cases

- Missing `.env` → `bin/dev` copies `.env.example` → `.env` and warns; never fails
  the build for a missing key (fail-visible at CLI use, `credentials-secrets.md`).
- Editor not installed → raw/`bin/dev` terminal path is fully equivalent (FR-17).
- `docker compose` v2 syntax assumed; document the minimum Compose version.
