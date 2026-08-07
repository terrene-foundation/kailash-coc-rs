# Milestone 5 — Multi-registry image publish (dual distribution) — BUILT, pending live-verify

**Value anchor:** verbatim co-owner directive 2026-05-29 (journal/0018) — "coc-py -> docker ->
any docker hub infra … not just 1 [registry]"; brief § Distribution (CORRECTED). Reverses the
old no-registry decision (ADR-09/FR-15).

**Decision envelope (co-owner, journal/0018):** prebuilt image + local-build BOTH first-class ·
**multi-registry** (Docker Hub + GHCR + private/Azure, each opt-in — "not just 1") · publish
ON VERSION TAG · rs-only scope (coc-py is ALREADY DONE — mirror by construction, do NOT read py).

## DONE (commit `5f29f39`)

- [x] **T19** `.github/workflows/docker-publish.yml` — tag-gated (`v*`) + `workflow_dispatch`
      dry-run; multi-arch amd64+arm64 (QEMU); opt-in multi-registry (GHCR default-on; Docker Hub
      via `vars.DOCKERHUB_NAMESPACE`+secrets; private/Azure via `vars.PRIVATE_REGISTRY`+secrets,
      each skipped when unconfigured); layer-secret `docker history` gate before push; OCI labels
      incl. F4 caveat; `contents:read`+`packages:write`; cancel-in-progress:false (audited).
- [x] **T20** README "Pull the prebuilt image" first-class section (build-local kept first-class);
      multi-registry + per-registry secret/var setup + F4 caveat documented.
- [x] **T21 (core)** Spec reversal — ADR-09 (decision + alternatives + consequences) + FR-15 +
      brief § Distribution all flipped to dual model; specs/ scanned 0 residual no-registry.

## REMAINING

- [ ] **T21 (polish, next session)** ci-multiarch.md publish section; ADR-13 full write-up;
      FR-26 row ("prebuilt multi-arch image published on tag"). Additive only — no live
      contradiction outstanding (the load-bearing assertions are already reversed).
- [ ] **Azure note:** Azure (ACR / Azure DevOps) uses the **private-registry path** —
      set `vars.PRIVATE_REGISTRY` = the ACR login server (`<name>.azurecr.io`) + the
      `PRIVATE_REGISTRY_USERNAME`/`PRIVATE_REGISTRY_PASSWORD` secrets. (To push to >1 private
      registry simultaneously, extend `steps.refs` + add a second login block — currently one
      private registry slot.)
- [ ] **T22 [verify] LIVE (needs Docker + co-owner sets registry secrets/vars):**
      (a) `workflow_dispatch` dry-run → buildx builds amd64+arm64, layer-secret gate passes,
      push SKIPPED (receipt); (b) first `v*` tag → image lands at each configured
      `<registry>/kailash-coc-rs:<ver>`+`:latest`; (c) `docker pull` on a clean host runs the
      3 CLIs + Python binding + Postgres (T17 walk against the PULLED image).
- [ ] **Security-review dispositions** (agent in-flight this session) → address any findings.

**M5 done when:** a `docker pull` of the published image runs the dev environment on ≥1 registry,
build-local still works, specs fully match code, F4 caveat labelled+documented. **Blocked-by:**
Docker daemon + co-owner sets registry secrets/vars; loom #387 PR gate (F5) before merging feat.
