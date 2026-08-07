# Spec — User Extensibility (Two-Layer Ownership)

## Authority

How downstream users add their own dependencies so they survive rebuilds, without
forking the template base. Implements ADR-08, ADR-12; serves FR-11..14, FR-23, FR-24,
NFR-12. Peer-aligned with the kailash-coc-py two-layer model.

## Two layers

- **BASE (template-owned, refreshed on template pull / loom sync):** runtimes, the 3
  CLIs, hooks/guard, the Kailash bindings, base dependency manifests. The user does
  NOT edit these (a template sync may regenerate the base; `provenance-sync.md`).
- **OVERLAY (project-owned, sync NEVER touches):**
  - `requirements-user.txt` — user pip packages.
  - `Gemfile.user` — user gems (**rs delta vs py**).
  - `package.json` (+ optional `package-lock.json`) — user npm packages (no-rebuild
    path; `bin/dev setup` runs `npm ci` when a lockfile is present, else `npm install`).
  - `Dockerfile.user` — user apt/system packages (rebuild path).
  - `compose.override.yml` — user services / mounts / ports.

## The two add-a-dependency paths

1. **Language package (pip / gem / npm) — NO image rebuild.** User edits the relevant
   overlay file and runs the setup script (`bin/dev setup` or equivalent) against the
   LIVE workspace; it installs into the shared environment. Survives container restart
   because the overlay file is tracked and re-applied on `up`.
2. **OS / system package — rebuild.** User edits `Dockerfile.user` and rebuilds. There
   is **NO `sudo`** in the running container (preserves the non-root model, ADR-08);
   OS packages go through the rebuild path only.

## Shared-environment invariant (NFR-12 — closes the peer red-team trap)

Base AND overlay MUST install into the SAME environment per language:

- **Python:** one interpreter / one site-packages (or one venv) used by both the base
  binding install and `requirements-user.txt`.
- **Ruby:** one `GEM_HOME` / one bundle path used by both the base gem and
  `Gemfile.user`.

If base and overlay install to DIFFERENT locations, "add a package without rebuild"
silently installs where the running shell can't see it — the exact peer-validated
failure. The shared env is the structural fix.

### Concrete env-pinning contract

The image pins both languages so the base install and the overlay land in the same
location and the overlay is requireable in a plain shell with no `bundle exec` /
`Bundler.setup` / virtualenv-activate gymnastics. Both pins are exported as image-
level `ENV` so every shell + `bin/dev setup` inherits them.

- **Python:** `VIRTUAL_ENV=/opt/venv` is exported; `${VIRTUAL_ENV}/bin` is prepended
  to `PATH`. Therefore `which python` → `/opt/venv/bin/python` and `which pip` →
  `/opt/venv/bin/pip`. The base `pip install kailash-enterprise` AND the overlay
  `python -m pip install -r requirements-user.txt` both target `/opt/venv`. The
  setup script ALWAYS invokes `python -m pip` (never an ambient `pip`) so the
  interpreter identity is enforced at the call site.
- **Ruby:** `GEM_HOME=/opt/gems` and `GEM_PATH=/opt/gems` are exported;
  `${GEM_HOME}/bin` is prepended to `PATH`. `Gem.path` resolves to the single entry
  `["/opt/gems"]`. The base `gem install kailash` AND the overlay `bundle install
--gemfile=Gemfile.user` both land at `/opt/gems/gems/<name>-<ver>/` (the flat
  `Gem.path` layout) — requireable in a plain `ruby -e 'require "..."'` shell with
  no `bundle exec`. **`BUNDLE_PATH` is intentionally NOT exported**: setting it
  forces bundler's isolated `<path>/ruby/<ver>/gems/` layout, which is NOT on the
  default `Gem.path` and breaks plain-shell `require` (the NFR-12 peer-validated
  trap). The overlay invocation is `env -u BUNDLE_PATH BUNDLE_GEMFILE=Gemfile.user
bundle install` so a stray `BUNDLE_PATH` in the operator's compose override
  cannot resurrect the trap. `bundler` is installed into `/opt/gems` (so `bundle`
  lands on PATH at `/opt/gems/bin/bundle`; the default-gem bundler under the
  system ruby tree is NOT on PATH because `GEM_HOME` is overridden).

Apt Ruby (`ruby-full`, 3.2.3) is used (not the devcontainer `ruby` Feature / rvm)
so no rvm gemset switching applies; a single `Gem.path` entry is the structural
guarantee. The Flow-2 acceptance — an overlay-added package importable in the same
shell after `bin/dev setup` — is exercised by the walk receipt below.

## Opt-in heavy ML/Align layer (ADR-12 / FR-24)

- Slim base excludes torch-class deps. ML/Align (`torch`, `transformers`, `peft`,
  `trl`, …; multi-GB) install ONLY under the opt-in **`INCLUDE_ML=true` build-arg**
  (`INCLUDE_ML=true docker compose build`). A compose `--profile` is deliberately NOT
  used — compose profiles gate SERVICE startup, not build-time image dependencies, so
  a profile cannot bake pip packages into the workspace image; the build-arg is the
  correct primitive. The gate is **dependency-agnostic** — it works regardless of the
  exact ML package set, which may change (no rs-native ML wheel today).

## Escape hatches (documented, secondary)

- Extend `Dockerfile.user` directly for advanced build steps.
- `compose.override.yml` for services/mounts/ports without touching the base.

## Edge cases

- Overlay references a base package removed by a template update → the setup script
  tolerates missing base deps and surfaces a clear message (ADR-08 / `provenance-sync.md`).
- A language dep needing a system lib → goes in `Dockerfile.user` (rebuild), not the
  no-rebuild path.
