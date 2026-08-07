# Spec — CLI Toolchain (Node, CLIs, Hooks, Rust, gnupg)

## Authority

The three CLIs, the Node runtime, the hook + MCP-guard layer, the opt-in Rust
toolchain, and commit-signing prerequisites. Implements ADR-03, ADR-05, ADR-06;
serves FR-02, FR-03, FR-06, FR-25, NFR-06.

## Node runtime

- **Node 20 LTS**, pinned. Floor rationale (C5): Gemini CLI needs Node ≥20 at
  RUNTIME; MCP guard `engines` ≥18; Codex install ≥16. 20 covers all with headroom.

## CLIs (external npm packages — pinned to MAJOR line, one manifest)

| CLI         | Package                     | Notes                                                      |
| ----------- | --------------------------- | ---------------------------------------------------------- |
| Claude Code | `@anthropic-ai/claude-code` | native binary; Node needed for install; headless env auth. |
| Codex       | `@openai/codex`             | Rust binary incl. linux-arm64; headless env auth.          |
| Gemini      | `@google/gemini-cli`        | **Node ≥20 at runtime**; headless env auth.                |

Pin policy: major-line range in a single tracked manifest; bump + rebuild to move
forward (ADR-05). All three authenticate headless via env vars
(`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY`) — see `credentials-secrets.md`.

## Hooks + MCP guard

- 29 `.claude/hooks/*.js` are **zero-dependency Node** — need the Node _runtime_, no
  `npm install`.
- `.codex-mcp-guard/` is the only npm-dep surface (`@modelcontextprotocol/sdk` ^1.29,
  `zod` ^4). Run `npm ci` in that dir at build (lockfile present). The guard is
  **load-bearing for BOTH Codex AND Gemini** (both spawn `node ./.codex-mcp-guard/server.js`).
- `server.js` spawns `node ../hooks/<source_file>` subprocesses → hooks must be
  present alongside.
- `auto-format.js` shells `black`/`ruff`/`npx prettier`; install these where feasible,
  but it degrades gracefully (try/catch → "not found") so absence is non-fatal.

## Acceptance

- `claude`/`codex`/`gemini` resolvable on PATH (FR-02).
- `node .codex-mcp-guard/server.js --self-check` exits 0 (FR-03).

## Rust toolchain (OPT-IN — ADR-03)

- NOT in the slim base. Enabled via the `INCLUDE_RUST` build-arg for source builds or
  SDK-source development. When enabled, the toolchain installs to `/opt/cargo` +
  `/opt/rustup` (owned by the non-root `vscode` user) and `cargo`/`rustc` are on PATH.

## Commit-signing prerequisites (FR-25 — peer-validated)

- `gnupg` installed via apt (load-bearing for the multi-operator commit-signing
  substrate; absence breaks silently when a 2nd teammate joins).
- The signing key is mounted **read-only** from the host (`credentials-secrets.md`) —
  never generated or copied into a layer.
- `GPG_TTY` exported in the shell profile + a non-interactive pinentry configured so
  signing works in a headless container.
