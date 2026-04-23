# Kailash COC — Multi-CLI (Rust)

<p align="center">
  <img src="https://img.shields.io/badge/CLI-Claude%20Code%20%7C%20Codex%20%7C%20Gemini-7C3AED.svg" alt="Three CLIs">
  <img src="https://img.shields.io/badge/architecture-COC%205--Layer-blue.svg" alt="COC 5-Layer">
  <img src="https://img.shields.io/badge/SDK-Kailash%20Rust-F74C00.svg" alt="Kailash Rust SDK">
</p>

<p align="center">
  <strong>Cognitive Orchestration for Codegen (COC) — single knowledge surface across three driving CLIs.</strong><br>
  Drop this template into your Python or Ruby project that consumes the Kailash Rust SDK through bindings, and inherit institutional knowledge — agents, skills, rules, hooks, commands — whether you drive development with <a href="https://docs.anthropic.com/en/docs/claude-code">Claude Code</a>, <a href="https://developers.openai.com/codex/">OpenAI Codex</a>, or the <a href="https://geminicli.com/">Gemini CLI</a>.
</p>

---

> "The problem with vibe coding is not the AI model. It's the absence of institutional knowledge in the coding loop — and having to maintain that knowledge in three different places for three different CLIs."

COC solves both problems. A single `.claude/` source tree is compiled into per-CLI surfaces (`.codex/`, `.gemini/`) with parity-enforced semantics. Rules, agents, skills, and hooks are authored once; every CLI loads them in its native form.

This template targets **binding consumers** — Python and Ruby developers writing applications that call into the Kailash Rust runtime via PyO3 / Magnus wrappers. You do not write Rust here; you write Python or Ruby that drives the Rust SDK.

---

## Three CLIs, One Knowledge Surface

```
                    .claude/  (source of truth)
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
     CLAUDE.md      AGENTS.md       GEMINI.md
     + .claude/     + .codex/       + .gemini/
         │              │              │
    Claude Code       Codex        Gemini CLI
```

Each CLI reads its baseline file (`CLAUDE.md` / `AGENTS.md` / `GEMINI.md`) from the repo root at session start. Slash commands, specialist subagents, hooks, and skills are emitted into the CLI's native config tree with the same semantic content — only the surface syntax differs.

## The Five Layers

```
Your Natural Language Request
         │
  1. Intent       22+ Specialists   Who should handle this?
         │
  2. Context      34 Skills          What does the AI need to know?
         │
  3. Guardrails   11 Rules + 9 Hooks What must the AI never do?
         │
  4. Instructions Baseline + 29 Cmds What should the AI prioritize?
         │
  5. Learning     Observe → Evolve  How does the system improve?
         │
  Production-Ready Code
```

### Layer 1: Intent — Specialist Agents

Framework specialists (`dataflow-specialist`, `nexus-specialist`, `kaizen-specialist`, `mcp-specialist`, `pact-specialist`, `ml-specialist`, `align-specialist`), implementation (`pattern-expert`, `tdd-implementer`, `build-fix`), quality (`reviewer`, `security-reviewer`, `gold-standards-validator`), frontend (`react-specialist`, `flutter-specialist`, `uiux-designer`), testing (`testing-specialist`), release (`release-specialist`), analysis (`analyst`), and domain (`value-auditor`, `open-source-strategist`).

- **Claude Code**: `Agent(subagent_type="dataflow-specialist", prompt=...)`
- **Codex**: via the Codex agent layer — see `.claude/agents/codex-architect.md`
- **Gemini**: `@dataflow-specialist <task>`

### Layer 2: Context — Skills

Progressive-disclosure `.claude/skills/` directories, mirrored into `.codex/skills/` and `.gemini/skills/`. `SKILL.md` answers 80% of routine questions; deeper reference lives in sub-files loaded on demand. Covers Core SDK, DataFlow, Nexus, Kaizen, MCP, PACT, ML, Align, nodes reference, workflow patterns, deployment/git, enterprise infrastructure, security patterns, UI/UX, and more — framed for binding consumers.

