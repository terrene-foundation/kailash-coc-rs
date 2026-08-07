# External Toolchain Research — Docker Dev Environment

**Phase:** `/analyze` · external-research agent
**Date:** 2026-05-27
**Method:** Live registry/API queries + official docs (verify-resource-existence discipline — runtime evidence only, no INTENT-as-proof). Every row carries a reproducible command or URL.

> **LEAD VERDICT (item 2 — binding existence):** The brief's literal premise **`pip install kailash-rs` does NOT hold — `kailash-rs` is ABSENT from PyPI (HTTP 404).** The Rust-powered Python binding ships as **`kailash-enterprise`** (v4.2.2, proper manylinux_2_28 aarch64+x86_64 wheels) — which is exactly what the repo's own `CLAUDE.md` already states (`pip install kailash-enterprise`). The Ruby side `gem install kailash` (v4.2.0) **DOES hold** and ships precompiled `x86_64-linux` + `aarch64-linux` platform gems. **Design correction required:** s/`pip install kailash-rs`/`pip install kailash-enterprise`/. No build-from-source path is needed — prebuilt multi-arch artifacts exist for both bindings.

---

## Findings table

| #   | Item                                                          | Verdict                               | Evidence                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1a  | Claude Code install (npm + native + apt/dnf/apk + brew)       | CONFIRMED                             | npm `@anthropic-ai/claude-code` 2.1.152, `engines.node>=18`, bin `claude`; native installer `curl -fsSL https://claude.ai/install.sh \| bash`. https://code.claude.com/docs/en/setup                                                                  |
| 1a  | Claude Code headless / env-var auth                           | CONFIRMED (env-var, via API provider) | Native binary (no Node at runtime). Auth via `ANTHROPIC_API_KEY` or Bedrock/Vertex/Foundry; interactive browser login is default but env-var path documented. https://code.claude.com/docs/en/setup, https://code.claude.com/docs/en/authentication   |
| 1b  | OpenAI Codex CLI install + runtime                            | CONFIRMED                             | npm `@openai/codex` 0.134.0, `engines.node>=16`, bin `codex`; ships per-platform Rust binaries via optionalDependencies (`@openai/codex-linux-x64`, `-linux-arm64`). Also `brew install --cask codex` / shell script. https://github.com/openai/codex |
| 1b  | Codex headless / env-var auth                                 | CONFIRMED                             | `OPENAI_API_KEY` env var; `codex exec` non-interactive mode; `printenv OPENAI_API_KEY \| codex login --with-api-key`; device-auth for headless. https://developers.openai.com/codex/noninteractive, https://developers.openai.com/codex/auth          |
| 1c  | Gemini CLI install + runtime                                  | CONFIRMED                             | npm `@google/gemini-cli` 0.43.0, `engines.node>=20`, bin `gemini`. Node-based (not a prebuilt binary). https://google-gemini.github.io/gemini-cli/                                                                                                    |
| 1c  | Gemini headless / env-var auth                                | CONFIRMED                             | `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) env var; headless mode skips OAuth, errors if no env credential present. https://google-gemini.github.io/gemini-cli/docs/cli/headless.html                                                                     |
| 2   | **`kailash-rs` on PyPI**                                      | **ABSENT**                            | `curl https://pypi.org/pypi/kailash-rs/json` → **HTTP 404**; `https://pypi.org/simple/kailash-rs/` → 404                                                                                                                                              |
| 2   | `kailash` on PyPI                                             | CONFIRMED (but **NOT the Rust SDK**)  | v2.26.2, `kailash-2.26.2-py3-none-any.whl` — **pure Python**, the kailash-py SDK. `requires_python>=3.11`. https://pypi.org/pypi/kailash/json                                                                                                         |
| 2   | **`kailash-enterprise` on PyPI (the Rust binding)**           | **CONFIRMED**                         | v4.2.2 "Rust-powered… drop-in replacement for kailash"; wheels: `manylinux_2_28_aarch64`, `manylinux_2_28_x86_64`, `macosx_11_0_arm64`, `win_amd64` for cp310–cp314. `requires_python>=3.10`. https://pypi.org/pypi/kailash-enterprise/json           |
| 2   | `kailash-dataflow` / `-nexus` / `-kaizen` on PyPI             | CONFIRMED (pure-Python, NOT Rust)     | All `py3-none-any.whl` (dataflow 2.10.0, nexus 2.6.3, kaizen 2.24.1) — these are the kailash-py framework packages, not Rust bindings                                                                                                                 |
| 2   | `kailash-pact` / `-ml` / `-align` on PyPI                     | CONFIRMED present                     | HTTP 200 (pure-Python kailash-py family); not Rust bindings                                                                                                                                                                                           |
| 2   | **`kailash` gem on RubyGems (Rust binding)**                  | **CONFIRMED**                         | v4.2.0 "High-performance workflow automation SDK powered by Rust"; precompiled platform gems: **`x86_64-linux`, `aarch64-linux`, `arm64-darwin`** (87 versions). https://rubygems.org/api/v1/gems/kailash.json                                        |
| 2   | `kailash-dataflow/-nexus/-kaizen/-pact/-enterprise` gems      | **ABSENT**                            | All → **HTTP 404** on RubyGems. The single `kailash` gem bundles everything (matches CLAUDE.md "one wheel/gem" model)                                                                                                                                 |
| 3   | devcontainer Features for rust/ruby/python/node               | CONFIRMED                             | `ghcr.io/devcontainers/features/{rust:1, ruby:1, python:1, node:2}` all exist. rust feature lists `aarch64-unknown-linux-gnu` target. https://containers.dev/features                                                                                 |
| 3   | `mcr.microsoft.com/devcontainers/base` multi-arch             | CONFIRMED                             | x86-64 + aarch64/arm64 for ubuntu22.04/24.04/26.04 variants. https://github.com/devcontainers/images/tree/main/src/base-ubuntu                                                                                                                        |
| 4   | PyO3 manylinux wheel installs without Rust toolchain          | CONFIRMED                             | manylinux wheels are prebuilt compiled artifacts; `pip install` of a matching-tag wheel needs no Rust. Toolchain only needed for sdist fallback. https://pyo3.rs/v0.28.0/building-and-distribution.html                                               |
| 4   | Magnus gem — precompiled platform gems are the norm           | CONFIRMED                             | rb-sys + cross-gem-action produce precompiled platform gems; Bundler uses them over source when platform matches → no compiler at install. `kailash` gem already ships them (item 2). https://oxidize-rb.github.io/rb-sys/                            |
| 5   | Official `python`/`ruby`/`rust`/`node` base images multi-arch | CONFIRMED                             | All publish `linux/amd64` + `linux/arm64/v8` manifests (Docker Hub `v2/repositories/library/<img>/tags/latest`)                                                                                                                                       |

