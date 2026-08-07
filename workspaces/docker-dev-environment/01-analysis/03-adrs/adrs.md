# Architecture Decision Records — Dockerized Dev Environment (kailash-coc-rs)

Each ADR: context · decision · consequences · alternatives · plain-language recommendation.
Corrections from live research (C1–C8) are folded in.

---

## ADR-01 — Devcontainer + docker-compose topology · Accepted

**Context.** One command must yield a working env (3 CLIs, Node hooks, two
bindings, live DB), drivable from an editor or a plain terminal.

**Decision.** One `workspace` service (defined in `docker-compose.yml`) holds the
runtimes + CLIs. `.devcontainer/devcontainer.json` references that SAME compose
service (`dockerComposeFile` + `service`), so editor and terminal resolve one
definition — no drift. A `./bin/dev` wrapper (FR-22) is the single documented entry.

**Consequences.** + Identical env for editor + terminal users; Postgres-alongside
for free; Codespaces works. − Two coherent entry files (mitigated: devcontainer
delegates to compose). − Small conceptual overhead vs a bare `docker run`.

**Alternatives.** Single Dockerfile no-compose (loses bundled-Postgres wiring —
rejected); devcontainer with its own inline build (loses the plain-terminal path —
rejected).

**Recommendation.** Keep it. We describe the dev box and database once in compose;
the editor just points at that same description, so the two can't drift. Trade-off:
two small files instead of one. Right call, matches the brief.

---

## ADR-02 — Base OS image: glibc (devcontainers/base Ubuntu) + explicit Dockerfile installs, not Alpine · Accepted (Features revised at /implement)

**Context.** Must run prebuilt manylinux Python wheels (`kailash-enterprise`) and
precompiled Ruby `*-linux` gems on arm64 + amd64.

**Decision.** glibc base — `mcr.microsoft.com/devcontainers/base:ubuntu-24.04`
pinned by digest (NFR-07). Runtimes (Node via the NodeSource apt repo, Python + Ruby
via apt) are installed EXPLICITLY in the Dockerfile, NOT via devcontainer Features;
the opt-in Rust toolchain (ADR-03) is gated by the `INCLUDE_RUST` build-arg. NOT
Alpine/musl. **Revised at /implement:** devcontainer Features do not apply to a plain
`docker compose build` (a required entry path, FR-17), so explicit Dockerfile installs
are the only mechanism that makes the editor and plain-compose paths identical.

**Consequences.** + Prebuilt wheels/gems install without recompiling; apt + NodeSource
installs are arm64-capable; the base is the standard devcontainer base (good
Codespaces support). − Larger than Alpine (feeds NFR-03). − Explicit installs are
slightly more Dockerfile plumbing than Features (mitigated: NodeSource major +
apt/CLI versions are pinned, NFR-07).

**Alternatives.** Alpine/musl (manylinux + `*-linux` gems reject musl → recompile
hell or broken loads — rejected); raw `rust`/`python`/`ruby` base images stacked
by hand (more Dockerfile plumbing than Features — viable fallback, documented).

**Recommendation.** Use the Ubuntu glibc devcontainer base and install the language runtimes explicitly in the Dockerfile. The
ready-made Python/Ruby packages that wrap the Rust engine are built for the "glibc"
flavor of Linux; Alpine's "musl" flavor would force everything to recompile and
often fail. Cost: a somewhat bigger image. Benefit: installs just work. Recommended.

---

## ADR-03 — Rust toolchain is OPT-IN, not in the slim base · Accepted (revised by C4)

**Context.** Downstream users write Python/Ruby, not Rust. Research (C4) confirms
**both bindings ship prebuilt for arm64 + amd64** — so consuming them needs no
compiler. A toolchain is only needed to build a binding from source or to develop
against the SDK source.

**Decision.** The slim default image does NOT include the Rust toolchain. It is an
**opt-in layer** (devcontainer Rust Feature gated by a build-arg / compose profile),
enabled only by users who build from source or hack on the SDK.

