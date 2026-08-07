# Spec — Backing Services

## Authority

Bundled + opt-in services and how the workspace reaches them. Implements ADR-01 (db
service), ADR-07 (creds); serves FR-07, FR-08, FR-18, NFR-09.

## Bundled: PostgreSQL

- A `db` service (e.g. `postgres:16`, pinned by digest) on an internal compose
  network. NOT published to a host port (NFR-09) — reachable only from `workspace`.
- `DATABASE_URL` pre-wired in the `workspace` env to point at the `db` service
  hostname (e.g. `postgresql://postgres:postgres@db:5432/kailash_dev`).
- Default creds are **obviously throwaway** (`postgres`/`postgres`), documented
  dev-only, never reused for anything real.
- `healthcheck: pg_isready`; `workspace` declares `depends_on: { db: { condition:
service_healthy } }` so first-run never connects before the DB is ready.
- Data: a named volume for `/var/lib/postgresql/data` (persist across restarts) +
  a documented reset command (`docker compose down -v`).

## Opt-in services (commented-out)

- Redis and others ship commented-out in `docker-compose.yml` (FR-08); uncomment →
  starts on next `up`. An opt-in service MUST NOT change the default `DATABASE_URL`
  wiring. Adding a service for one's own project is better done in
  `compose.override.yml` (project-owned; `extensibility.md`) so the base stays clean.

## Test-prerequisite contract (FR-18)

- Tier-2/3 tests use the live `db` + the real binding (no FFI mocking). The contract:
  DB healthy + binding importable ⇒ tests can run. Tests connect via `DATABASE_URL`.

## Edge cases

- Port-collision on the host is avoided by not publishing `db` (internal only).
- Multiple projects on one host: compose project name namespaces the network/volumes.
- A user needing host access to Postgres adds a published port in
  `compose.override.yml` (their choice; not the shipped default).