---

## Item 1 — The three CLIs (Dockerfile-ready install)

All three confirmed against the live npm registry (`registry.npmjs.org`) and official docs. All three support **non-interactive headless auth via an API-key env var**, which is what a CI/dev container needs.

### Claude Code (Anthropic)

- **npm:** `npm install -g @anthropic-ai/claude-code` — latest **2.1.152**, `engines.node >=18`, bin `claude`.
  - **Note:** the npm package pulls a **native binary** via a per-platform optional dependency (`@anthropic-ai/claude-code-linux-x64` / `-linux-arm64` / `-linux-x64-musl` / `-linux-arm64-musl`) and links it in a postinstall step. **The installed `claude` does NOT invoke Node at runtime** — Node is only needed for the `npm -g` install path itself.
- **Native installer (recommended, no Node at all):** `curl -fsSL https://claude.ai/install.sh | bash` — installs to `~/.local/bin/claude`, auto-updates in background (disable in CI with `DISABLE_AUTOUPDATER=1`).
- **apt/dnf/apk:** signed repos at `downloads.claude.ai` (`apt install claude-code`, etc.) — best for reproducible pinned container builds (no background auto-update).
- **Alpine/musl caveat:** native installer needs `apk add libgcc libstdc++ ripgrep` + `USE_BUILTIN_RIPGREP=0`.
- **Headless auth:** `ANTHROPIC_API_KEY` env var, or Bedrock/Vertex/Foundry. Requires a Pro/Max/Team/Enterprise/Console account (free Claude.ai plan excluded).
- **Dockerfile snippet (glibc base, no Node runtime):**
  ```dockerfile
  RUN curl -fsSL https://claude.ai/install.sh | bash
  ENV PATH="/root/.local/bin:${PATH}"   # or the dev-user home
  # In CI: ENV DISABLE_AUTOUPDATER=1
  ```