**Consequences.** + Smaller, faster slim first-run (NFR-01/03); honors the
binding-consumer constraint. − A user on an unsupported arch (neither prebuilt
artifact matches) must enable the opt-in layer to source-build — documented as the
fallback. − Two image shapes (slim / +rust) to document.

**Alternatives.** Always ship full toolchain (the risk-analyst's initial insurance
stance — but C4 shows it's unnecessary for the common path and ~1.5 GB of bloat;
rejected as default, kept as opt-in); never provide it (an unsupported-arch user is
stuck — rejected).

**Recommendation.** Leave the Rust compiler out of the default box; offer it as a
one-flag add-on. Normally the Python/Ruby binding installs as a ready-made package
and the compiler is never touched, so most people get a leaner, faster setup.
Anyone who needs to build from source flips one switch. Recommended (revised from
"always include" once research proved prebuilt artifacts cover both chips).

---

## ADR-04 — Binding install: `kailash-enterprise` (Python) + `kailash` gem (Ruby), prebuilt · Accepted (C1/C2/C3 RESOLVED)

**Context.** Must make `import kailash` (Python) and `require "kailash"` (Ruby)
work. Research resolved the package-name contradiction.

**Decision.** Python: `pip install kailash-enterprise` (the Rust-powered wheel;
`kailash-rs` is 404). Ruby: `gem install kailash` (Rust-powered precompiled gem).
Both via prebuilt multi-arch artifacts; source-build only under the opt-in Rust
layer (ADR-03). A **smoke test asserts the Rust-backed path** (C2 trap: plain
`kailash` on PyPI is pure-Python).

**Consequences.** + Fast install on the common path; correct binding guaranteed by
the assertion. − README's stale `pip install kailash-rs` must be fixed (doc
follow-up, out of scope here). − Per-arch wheel availability is upstream-controlled;
a gap triggers the opt-in source path.

**Alternatives.** Hardcode `kailash-rs` (404 — rejected); hardcode the pure-Python
`kailash` (wrong package, no Rust runtime — rejected); source-build only (slow
default — rejected).

**Recommendation.** Install `kailash-enterprise` for Python and the `kailash` gem
for Ruby, and add a tiny check that confirms we got the Rust-powered version and not
the look-alike pure-Python package. The project's README still says the old name
`kailash-rs`, which doesn't exist on PyPI — that string should be corrected
separately. Recommended; the research settled the name against the live registry.

---

## ADR-05 — CLI install + version pinning (3 npm CLIs) · Accepted

**Context.** Claude Code (`@anthropic-ai/claude-code`), Codex (`@openai/codex`),
Gemini (`@google/gemini-cli`) are external npm packages released frequently.

**Decision.** Install all three at build time, each pinned to a MAJOR line in one
tracked manifest (not floating `latest`, not exact patch-pin). Moving forward = bump

- rebuild.

**Consequences.** + Reproducible builds; a breaking major can't land silently;
single bump point. − Not instantly-newest (rebuild to update); minor/patch drift
allowed (intentional — fixes yes, breaks no).

**Alternatives.** Floating `latest` (a breaking release breaks every fresh build —
rejected); exact patch-pin (stale + chore treadmill — rejected).

**Recommendation.** Pin each CLI to its major version line in one file. "Newest"
risks a surprise breaking change on someone's next rebuild; an exact pin strands you
on old versions. The major-line middle path gets bug fixes automatically while
shielding from breaking changes; a one-line edit moves a major version. Recommended.

---

## ADR-06 — Node runtime: pin Node 20 LTS · Accepted (revised by C5)

**Context.** 29 Node hooks + the MCP guard need Node ≥18; research (C5) found the
**Gemini CLI requires Node ≥20 at RUNTIME**. So ≥18 is insufficient.

**Decision.** Install Node 20 LTS (satisfies Gemini ≥20, guard ≥18, Codex ≥16). Run
`npm ci` in `.codex-mcp-guard/` at build so the guard's deps are baked.

**Consequences.** + One Node satisfies all consumers with headroom; guard starts
instantly. − Adds Node + `node_modules` to image (NFR-03). − A future ≥22-only dep
would need an LTS bump (rare).

