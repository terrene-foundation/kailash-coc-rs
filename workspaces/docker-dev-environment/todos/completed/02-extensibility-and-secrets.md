# Milestone 2 — Extensibility + Secrets (Shard 2)

**Value anchor:** `briefs/01-brief.md` Goal #5 ("make it possible for users to install
additional dependencies as their projects require") + § Public-surface-constraint
("no sensitive and confidential data" — operator, this session) + § CLI-auth. This is the
second-highest-value milestone: the brief explicitly calls out user-extensibility, and the
public-surface constraint is a CRITICAL operator directive. The peer-validated shared-env
trap (R16) lives here — get it wrong and the headline "add a dep without rebuild" feature
silently breaks.

## T07 — [build] Two-layer overlay scaffolds (project-owned)

Implements: `specs/extensibility.md` (FR-23).

- [ ] Ship empty + commented: `requirements-user.txt` (pip), `Gemfile.user` (gem — rs delta), `Dockerfile.user` (apt/system), `compose.override.yml.example` (services/mounts/ports).
- [ ] These are project-owned: documented as "the template sync never touches these."

## T08 — [wire] Shared-environment pinning (NFR-12 — peer-validated trap)

Implements: `specs/extensibility.md` § Concrete env-pinning contract.
**RESOLVED 2026-05-28** — see `journal/0009-DECISION-ruby-overlay-bundle-no-bundlepath.md`
for the empirical receipt + chosen mechanism.

- [x] **Python:** ONE interpreter/venv used by BOTH base `pip install kailash-enterprise` AND overlay `requirements-user.txt` (`python -m pip`, never ambient pip); export `VIRTUAL_ENV`/`PATH`.
- [x] **Ruby:** export single `GEM_HOME` + `GEM_PATH` (NOT `BUNDLE_PATH`) used by BOTH base `gem install kailash` AND overlay `bundle install --gemfile=Gemfile.user`. Bundler installed into `/opt/gems` (so `bundle` lands on PATH at `/opt/gems/bin/bundle`). Overlay invocation defensively unsets `BUNDLE_PATH` + `BUNDLE_APP_CONFIG`.
- [x] **MED-1 RESOLVED** — verified live 2026-05-28 in the running container (commit c7e52ee + follow-up shard): apt Ruby (`ruby-full` 3.2.3, NO rvm) resolves to single `Gem.path = ["/opt/gems"]`. Setting `BUNDLE_PATH` forced bundler's isolated nested `/opt/gems/ruby/<ver>/gems/` layout (broke plain-shell `require`); leaving `BUNDLE_PATH` unset yields the flat `/opt/gems/gems/<name>-<ver>/` layout requireable in any shell. Python interpreter identity confirmed at `/opt/venv/bin/python` (via `VIRTUAL_ENV` + PATH); `python -m pip` always targets `/opt/venv`. The rvm/Feature scenario the spec hypothesized does not apply.
- [x] **Tier-2 walk (both languages):** overlay-added `tabulate==0.9.0` (Python) and `paint 2.0.3` (Ruby) installable via `bin/dev setup` and requireable in a fresh plain shell with no `bundle exec` / venv-activate — receipts embedded in commit c7e52ee body + Round-1 .spec-coverage-v2.md Cluster 2.10/2.11 rows.

## T09 — [build] `bin/dev setup` no-rebuild dependency path

Implements: `specs/extensibility.md` (FR-11/12/14).

- [ ] `bin/dev setup` installs pip/gem/npm overlay deps into the shared env against the LIVE workspace (no image rebuild).
- [ ] OS/system deps go via `Dockerfile.user` rebuild (FR-13); NO `sudo` in the running container (ADR-08).
- [ ] Acceptance: each dep kind survives `docker compose build --no-cache`.

## T10 — [wire] Credential model (both auth paths + signing)

Implements: `specs/credentials-secrets.md` (FR-09/10/25), `specs/cli-toolchain.md`.

- [ ] API keys via compose `env_file: .env` (gitignored); `.env.example` placeholders only; never `COPY .env`/`ENV KEY=`.
- [ ] Host CLI config bind-mounted read-write via `${HOME}/.claude|.codex|.gemini` (compose interpolation, never literal home path).
- [ ] Missing key → fail-visible at CLI USE (NFR-08), no silent fallback, no baked default key.
- [ ] GPG signing key mounted **read-only** from host; `GPG_TTY` exported + non-interactive pinentry (FR-25 — multi-operator signing).

## T11 — [build] Public-surface fence + disclosure scrub

Implements: `specs/credentials-secrets.md` (FR-19/21), `specs/provenance-sync.md`.

- [ ] `*.local`/`.env` gitignored + shipped `.example` schema for any deploy-specific value (the `ci-runners.operator.local` pattern).
- [ ] Extend `.gitignore`: `*.local`, `compose.override.yml`, overlay-local patterns.
- [ ] Run the full disclosure-scrub checklist (`specs/credentials-secrets.md`) → 100% green, INCLUDING the host-config bind-mount-source `${HOME}`-interpolated check (MED-4) and `docker history` shows zero secrets.

**Milestone-2 done when:** adding a pip/gem/npm dep via the overlay is importable in the
same shell with no rebuild (both languages); both auth paths work; signing succeeds; the
disclosure-scrub checklist is 100% green. Walk Flows 2/3/4 (T17) before declaring done.
