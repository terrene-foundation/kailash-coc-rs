# Spec — Credentials & Secrets (Public-Surface Safe)

## Authority

How keys/logins reach the container without entering any image layer or the public
repo. Implements ADR-07, ADR-11; serves FR-09, FR-10, FR-19, FR-21, FR-25, NFR-05,
NFR-08, NFR-09, NFR-11. **This repo is PUBLIC — these contracts are structural, not
disciplinary.**

## API keys (headless / CI path — FR-09)

- Injected at runtime via compose `env_file: .env`. `.env` is gitignored;
  `.env.example` ships placeholders only.
- NEVER `COPY .env` into a layer; NEVER `ENV API_KEY=...`; NEVER a secret build-arg
  (visible in `docker history`).
- Missing key → the CLI fails at USE with a clear message (NFR-08) — no silent
  fallback, no baked default key.

## Host CLI config (OAuth / subscription path — FR-10)

- Bind-mount host CLI config read-write at runtime: `~/.claude`, `~/.codex`,
  `~/.gemini` → the container's `vscode` user home (`/home/vscode`), via compose **`${HOME}` interpolation**
  — NEVER a literal `/Users/<name>` path.
- Fresh in-container OAuth (browser callback) is NOT supported; re-auth on the host
  and the mount carries the session in. Token refresh writes back to the host dir
  (acceptable — it's the host's dir).

## Commit-signing key (FR-25)

- Host `~/.gnupg` **side-mounted read-only** at `/host-gnupg` (NOT at
  `/home/vscode/.gnupg`); `bin/dev setup` PRUNES the container-side `~/.gnupg`
  (so host-side key revocations propagate) then repopulates it from the side-mount
  via a **denylist** `tar` copy that excludes the host's UNIX agent sockets
  (`S.gpg-agent*`, `S.dirmngr*`, `S.scdaemon*`) and lock files (`.#lk*`), copying
  every other keyring file (keybox, trustdb, revocation certs, tofu db) so the copy
  survives GnuPG version/format drift without code edits. Directory mode is locked to
  0700 before the copy (no permissive-bits window); the prune refuses any `GNUPGHOME`
  outside the container `$HOME` or any mountpoint.
- `GPG_TTY` set + non-interactive pinentry (`cli-toolchain.md`). Key never
  generated/copied into a layer; host keyring stays immutable from the
  container.
- **Why side-mount + selective copy** (not direct `${HOME}/.gnupg:/home/vscode/.gnupg`):
  macOS host gpg-agent and Linux gpg-agent use platform-specific UNIX socket
  files; a direct mount leaks the host's sockets into the Linux agent's
  startup path and signing fails silently with `gpg: can't connect to the
gpg-agent: General error`. Verified live 2026-05-28 — see journal/0012.

## Postgres creds (NFR-09)

- Throwaway `postgres`/`postgres`, internal network only, documented dev-only.

## Deployment-specific values (ADR-11 / FR-19)

- Any host path / hostname / non-public slug / real endpoint → gitignored
  `*.local` / `.env` with a shipped `.example` schema (the `ci-runners.operator.local.md`
  #260 pattern). Add patterns to `.gitignore`.

## `.dockerignore` (mandatory)

Excludes at minimum: `.env`, `**/.env`, host config dirs, `.git`, `node_modules`,
`secrets/`, `*.pem`, `*.key`, `.claude/learning/`. Mirrors `.gitignore` + the config dirs.

## Disclosure-scrub checklist (FR-21 — gate before committing any artifact)

- [ ] No `/Users/<name>` or `/home/<name>` absolute paths (bind-mounts use `${HOME}`).
- [ ] No API keys / tokens / passwords / JWT secrets / DB creds (except the documented
      throwaway `postgres`/`postgres`).
- [ ] No `--build-arg` secret (`docker history` reveals none).
- [ ] No `COPY .env` / `COPY ~/.<cli>` / `ADD` of any config or secret dir.
- [ ] `.dockerignore` present and correct.
- [ ] No machine hostnames / internal infra / client / workspace identifiers.
- [ ] No org slugs beyond public `terrene-foundation` / `esperie`.
- [ ] Every deploy-specific value in a gitignored `*.local` with a shipped `.example`.
- [ ] Host-config bind-mount source is `${HOME}`-interpolated in `docker-compose.yml`
      (never a repo-relative or committed path) — verified, so the read-write mount
      cannot resolve into a committed location.
- [ ] Disclosure scanner over the new artifacts → exit 0.

## Pre-existing adjacent leak (C8 — RESOLVED)

`.claude/settings.json` previously shipped operator-absolute paths + a "(Python)"
mislabel into this public template. **RESOLVED on `main`** via disclosure-scrub PRs
#34 (settings.json operator-paths + (Python)→(Rust)) and #35 (.gitignore
operator-local siblings); a grep of `.claude/settings.json` for `/Users/` /
`/home/<name>` now returns zero hits and line 3 reads "(Rust)". The durable upstream
fix at the loom emitter (so the scrub does not regress on the next `/sync rs`) is
tracked at loom #386–#389 (F5) — out of this repo's scope.