### Layer 3: Guardrails — Rules + Hooks

**Rules** (`.claude/rules/`) apply across every CLI. CRIT baseline rules load every session: `autonomous-execution`, `zero-tolerance`, `agents`, `git`, `security`, `communication`, `cross-cli-parity`, `worktree-isolation`, `rule-authoring`. Path-scoped rules load only when editing matching files.

**Hooks** (`.claude/hooks/`) fire at session lifecycle points:

| Hook                            | What It Does                                                   |
| ------------------------------- | -------------------------------------------------------------- |
| `session-start.js`              | Validates `.env`, detects active framework + workspace         |
| `user-prompt-rules-reminder.js` | Anti-amnesia: re-injects rules + workspace state per turn (CC) |
| `validate-bash-command.js`      | Blocks destructive commands (`rm -rf /`, fork bombs)           |
| `validate-workflow.js`          | Blocks hardcoded models, detects 13 API key patterns           |
| `auto-format.js`                | Runs formatters on every write                                 |
| `pre-compact.js`                | Saves state before context compression                         |
| `session-end.js`                | Persists session stats for learning                            |
| `stop.js`                       | Emergency state save                                           |
| `integration-hygiene.js`        | Post-write integrity check                                     |

**Per-CLI hook surface coverage**: CC fires hooks on every tool event. Codex hooks fire on Bash invocations only; non-Bash tools (`apply_patch`, `Write`) route through `.codex-mcp-guard/` (MCP guard server). Gemini's event names differ (`BeforeTool` / `AfterTool` instead of `PreToolUse` / `PostToolUse`). See `.claude/agents/codex-architect.md` and `gemini-architect.md`.

### Layer 4: Instructions — Baselines + Slash Commands

Each CLI loads its own baseline:

- `CLAUDE.md` — template-owned, always loaded by Claude Code
- `AGENTS.md` — regenerated from `.claude/rules/` by `emit.mjs --cli codex --lang rs`
- `GEMINI.md` — regenerated from `.claude/rules/` by `emit.mjs --cli gemini --lang rs`

Slash commands span phases (`/analyze`, `/todos`, `/implement`, `/redteam`, `/codify`, `/release`) and utilities (`/sdk`, `/db`, `/api`, `/ai`, `/test`, `/design`, `/validate`, `/deploy`, `/ws`, `/wrapup`, `/journal`, …). Codex invokes via `/prompts:<name>`; Gemini via `/<name>` (TOML-defined); CC via `/<name>` (Markdown-defined).

### Layer 5: Learning — Closed-Loop Evolution

`.claude/learning/` captures session observations; loom's `/codify` cycle extracts recurring patterns into new skills, commands, and agents that flow back through the template.

---

## Quick Start

```bash
# Clone this template as your project starter (or use the "Use this template" button)
git clone https://github.com/terrene-foundation/kailash-coc-rs.git my-project
cd my-project

# Configure
cp .env.example .env   # Fill in your API keys (Anthropic, OpenAI, or Google)

# Install the Kailash Rust binding for your language
pip install kailash-rs           # Python binding
# or
gem install kailash              # Ruby binding

# Drive with any CLI
claude              # Claude Code
codex               # OpenAI Codex
gemini              # Gemini CLI
```

Hooks validate your environment on session start. Rules, skills, and specialist agents load automatically based on what you ask and which files you touch.

---

## Repository Structure