### OpenAI Codex CLI

- **npm:** `npm install -g @openai/codex` — latest **0.134.0**, `engines.node >=16`, bin `codex`.
  - **Distribution:** Rust binary delivered via optionalDependencies — `@openai/codex-linux-x64` **and** `@openai/codex-linux-arm64` both published (multi-arch ✓). Codebase is ~96% Rust.
- **Alternative installers:** `brew install --cask codex`; shell `curl -fsSL https://chatgpt.com/codex/install.sh | sh`; direct GitHub release binaries (Linux x86_64 + arm64).
- **Headless auth:** `OPENAI_API_KEY` env var (or `CODEX_API_KEY` secret). Non-interactive: `codex exec`. Pipe-in: `printenv OPENAI_API_KEY | codex login --with-api-key`. Device-auth (`codex login --device-auth`) for headless remote.
- **Dockerfile snippet:**
  ```dockerfile
  RUN npm install -g @openai/codex   # needs Node>=16 present for install
  # runtime auth: ENV OPENAI_API_KEY=...  then `codex exec`
  ```

### Gemini CLI (Google)

- **npm:** `npm install -g @google/gemini-cli` — latest **0.43.0**, `engines.node >=20` (highest Node floor of the three), bin `gemini`.
  - **Distribution:** **Node application** (not a prebuilt native binary). optionalDependencies are `node-pty`/`@lydell/node-pty-*` per-platform (PTY support, incl. linux-x64; note: no explicit linux-arm64 node-pty optional listed — PTY is optional, core CLI runs without it). **Node IS required at runtime.**
