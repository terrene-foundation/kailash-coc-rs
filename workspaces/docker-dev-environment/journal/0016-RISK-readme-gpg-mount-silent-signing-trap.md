# 0016 — RISK — README GPG mount instruction re-created the silent-signing trap

**Type:** RISK · **Date:** 2026-05-29 · **Phase:** /redteam Round 2 (implementation) · **Status:** CLOSED (fixed this round)

## What

`README.md` § "Commit signing inside the container" (L177) instructed users to uncomment
`${HOME}/.gnupg:/home/vscode/.gnupg:ro` in `compose.override.yml`. That is the **exact
broken direct-mount** that the M4 Walk-4 work (journal/0012, commit 176bd0b) spent a whole
verification walk eliminating: macOS host gpg-agent and Linux gpg-agent use incompatible
UNIX socket files, so a direct `:/home/vscode/.gnupg` mount leaks host sockets into the
Linux agent's startup path → `gpg: can't connect to the gpg-agent: General error` →
`git commit -S` **fails silently**. The README also contradicted three other artifacts
(`compose.override.yml.example:57`, `bin/dev` comments, `specs/credentials-secrets.md`),
all of which use the `/host-gnupg` side-mount.

## Why it matters

A user following the README would recreate the failure mode the side-mount design exists
to prevent — and signing failures are silent, so a multi-operator team would push unsigned
commits believing they were signed. This is a documentation surface re-introducing a
closed defect: the most dangerous kind, because the code is correct and only the
human-facing instruction is wrong.

## Detection

Two independent /redteam R2 agents converged on it: reviewer (`a531d49593e408264`, H1) and
security-reviewer (`ae9807e541244d6d5`, M3). Convergence across two lanes = high confidence.

## Disposition (fixed)

`README.md` L177 rewritten to the `/host-gnupg:ro` side-mount + `./bin/dev setup` populate
step + the macOS/Linux socket-ABI rationale (matching `compose.override.yml.example`).
Verified: grep `host-gnupg:ro.*side-mount` = 1; no remaining instruction to mount the
direct path.

## Institutional lesson

When a verification walk eliminates a broken pattern, EVERY surface that could instruct a
user to recreate it (README, quickstart, tutorial, comments) must be swept — not just the
code. The README was authored separately from the side-mount fix and drifted. Sibling of
`spec-accuracy.md` (specs must match shipped code) applied to user-facing docs.
