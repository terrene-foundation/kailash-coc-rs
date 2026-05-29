# Kailash COC — Multi-CLI Dev Environment (Rust SDK, binding consumers)

A batteries-included, reproducible **development environment** for building Python or
Ruby applications on the **Kailash Rust SDK** through its bindings — drivable with any of
three AI coding CLIs: **Claude Code**, **OpenAI Codex**, and **Gemini CLI**.

You do **not** write Rust to use this. You write Python (or Ruby) that calls into the
Rust runtime via the binding layer; this image gives you the whole toolchain ready to go.

> Maintained by the **Terrene Foundation**. Source of truth:
> <https://github.com/terrene-foundation/kailash-coc-rs> · Apache-2.0.

---

## Quick start — pull and run

```bash
docker pull terrenefoundation/kailash-coc-rs:latest

# In a checkout of your project (with the template's docker-compose.yml):
docker compose up -d
docker compose exec workspace bash
#   → drive with:  claude   |   codex   |   gemini
```

Prefer to build locally instead of pulling? That path is equally supported — clone the
template and run `./bin/dev` (build-on-first-use). Pulling this image just skips the
first build.

## Tags

- `:latest` — the current published dev image.
- `:<version>` — pinned to the **coc-rs template version** (e.g. `:2.23.1`). Pin this for
  reproducibility.

## Platforms

- `linux/amd64` and `linux/arm64` (Apple Silicon + x86-64) — one multi-arch manifest.

## What's inside

- **Three CLIs on `PATH`:** `claude` (Claude Code), `codex` (OpenAI Codex), `gemini`
  (Gemini CLI), pinned to a major line.
- **Python binding:** `kailash-enterprise` (Rust-backed wheel) — `import kailash` works.
- **Ruby binding:** the `kailash` gem (installed; see Known limitations).
- **Node 20 LTS**, **gnupg + pinentry** (for `git commit -S`), **PostgreSQL client**.
- A bundled **PostgreSQL** service wired to `DATABASE_URL` is provided by the template's
  `docker-compose.yml` (throwaway dev credentials, internal network only).
- One shared environment per language (`/opt/venv`, `/opt/gems`) so adding your own
  dependencies (`requirements-user.txt`, `Gemfile.user`, `package.json`) needs **no
  image rebuild**.

## Credentials & safety

- **No secrets are baked into any image layer.** API keys arrive only at runtime via a
  gitignored `.env` (or by bind-mounting your host CLI logins). `docker history` shows
  nothing sensitive.
- Default Postgres credentials are obviously-throwaway and dev-only.

## Known limitations

- **Python works; Ruby `require "kailash"` does not yet.** The Ruby binding load is
  blocked by an upstream defect (`kailash-rs#1151`) — the gem installs but fails to load.
  This image is labelled `io.kailash.ruby-binding=blocked-upstream-kailash-rs-1151` so you
  can detect it via `docker inspect`. **Once the upstream fix lands it is seamless:** a
  later pinned tag simply works for Ruby with no change on your side — pull the newer
  version. Python (`import kailash`) is unaffected and is the recommended path today.

## Heavy / opt-in layers

The default image is slim (~820 MB). The heavy ML/Align stack and the Rust toolchain are
**not** in it — enable them at build time from the template
(`INCLUDE_ML=true` / `INCLUDE_RUST=true docker compose build`).

---

_Built from the public `Dockerfile` in the template repo; reproducible from source. Issues
and contributions: <https://github.com/terrene-foundation/kailash-coc-rs>._
