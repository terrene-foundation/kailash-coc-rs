# Specs Index — Dockerized Dev Environment (kailash-coc-rs)

Domain specification for the Dockerized full development environment. Each file is
the authority on its topic: flows, contracts, constraints, edge cases. Requirements
trace from `01-analysis/02-requirements.md`; decisions from `01-analysis/03-adrs/adrs.md`.

| Spec                     | Domain                     | One-line                                                                           |
| ------------------------ | -------------------------- | ---------------------------------------------------------------------------------- |
| `container-topology.md`  | Topology / entry           | `workspace` service + compose network + devcontainer entry + `bin/dev`.            |
| `base-image.md`          | Base OS / build            | glibc devcontainer base, digest-pin, layer order, image-size budget, multi-stage.  |
| `cli-toolchain.md`       | CLIs / Node / hooks / Rust | Node 20, 3 CLIs, 29 hooks, MCP-guard `npm ci`, opt-in Rust, gnupg, version pins.   |
| `bindings-runtime.md`    | Kailash bindings           | `kailash-enterprise` (Py) + `kailash` gem (Ruby); install + Rust-path assertion.   |
| `services.md`            | Backing services           | Bundled Postgres → `DATABASE_URL`; opt-in services; test-prerequisite contract.    |
| `credentials-secrets.md` | Secrets / auth             | `.env` + host-config mounts; no-secrets-in-layers; fail-visible auth; signing key. |
| `extensibility.md`       | User deps                  | Two-layer ownership; shared-env survive-rebuild; overlay files; opt-in ML layer.   |
| `provenance-sync.md`     | loom flow                  | Template-owned vs emitted; sync-preservation; cross-template consistency.          |
| `ci-multiarch.md`        | CI / arch                  | arm64 + amd64 build matrix; how CI exercises the Dockerfile.                       |

**Brief traceability:** every brief requirement maps to ≥1 spec section — see
`02-requirements.md` § Traceability (no gaps; the one package-name contradiction C1 is
resolved to `kailash-enterprise`).
