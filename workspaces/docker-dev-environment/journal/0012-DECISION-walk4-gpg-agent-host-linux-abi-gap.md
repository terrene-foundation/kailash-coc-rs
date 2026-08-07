# 0012 — DECISION: M4 Walk 4 GPG-agent host:Linux ABI gap + fix

**Date:** 2026-05-28
**Phase:** M4 (verification walks)
**Walk:** Walk 4 — `git commit -S` signing inside the container
**Receipt-for:** Same-session fix per `user-flow-validation.md` MUST-3 + `autonomous-execution.md` MUST-4

## What the walk surfaced

`compose.override.yml.example` (M2 closure) documented the GPG mount as:

```yaml
- ${HOME}/.gnupg:/home/vscode/.gnupg:ro
```

The literal walk on a macOS host (Docker Desktop / osxfs) found the design
structurally cannot deliver Flow 4's expected outcome ("signature succeeds"):

| Attempt                              | Result                                                                                                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `:ro` mount at `/home/vscode/.gnupg` | `gpg: can't connect to the gpg-agent: Read-only file system` — Linux gpg-agent needs to create its UNIX socket but the mount is RO. Signing fails.                                                        |
| Same mount without `:ro` (rw)        | `gpg: failed to start gpg-agent '/usr/bin/gpg-agent': General error` — host macOS socket files (`S.gpg-agent`, `.#lk0x...<HOSTNAME>.local.NNNNN`) confuse the Linux agent's startup probe. Signing fails. |

Both modes failed because macOS host gpg-agent and Linux gpg-agent use
platform-specific socket files at the same `~/.gnupg` path. A direct bind
mount leaks the host's sockets into the Linux agent's view; the Linux agent
treats them as malformed local sockets and refuses to start.

## What works (verified live 2026-05-28)

Side-mount + selective keyring copy:

1. Mount host `~/.gnupg` READ-ONLY at `/host-gnupg` (NOT at `~/.gnupg`).
2. `bin/dev setup` populates a fresh container-side `~/.gnupg` (writable,
   mode 0700) by copying only the key material: `private-keys-v1.d/`,
   `pubring.kbx`, `trustdb.gpg`, `gpg.conf`. UNIX socket files (`S.gpg-agent*`)
   and lock files (`.#lk...`) are NOT copied.
3. Linux gpg-agent starts cleanly in the container's writable `~/.gnupg`,
   reads keys from the copied keyring, creates its own sockets there.

Verification at 2026-05-28:

- `gpg --list-secret-keys`: 1 secret key visible to container-side gpg
- `git commit -S`: signing reaches the pinentry passphrase prompt (the
  natural last step the user supplies interactively with
  `GPG_TTY=/dev/console`)

The `:ro` security property is **preserved**: the host's `~/.gnupg`
remains immutable from the container (the side-mount is `:ro`).
Container-side writes go only to the container's own `~/.gnupg`, which is
ephemeral.

## Files changed (commit follows)

- `compose.override.yml.example` — replace direct-mount example with the
  side-mount + selective-copy pattern; explanatory comment names the ABI
  gap so a future operator does not re-introduce the broken pattern.
- `bin/dev` — `INSTALL_OVERLAYS_SH` adds a GPG bootstrap block: when
  `/host-gnupg` exists, copy the key material to `~/.gnupg` with proper
  modes; idempotent.
- `specs/credentials-secrets.md` (workspace-local) — § Commit-signing key
  documents the design and links this journal entry.

## Why not the alternatives

- **Direct mount with rm-sockets-at-startup** (delete `S.gpg-agent*` from
  the bind-mount on container start): mutates the host's `~/.gnupg`,
  violating the design's "host keyring immutable" property.
- **Mount keys-only files individually** (`private-keys-v1.d:...:ro`): valid
  but produces a more complex compose stanza and still requires writable
  socket directory creation; net no simpler than copy-on-bootstrap.
- **gpg-agent socket forwarding from host**: requires platform-specific
  shimming (gpgconf `extra-socket`) on macOS; not portable to CI.
- **Document the gap as known limitation**: violates
  `user-flow-validation.md` MUST-3 ("fix the failure mode the walk surfaces;
  passing test next to broken walk is institutional theatre").

## Trust-Posture impact

- `verify-resource-existence.md` MUST-4 satisfied — this entry is the
  external receipt for the closure claim.
- `autonomous-execution.md` MUST-4 (fix-immediately within shard budget) —
  ~50 LOC across 2 files + 1 spec, fits trivially.
- `agents.md` § Quality Gates — reviewer + security-reviewer dispatch
  follows the commit (same session).

## Follow-ups

- F7 (cross-template mirror): when the loom-side py mirror lands per F5
  (#388), the same gpg-agent ABI gap will exist in `kailash-coc-py`. The
  same side-mount + selective-copy pattern applies; M4 of that workstream
  inherits this finding's resolution by construction.
- F3-A (CI smoke): Walk 7's CI smoke does NOT exercise gpg signing (CI
  runners have no operator gpg keys mounted); the signing path remains
  a developer-machine surface only. No CI change needed.