```
.claude/                   Source of truth (shared across CLIs)
  agents/                  22+ specialist agent definitions
  skills/                  34 domain knowledge directories
  rules/                   Behavioral constraint files (CRIT + path-scoped)
  commands/                Phase + utility slash command definitions
  hooks/                   Node.js lifecycle hooks
  codex-templates/         Codex config base (hooks.json, config.toml)
  codex-mcp-guard/         MCP guard server for non-Bash Codex tool wrapping
  gemini-templates/        Gemini config base (settings.json)
  guides/                  Claude Code / Codex / Gemini reference guides
  variants/                Per-language slot overlays (rs-specific content)

.codex/                    Codex config tree (emitted — do not edit)
  config.toml              Per-project Codex settings
  hooks.json               Bash-tool enforcement hooks
  prompts/*.md             29 slash commands
  skills/                  Codex-visible skill tree

.codex-mcp-guard/          MCP guard server (emitted — do not edit)
  server.js                Runtime predicate enforcement
  extract-policies.mjs     AST-based predicate extraction

.gemini/                   Gemini config tree (emitted — do not edit)
  settings.json            Hooks + MCP servers
  commands/*.toml          29 slash commands (TOML format)
  skills/                  Gemini-visible skill tree
  agents/*.md              22 @-invokable specialist subagents

scripts/                   Utility scripts (migrate, plugin, template resolution)

AGENTS.md                  Codex baseline (emitted — do not edit)
CLAUDE.md                  Claude Code baseline (template-owned)
GEMINI.md                  Gemini baseline (emitted — do not edit)
.env.example               Environment variable template
```

---

## Cross-CLI Parity Contract

`.claude/rules/cross-cli-parity.md` defines what MUST match across the three emissions:

- **Neutral-body slot content** — byte-identical across every CLI emission of the same rule (hard block on drift)
- **Frontmatter `priority:` + `scope:`** — identical values (hard block on drift)
- **Examples slot** — may diverge (delegation syntax) but only inside a scrub-token allowlist (soft warn only)

Loom's emitter runs a drift audit on every sync — rules that mean different things on different CLIs are caught at emit time, not at user time.

---

## Regeneration & Updates

This template is produced by **loom**. To update to the latest COC version:

```bash
# From within loom/
/sync rs
```

Flow:

```
BUILD repos (kailash-rs) ─→ /codify ─→ loom/.claude/.proposals/
                                              │
                                              ▼
                                          human review
                                              │
                                              ▼
                             /sync rs ─→ this template
```

Do not hand-edit emitted files (`AGENTS.md`, `GEMINI.md`, `.codex/prompts/`, `.codex/skills/`, `.gemini/commands/`, `.gemini/skills/`, `.gemini/agents/`). Edit the source in loom's `.claude/` and re-sync.

---

## Binding Consumer Perspective

This template targets downstream apps that consume the Kailash Rust SDK through bindings. You write:

- **Python** — via `kailash-rs` wheels (PyO3 bindings)
- **Ruby** — via the `kailash` gem (Magnus bindings)

You do NOT write Rust in a project using this template. Rust lives in `esperie/kailash-rs` (the SDK source workspace), behind the binding layer. All skill code examples, test patterns, and rules in this template use Python or Ruby — never `cargo`, `use crate::`, or `#[derive]`.

SDK bug reports go to `esperie/kailash-rs`; binding-specific issues go there as well (the bindings are part of the same workspace).

---

## Relationship to CARE/EATP

COC applies the same trust architecture from the Kailash SDK's CARE/EATP framework to codegen: humans define the operating envelope (Trust Plane), AI executes within those boundaries at machine speed (Execution Plane). Rules and hooks form the Operating Envelope. Mandatory review gates maintain Trust Lineage. Hook enforcement provides Audit Anchors.

---

## Built For Kailash (Rust SDK)

Built for the [Kailash Rust SDK](https://github.com/esperie/kailash-rs) — the Rust implementation of the Kailash platform. The SDK ships as one Cargo workspace with Core, DataFlow, Nexus, Kaizen, Enterprise, PACT, ML, Align, plus Python / Ruby / Node.js / WASM bindings. The COC architecture is framework-agnostic; the knowledge encoded in `.claude/` is Kailash-specific, framed for binding consumers.

**Peer templates:**

- [`kailash-coc-py`](https://github.com/terrene-foundation/kailash-coc-py) — Multi-CLI Python template (Kailash Python SDK)
- [`kailash-coc-claude-py`](https://github.com/terrene-foundation/kailash-coc-claude-py) — CC-only Python template
- [`kailash-coc-claude-rs`](https://github.com/terrene-foundation/kailash-coc-claude-rs) — CC-only Rust-binding template

---

## License

See repository `LICENSE`.
