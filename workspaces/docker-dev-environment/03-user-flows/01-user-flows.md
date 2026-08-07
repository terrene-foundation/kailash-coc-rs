# User Flows — Dockerized Dev Environment (kailash-coc-rs)

Each flow lists the user's literal steps, the expected observable output, and the
failure mode + mitigation. These become the `user-flow-validation.md` walk receipts at
`/implement` (verbatim command + output + disposition, scrubbed for public surface).

## Flow 1 — New developer onboarding (primary, 80%)

1. Clone the template → `cp .env.example .env` → fill at least one API key (or rely on
   a host CLI login already present).
2. `./bin/dev` (or editor "Reopen in Container").
   - **Expected:** image builds once (~≤10 min slim, arm64); `db` comes up healthy;
     shell attaches; banner/hooks fire.
3. In the shell: `claude --version` / `codex --version` / `gemini --version` resolve;
   `python -c "import kailash"` succeeds (Rust-backed); `ruby -e 'require "kailash"'`
   succeeds; `psql "$DATABASE_URL" -c '\l'` connects.
   - **Failure mode:** missing API key → CLI fails at use with a clear message
     (not at build). **Mitigation:** NFR-08 fail-visible; `.env`/host-mount documented.
   - **Failure mode:** pure-Python `kailash` resolved instead of the Rust binding.
     **Mitigation:** smoke test asserts the Rust path (C2 / `bindings-runtime.md`).

## Flow 2 — Add a project dependency (15%)

- **Python/Ruby/npm (no rebuild):** edit `requirements-user.txt` / `Gemfile.user` /
  `package.json` → run `bin/dev setup` → package importable in the SAME shell.
  - **Failure mode (peer-validated):** installed where the shell can't see it.
    **Mitigation:** shared env per language (NFR-12) — base ∪ overlay one Python env /
    one `GEM_HOME`.
- **OS/system (rebuild):** edit `Dockerfile.user` → `docker compose build` →
  `./bin/dev`. No `sudo` inside the container (ADR-08).
- **Acceptance:** the dep survives `docker compose build --no-cache`.

## Flow 3 — Authenticate the CLIs (both paths)

- **Headless/CI:** keys in `.env` → CLIs use them at runtime; nothing in image layers.
- **Existing host login:** `~/.claude` / `~/.codex` / `~/.gemini` bind-mounted via
  `${HOME}` → existing OAuth/subscription session carries in; no in-container login.
  - **Failure mode:** fresh in-container OAuth (browser callback) — NOT supported.
    **Mitigation:** re-auth on host; mount carries it in (`credentials-secrets.md`).

## Flow 4 — Multi-operator commit signing (80%, silent-break risk)

1. Second teammate joins; commits must be signed.
2. `git commit -S` inside the container.
   - **Expected:** signature succeeds (gnupg present; key mounted read-only; `GPG_TTY`
     set; non-interactive pinentry).
   - **Failure mode (peer-validated):** gpg installed but key/TTY missing → silent
     signing failure. **Mitigation:** FR-25 — key mount + `GPG_TTY` + pinentry; `gnupg`
     in the inventory.

## Flow 5 — Opt-in heavy ML/Align (15%)

1. User needs torch-class ML/Align.
2. `INCLUDE_ML=true docker compose build && ./bin/dev` → heavy ML/Align deps bake into
   the image (compose `--profile` is NOT the mechanism — profiles gate service startup,
   not build-time deps; see ADR-12).
   - **Expected:** default first-run stayed slim; ML weight pulled only now, on request.
   - **Failure mode:** ML baked into base → everyone pays multi-GB. **Mitigation:**
     ADR-12 opt-in build-arg, dependency-agnostic gate.

## Flow 6 — loom maintainer syncs the template (5%, high blast radius)

1. `/sync rs` at loom.
   - **Expected:** Docker artifacts unchanged (template-owned preserve-list, ADR-10);
     overlay files untouched.
   - **Failure mode:** artifacts in the regenerated class → wiped. **Mitigation:**
     FR-20 preserve-list; post-sync verification.

## Flow 7 — CI multi-arch build (CI)

1. PR opens → `docker-build.yml` runs `docker buildx` for amd64 + arm64.
   - **Expected:** both build; disclosure grep finds no `/Users/`/hostnames/non-public
     slugs; smoke tests pass in the built image.
   - **Failure mode:** arch-specific assumption in Dockerfile. **Mitigation:** ADR-09
     arch-agnostic Dockerfile.