- **Headless auth:** `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) env var; headless mode skips browser OAuth and **errors if no env credential is present** — so the container MUST inject the key. `--non-interactive` flag prevents prompts blocking CI.
- **Dockerfile snippet:**
  ```dockerfile
  RUN npm install -g @google/gemini-cli   # needs Node>=20 at install AND runtime
  # runtime: ENV GEMINI_API_KEY=...
  ```

**Cross-CLI Node implication:** Gemini forces **Node >=20** at runtime; Codex needs Node only to install (>=16); Claude Code's native install needs no Node. Therefore the container's Node floor is **20** (driven by Gemini), and Node must remain present at runtime for Gemini.

---

## Item 2 — BLOCKING existence check (binding packages)

This is the design-critical finding. The brief asserts `pip install kailash-rs` and `gem install kailash`. Per verify-resource-existence discipline, the README is INTENT — the registry is the only runtime proof. Results:

### PyPI (commands + verdicts)

```
curl -s -o /dev/null -w "%{http_code}" https://pypi.org/pypi/kailash-rs/json          → 404  ABSENT
curl ... https://pypi.org/pypi/kailash/json                                            → 200  (pure-Python, NOT Rust)
curl ... https://pypi.org/pypi/kailash-enterprise/json                                 → 200  (Rust binding ✓)
curl ... https://pypi.org/pypi/kailash-{dataflow,nexus,kaizen,pact,ml,align}/json      → 200  (pure-Python family)
```

- **`kailash-rs` does not exist on PyPI.** The brief's literal install string is wrong.
- **`kailash`** (2.26.2) is `py3-none-any` — the pure-Python kailash-py SDK (homepage `github.com/terrene-foundation/kailash-py`). Installing it does NOT give the Rust runtime.
- **`kailash-enterprise`** (4.2.2) IS the Rust-powered binding. Summary verbatim: _"Kailash Enterprise — high-performance Rust-powered workflow engine, drop-in replacement for kailash."_ Wheels published for **cp310–cp314 × {manylinux_2_28_aarch64, manylinux_2_28_x86_64, macosx_11_0_arm64, win_amd64}**. `requires_python >=3.10`. Runtime deps are light (`multidict>=6.0`; numpy only under `[ml]` extra).
  - This **matches the repo's own `CLAUDE.md`** which already says `pip install kailash-enterprise`. The Docker brief simply inherited the older/wrong `kailash-rs` string.

### RubyGems (commands + verdicts)

```
curl ... https://rubygems.org/api/v1/gems/kailash.json                                  → 200  (Rust binding ✓)
curl ... https://rubygems.org/api/v1/gems/kailash-{dataflow,nexus,kaizen,pact,enterprise}.json → 404  ABSENT
```

- **`kailash`** (4.2.0) IS the Rust binding. Summary: _"High-performance workflow automation SDK powered by Rust. Build, validate, and execute workflow DAGs from Ruby."_ Precompiled platform gems published for **`x86_64-linux`, `aarch64-linux`, `arm64-darwin`** (87 versions total) → `gem install kailash` pulls a prebuilt binary, **no Rust toolchain at install**. Runtime deps empty; dev deps `rake-compiler`, `rspec`.
- The **sub-gems do NOT exist** — the single `kailash` gem bundles all frameworks (consistent with the CLAUDE.md "one wheel / one gem" model). So `gem install kailash` holds; `gem install kailash-dataflow` etc. would 404.

### Disposition (design corrections — MUST land before /todos)

1. **Replace `pip install kailash-rs` → `pip install kailash-enterprise`** everywhere in the Docker design. (Or `kailash` if the design intends the pure-Python SDK — but for "consume the Rust runtime via bindings" the answer is unambiguously `kailash-enterprise`.)
2. **Ruby `gem install kailash` is correct as written** — no change.
3. **No build-from-source path required.** Both bindings publish prebuilt multi-arch artifacts (PyPI manylinux_2_28 aarch64+x86_64; RubyGems x86_64-linux + aarch64-linux). The container does **not** need a Rust toolchain to install either binding (see item 4).
4. The pure-Python `kailash`, `kailash-dataflow`, `kailash-nexus`, `kailash-kaizen` packages are a **naming collision trap** — they exist and install cleanly but are the kailash-py SDK, not the Rust binding. The design + any smoke test MUST assert the Rust path (`import kailash` resolving from `kailash-enterprise`), not silently pick up pure-Python `kailash`.

---

## Item 3 — Base image strategy (polyglot Rust+Python+Ruby+Node)

**Constraint that drives everything:** the Python binding (`kailash-enterprise`) ships **manylinux_2_28** wheels and the Ruby gem ships **`*-linux`** (glibc) platform gems. manylinux/`*-linux` gems are **glibc-targeted** — an Alpine/musl base would reject the prebuilt wheels/gems and force source builds. **The base MUST be glibc (Debian/Ubuntu), not Alpine.**

### Options evaluated

| Approach                                                              | glibc/manylinux-compat                | Multi-arch    | Verdict                                                                                                        |
| --------------------------------------------------------------------- | ------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| `mcr.microsoft.com/devcontainers/base:ubuntu` + Features              | ✓ (Ubuntu/glibc)                      | ✓ amd64+arm64 | **Recommended** — cleanest; declarative Feature install for all four toolchains                                |
| Official single-lang image (`python:3.12-bookworm`) + manual installs | ✓ (Debian/glibc)                      | ✓             | Viable; loses Feature declarativeness, more hand-rolled Dockerfile                                             |
| Multi-stage                                                           | ✓                                     | ✓             | Useful for slimming a _production runtime_, overkill for a _dev container_ (dev wants all toolchains resident) |
| Any `*-alpine`                                                        | ✗ musl — rejects prebuilt wheels/gems | ✓             | **Rejected** — breaks the prebuilt-artifact premise                                                            |

### devcontainer Features (all confirmed to exist + arm64-capable)

- `ghcr.io/devcontainers/features/rust:1` (1.5.0) — installs rustup/cargo; lists `aarch64-unknown-linux-gnu` target.
- `ghcr.io/devcontainers/features/ruby:1` (1.3.2) — via rvm.
- `ghcr.io/devcontainers/features/python:1` (1.8.0).
- `ghcr.io/devcontainers/features/node:2` (2.0.0) — includes nvm/yarn/pnpm.
- `mcr.microsoft.com/devcontainers/base:ubuntu` (jammy/noble/resolute) — x86-64 + aarch64/arm64.

### Recommendation

**`mcr.microsoft.com/devcontainers/base:ubuntu-24.04` (glibc, multi-arch) + devcontainer Features for `node:2` (pin Node ≥20 for Gemini), `python:1` (≥3.10 for kailash-enterprise), `ruby:1`, and `rust:1`.**

- Node 20 floor is set by Gemini CLI; Python 3.10+ floor by `kailash-enterprise`.
- **Rust Feature is OPTIONAL for binding consumers** (see item 4) — include it only if the dev workflow compiles Rust locally or builds from sdist. Default dev container that only _consumes_ the prebuilt bindings does not need it; including it costs image size but no correctness.
- Install the three CLIs in the Dockerfile/Feature postcreate: Claude Code via native installer (no Node dep) or apt repo for pinned reproducibility; Codex + Gemini via `npm install -g`.

---

## Item 4 — PyO3 wheel + Magnus gem distribution mechanics

**Question: does the container need a Rust toolchain?** **Answer: NO, for pure binding _consumption_** — both ecosystems ship prebuilt binary artifacts that install without a compiler, and the live registry already proves the kailash artifacts exist in prebuilt form.

### PyO3 / maturin (Python)

- manylinux wheels are **prebuilt compiled shared objects**. `pip install` of a wheel whose tag matches the interpreter+platform requires **no Rust toolchain** — pip just unpacks the `.so`.
- The toolchain is needed ONLY if pip falls back to the **sdist** (no matching wheel tag) — then it compiles from source and needs rustc/cargo + a C linker.
- `kailash-enterprise` publishes wheels for cp310–cp314 × manylinux_2_28 {aarch64, x86_64} → on a glibc Linux container with CPython 3.10–3.14, **a matching wheel always exists → no Rust needed.**

### Magnus / rb-sys (Ruby)

- Magnus extensions are built through rb-sys + rake-compiler; maintainers ship **precompiled platform gems** (via `cross-gem-action` / `rb-sys-dock`). Bundler/RubyGems prefer the precompiled platform gem over source when the platform matches → **no compiler at `gem install`.**
- `kailash` gem publishes `x86_64-linux` + `aarch64-linux` precompiled platform gems → on a glibc Linux container, **a matching platform gem exists → no Rust needed.**
- A Rust toolchain would only be needed if installing the **source** (`ruby`-platform) gem, e.g. on an unsupported arch.

### Conclusion — when the container NEEDS Rust

- **Consuming the bindings (the brief's stated purpose): Rust toolchain NOT needed.** Prebuilt manylinux_2_28 wheels (Python) + precompiled `*-linux` platform gems (Ruby) cover both amd64 and arm64 on a glibc base.
- **Rust toolchain IS needed only if:** (a) the dev workflow builds the SDK from source / patches the Rust crates locally, (b) installing on an arch/libc with no prebuilt artifact (e.g. musl/Alpine — already rejected in item 3), or (c) a future Python version ships before a matching wheel tag (sdist fallback).
- **Design call:** make the Rust Feature **opt-in**. The default "binding consumer" container is leaner and correct without it.

---

## Item 5 — Multi-arch base availability

Confirmed via Docker Hub manifest queries (`GET /v2/repositories/library/<img>/tags/latest`) — every candidate official base publishes both target arches:

| Image                                                             | linux/amd64 | linux/arm64/v8 |
| ----------------------------------------------------------------- | :---------: | :------------: |
| `python`                                                          |      ✓      |       ✓        |
| `ruby`                                                            |      ✓      |       ✓        |
| `rust`                                                            |      ✓      |       ✓        |
| `node`                                                            |      ✓      |       ✓        |
| `mcr.microsoft.com/devcontainers/base:ubuntu` (22.04/24.04/26.04) |      ✓      |       ✓        |

All also carry additional arches (ppc64le, s390x, riscv64 on some) but only amd64+arm64 are in scope. The recommended `devcontainers/base:ubuntu-24.04` + Features stack is multi-arch end-to-end, matching the prebuilt-artifact arches (manylinux_2_28 aarch64/x86_64; gem aarch64-linux/x86_64-linux).

---

## Item 6 — ML / Align heavy-dependency weight (opt-in heavy-layer grounding)

**Operator directive:** ground the planned OPT-IN heavy ML/Align layer. Verdict: **CONFIRMED — ML and Align frameworks pull torch-class, multi-GB Python dependencies. An opt-in profile gate is the correct design.**

Evidence (`requires_dist` from PyPI JSON):

- **`kailash-enterprise` `[ml]` extra is LIGHT** — only `numpy>=2.0`. The Rust binding itself does **not** drag torch. So a base "binding consumer" container stays slim; heavy weight comes only from the standalone ML/Align _framework_ packages below.
- **`kailash-ml`** (1.7.4) — even the **base** install declares `torch>=2.2`, `pytorch-lightning>=2.2`, `scikit-learn>=1.5`, `onnxruntime>=1.17`, `skl2onnx`, `onnxmltools` (161 total deps). Extras `all` / `all-gpu` / `dl` / `dl-gpu` / `rl*` add `torchvision`, `torchaudio`, `transformers>=4.40`, `onnxruntime-gpu`. **Approx weight: torch alone is ~0.8–2.5 GB depending on CUDA; with transformers + torchvision/audio + (optional) CUDA runtimes a full install is multi-GB (commonly 2–6 GB+).**
- **`kailash-align`** (0.7.1) — **base** install declares `torch>=2.2`, `transformers>=4.40`, `accelerate>=1.4`, `peft>=0.10`, `trl>=1.0` (27 deps). Extras add `bitsandbytes` (`rlhf`/`all`) and `llama-cpp-python` (`serve`/`all`). **Approx weight: multi-GB (torch + transformers + accelerate; llama-cpp-python adds a compiled native layer).**

**Caveat (binding context):** `kailash-ml` / `kailash-align` on PyPI are **pure-Python `kailash-py`-family** packages (homepage `terrene-foundation/kailash-py`), not Rust-binding-specific distributions — there is no `kailash-ml-enterprise` / Rust-flavoured ML wheel on PyPI today (UNCONFIRMED whether the rs lane ever ships one). In the rs-binding world the ML/Align _Rust_ capability is reached through `kailash-enterprise` (light `[ml]`=numpy) and/or the `35-align-serving` / `34-kailash-ml` skills' GGUF/llama.cpp path — NOT necessarily these PyPI torch stacks. **Design implication:** the opt-in heavy layer should be **dependency-agnostic — gated by a profile/build-arg regardless of which exact package supplies the weight.** Whether the heavy deps arrive via `pip install kailash-ml[dl]`, `kailash-align[serve]`, or a future rs-flavoured package, the gate is the same: first-run stays fast (base = binding-consumer only), heavy torch-class deps land only when the operator opts in.

**Recommendation:** keep ML/Align (and the Rust toolchain, per item 4) behind an opt-in build profile / devcontainer Feature flag. The base image installs only `kailash-enterprise` (Py) + `kailash` (Rb) + the three CLIs; the heavy profile layers torch-class deps on top. Multi-GB pulls confirmed → first-run-fast goal is real and the gate is justified.

## Sources

- Claude Code setup/auth: https://code.claude.com/docs/en/setup
- Codex CLI: https://github.com/openai/codex · https://developers.openai.com/codex/noninteractive · https://developers.openai.com/codex/auth
- Gemini CLI: https://google-gemini.github.io/gemini-cli/docs/cli/headless.html · https://google-gemini.github.io/gemini-cli/docs/get-started/authentication.html
- npm registry: `registry.npmjs.org/{@anthropic-ai/claude-code,@openai/codex,@google/gemini-cli}`
- PyPI JSON API: `pypi.org/pypi/{kailash-rs,kailash,kailash-enterprise,kailash-dataflow,kailash-nexus,kailash-kaizen,kailash-pact,kailash-ml,kailash-align}/json`
- RubyGems API: `rubygems.org/api/v1/gems/kailash.json` · `rubygems.org/api/v1/versions/kailash.json`
- devcontainer Features: https://containers.dev/features · https://github.com/devcontainers/features/blob/main/src/rust/devcontainer-feature.json
- devcontainers base image: https://github.com/devcontainers/images/tree/main/src/base-ubuntu
- PyO3 distribution: https://pyo3.rs/v0.28.0/building-and-distribution.html
- rb-sys / Magnus: https://oxidize-rb.github.io/rb-sys/
- Docker Hub manifests: `hub.docker.com/v2/repositories/library/{python,ruby,rust,node}/tags/latest`