**Alternatives.** Node 18 (fails Gemini's runtime ≥20 — rejected); install guard
deps at runtime (first Codex/Gemini session pays/risks an `npm install` — rejected).

**Recommendation.** Install Node 20 (long-term-support) and pre-install the guard's
packages during build. The Gemini CLI needs at least Node 20 to _run_, not just to
install, so 18 isn't enough; 20 covers all three CLIs with room to spare.
Pre-installing the guard means Codex/Gemini work the instant the container starts.
Recommended.

---

## ADR-07 — Credential model: `.env` + bind-mounted host CLI config; secrets out of layers · Accepted

**Context.** Public repo. Keys must reach the container only at runtime. Both auth
paths confirmed (API keys + existing host logins).

**Decision.** API keys via compose `env_file: .env` (gitignored; `.env.example`
placeholders only); never `COPY .env`, never `ENV KEY=`. Host CLI config bind-mounted
read-write at runtime via `${HOME}/.claude` etc. (compose interpolation, never a
literal home path). Postgres creds throwaway, internal net only (NFR-09). Signing key
mounted READ-ONLY (FR-25).

**Consequences.** + No secret can enter a layer or git history (NFR-05) —
structural, not disciplinary; existing host logins carry in for free. − Bind-mount
couples to host layout (mitigated by `${HOME}`); two auth paths to document (brief
wants both).

**Alternatives.** `.env` only (loses OAuth carry-in — rejected); bake a default dev
key (public-layer leak — rejected); BuildKit secret mounts (these are runtime, not
build, secrets — noted for future build-time needs).

**Recommendation.** Keep both paths: read keys from a private `.env` at run time, and
let people reuse existing CLI logins by mounting their home-folder config. Nothing
secret is ever written into the shipped image or public repo — keys appear only when
the container runs, from a never-committed file. Cost: a little extra docs for two
paths, which the brief asked for. Recommended.

---

## ADR-08 — User extensibility: two-layer ownership, one shared env, one primary path · Accepted (peer-aligned)

**Context.** Users must add pip/gem/apt/npm deps that SURVIVE A REBUILD (Goal #5).
Installing inside a running container is the trap (lost on rebuild). Peer py red-team
found the headline feature can silently fail if base + overlay install to DIFFERENT
locations.

**Decision.** **Two layers.** BASE (template-owned, refreshed on template pull):
runtimes + CLIs + Kailash bindings. OVERLAY (project-owned, sync never touches):
`requirements-user.txt` (pip), **`Gemfile.user` (gem — rs delta)**, `Dockerfile.user`
(apt/system), `compose.override.yml` (services/mounts). Adding a language package
re-runs a setup script against the live workspace — NO image rebuild; OS packages go
through a `Dockerfile.user` rebuild. **One shared environment per language** (single
Python env AND single Ruby `GEM_HOME` shared by base + overlay — NFR-12). **No `sudo`**
in the running container (OS packages via rebuild, preserving non-root).

**Consequences.** + Deps survive because they're in tracked overlay files; the 80%
base stays unforked; shared-env makes no-rebuild actually work. − Users learn "edit
the list / rerun setup," not "exec in and install." − Four overlay files (mitigated:
each is an ecosystem-standard manifest). − rs carries two of everything (Python +
Ruby) — more surface than py.

**Alternatives.** "exec in and install" (lost on rebuild — the exact failure;
rejected); bespoke parsed config (non-standard format — rejected); volume-mount a
persistent site-packages (not reproducible on fresh clone — rejected).

**Recommendation.** Give one main way to add dependencies: write them into a standard
project list file and re-run a small setup step (or rebuild for OS packages).
Installing on the fly inside the running box vanishes on the next rebuild — the
classic trap; writing it into a project file means it's always there and teammates
get it too. Critically, base and your additions share ONE environment per language,
so "add a package without rebuilding" actually works instead of silently installing
where the shell can't see it. Recommended.

---

## ADR-09 — Multi-arch: one arch-agnostic Dockerfile, native build per machine · Accepted

**Context.** Devs run arm64 (Apple Silicon); CI runs amd64. One Dockerfile must build
on both.

**Decision.** Arch-agnostic Dockerfile (no hardcoded `--platform`, no arch-specific
URLs); rustup/apt/npm/Features resolve per-arch. Each dev builds natively for their
chip. **CI builds `linux/amd64` natively on the amd64-only runner fleet
(`ubuntu-latest`) — that is the blocking "build IS the test" leg. arm64 is validated
NATIVELY by Apple Silicon developers in their inner loop, NOT QEMU-built on every PR**
(building arm64 on an amd64 runner = QEMU, which contradicts the "no QEMU" benefit; an
optional emulated arm64 leg may be added as non-blocking only if a runner is
provisioned — see `ci-multiarch.md`). **Prebuilt multi-arch images ARE published to
configured registries on version tag** (dual distribution — reverses the original
no-registry stance per journal/0018; see `.github/workflows/docker-publish.yml` +
todos M5). Build-on-first-use stays first-class alongside pull-to-run.

**Consequences.** + Native arm64 build for Mac devs (no QEMU); amd64 CI validates the
same file (NFR-04); publishing adds a registry surface, secured via per-registry
tokens + opt-in-by-config (ADOPTED 2026-05-29, journal/0018). − A per-arch wheel/gem gap shows
differently per arch (mitigated by the opt-in Rust source path); each dev pays first
build per arch (NFR-01).

**Alternatives.** amd64-only + QEMU on Mac (slow/flaky emulated native builds —
rejected); publish prebuilt multi-arch images — **ADOPTED 2026-05-29** (dual model,
multi-registry [Docker Hub + GHCR + private, each opt-in], tag-gated; journal/0018).

**Recommendation.** Write the Dockerfile so it doesn't care which chip it's on, and
let each machine build for its own chip. Macs and CI use different chip
architectures; a good Dockerfile builds on both without special-casing. Devs build
natively (fast); CI checks the other chip. We deliberately don't pre-publish images,
matching your "ship the Dockerfile, build on first use" decision — cost is a one-time
build per machine, benefit is no download infra to maintain or secure. Recommended.

---

## ADR-10 — Provenance: Docker artifacts are template-owned + sync-preserved · Proposed (loom-owner confirms)

**Context.** Artifacts ship in a loom-produced template. `/sync` must not clobber
them (FR-20) AND they must stay consistent across all `kailash-coc-*` (NFR-10).
CLAUDE.md class: `CLAUDE.md`/`README.md`/`.gitignore`/`.env.example` = template-owned
(preserved); `AGENTS.md`/`.codex/`/`.gemini/` = emitted (regenerated).

**Decision (recommended).** Treat the Docker artifacts as **template-owned root
files** in the preserved class (like `CLAUDE.md`). Author the 80% agnostic base
identically-by-construction across templates, with the rs-only delta (Ruby binding +
Rust opt-in) isolated to marked sections so the py template is the same file minus
those sections. Consistency is a documented CONTRACT (this analysis), not a code
dependency — we do NOT read the py repo (repo-scope-discipline).

**Consequences.** + `/sync` preserves them; the 80/15/5 split makes "what's identical"
auditable. − Template-owned means loom does NOT auto-distribute Docker fixes — each
template is updated separately (the trade for not being clobbered; mitigated by the
documented agnostic-base contract). − If central distribution is later wanted, the
artifacts move to an emitted class with a variant overlay for the rs delta (larger
change, flagged).

**Alternatives.** Place under `.claude/` (emitted, gets central distribution + variant
overlays — but `.claude/` is regenerated AND `docker-compose.yml` must be at repo root
for `docker compose` to find it — rejected for root files; the variant-overlay path
is the future option if central distribution becomes a requirement); untracked
(not shipped — defeats the purpose; rejected).

**Open question (loom owner / user).** Confirm template-owned (this recommendation) vs
emitted+variant-overlaid (central distribution).

**Recommendation.** Put the Docker files in the same "template owns these, sync leaves
them alone" bucket as the README and CLAUDE.md, and write the shared 80% identically
across templates with only the Rust/Ruby bits marked off. Loom's sync rebuilds some
files and would erase hand-written Docker files if they were in the rebuilt bucket —
so keep them in the don't-touch bucket. Cost: improvements are applied per template
instead of synced once; benefit: sync never wipes them, and because the shared part
is written identically by design, each application is mechanical. Recommend confirming
this classification with whoever owns loom (it's their architecture call); central
auto-distribution is the documented alternative if you want it later.

---

## ADR-11 — Public-surface disclosure: gitignored `*.local` + shipped `.example` · Accepted

**Context.** Public repo. Any deployment-specific value (host paths, hostnames,
non-public slugs, real endpoints) must not be committed. Precedent already in repo:
`ci-runners.operator.local.md` (gitignored) + `.example` schema (#260/#252).

**Decision.** Same split for any Docker deploy-specific value: shipped `*.example`
(placeholders + schema), gitignored real `*.local`/`.env`. Add patterns to
`.gitignore`. A disclosure-scrub checklist (FR-21) runs before any artifact is
committed. The pre-existing `settings.json` leak (C8) is surfaced for an upstream fix.

**Consequences.** + Public artifacts carry zero operator/host/client identifiers
(NFR-11), structurally. − Operators copy `.example` → real file (one step). − New
deploy-specific values must remember the split (mitigated by the scrub checklist
catching literal `/Users/`, hostnames, slugs).

**Alternatives.** Commit "just dev defaults" (a throwaway today is a leaked
path/hostname tomorrow; public forever — rejected); one big committed config (mixes
shippable placeholders with operator values, guaranteeing leakage — rejected).

**Recommendation.** For anything specific to one machine or deployment, ship a
fill-in-the-blanks `.example` file and keep the filled-in copy out of git — exactly
the pattern this repo already uses for its CI-runner settings. Because the whole setup
is public, we never commit a real path, hostname, or password; a short checklist
confirms nothing slipped in before commit. Recommended; it reuses a pattern the repo
already trusts.

---

## ADR-12 — Opt-in heavy ML/Align layer · Accepted (operator directive, C7-grounded)

**Context.** Operator directive: keep torch-class ML/Align frameworks (multi-GB) out
of the base so first-run stays fast. Research (C7) confirms `kailash-ml` pulls
`torch>=2.2`+lightning+sklearn and `kailash-align` pulls torch+transformers+peft+trl
(commonly 2–6 GB+). These are pure-Python kailash-py-family packages (no rs-flavored
ML wheel on PyPI today — UNCONFIRMED if one ships).

**Decision.** Slim base = binding-consumer runtimes + 3 CLIs (fast first-run). Heavy
ML/Align deps install ONLY under the opt-in **`INCLUDE_ML=true` build-arg**
(`docker compose build`; the Dockerfile gates the install) — **dependency-agnostic**
(gated by the flag regardless of exact package weights, so it survives the
package-name/weight landscape changing). A compose `--profile` is deliberately NOT
used: compose profiles gate SERVICE startup, not build-time image dependencies — a
profile cannot install pip packages into the workspace image, so the build-arg is the
correct primitive.

**Consequences.** + Default first-run stays lean (NFR-01/03); ML users opt in
explicitly. − Two image shapes to document; ML users pay the multi-GB cost when they
enable it (expected). − If an rs-native ML wheel ships later, the profile install list
updates (the gate mechanism doesn't change).

**Alternatives.** Bake ML into the base (everyone pays multi-GB first-run — rejected);
no ML support (a real use case is unserved — rejected); a fully separate ML image
(more divergence than a profile — rejected in favor of one base + a profile).

**Recommendation.** Keep the heavy machine-learning packages out of the default box
and put them behind a single opt-in switch. Those packages (PyTorch and friends) are
multiple gigabytes; baking them in would make everyone's first launch slow even if
they never touch ML. With the switch, only people doing ML/fine-tuning pull that
weight, and only when they ask. Recommended; the switch is wired so it keeps working
regardless of exactly which ML packages exist later.
