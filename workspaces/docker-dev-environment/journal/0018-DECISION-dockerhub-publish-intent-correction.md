# 0018 — DECISION — Distribution intent corrected: Docker Hub publish (dual model)

**Type:** DECISION · **Date:** 2026-05-29 · **Status:** OPEN (implementation deferred to a Docker-available session; record + spec landed now)

## The misalignment (root cause)

The brief recorded — under "Confirmed decisions (operator, this session)", `briefs/01-brief.md:50` —
_"Distribution: Ship the Dockerfile; build-on-first-use … No registry dependency."_ The whole
design was built on it (ADR-09 rejects registry publish; FR-15 codifies no-registry; CI builds
but never pushes). **That line was a prior session's one-line summary with NO verbatim quote
backing it** — the verbatim request (`brief:3`) only said "create a full dev environment in
Docker for the template + all CLIs + extensibility + also coc-py", silent on distribution. So a
load-bearing decision was recorded as operator-confirmed without an actual operator quote
(the artifact-flow Co-Owner-Directed-Origination receipt was missing). The co-owner surfaced
the mismatch this session.

## Verbatim co-owner directive (this session)

> "didn't we confirm that we are of the same understanding for the dockerization: then
> coc-py -> docker -> any docker hub infra? why ship the dockerfile, build on first use no
> registry? wtf?"

Confirmed via structured follow-up (this session), co-owner answers:

1. **Distribution model:** prebuilt image (pull-to-run) **AND** local-build, both first-class.
2. **Registry:** Docker Hub, **public** namespace. ("there shouldnt be confidential data anyway")
3. **Trigger:** publish **on version tag** (release-gated).
4. **Scope:** **rs only** — plan + implement in this repo; coc-py driven separately.

## Decision

Reverse the no-registry decision. Add a release-gated Docker Hub publish path while KEEPING
build-on-first-use first-class. This supersedes the pending-journal deferral
(`journal/.pending/…DECISION.md` "future brief expansion would add a registry push" — that
future is now). Full implementation spec: `todos/active/05-dockerhub-publish.md`.

## Why implementation is deferred (not cycle-time)

(a) Cannot live-verify without a Docker daemon + the Docker Hub secrets the co-owner sets;
(b) the workflow MUST land atomically with the ADR-09/FR-15/spec reversal or it re-creates the
spec-vs-code drift R2 just closed; (c) a public pull ships the F4 Ruby defect baked-in — needs a
documented image label first. The complete drop-in spec (incl. the workflow YAML) is in the todo
so the next (Docker-available) session executes mechanically + verifies on a test tag.

## Institutional lesson

A load-bearing "operator decision" recorded as a summary without a verbatim quote is the
failure mode here — it drove ~a full build around an unverified premise. Per artifact-flow
Co-Owner-Directed Origination: distribution/architecture decisions MUST carry the verbatim
directive + receipt-first journal (this entry is that receipt for the corrected decision).
