# 0027 — DISCOVERY — A named agent produces its report and it is discarded

**Type:** DISCOVERY · **Date:** 2026-08-13 · **Phase:** 05-codify · **Status:** applied

**verified_id:** 548F2C562EB4246D025FA80A70552B124755B685 · **display_id:** jack-hong

## The finding

**Passing `name:` to the Agent tool routes its final report to nowhere.** The agent runs, does competent work, writes its report — and the orchestrator receives only a lifecycle notification carrying no payload. Nothing anywhere reports a failure.

Measured across every spawn in one session. Perfect separation, no exceptions:

| spawn       | `toolUseId` | `taskKind`            | `spawnDepth` | result                      |
| ----------- | ----------- | --------------------- | ------------ | --------------------------- |
| no `name`   | **present** | (none)                | 1            | returned as the tool result |
| with `name` | **absent**  | `in_process_teammate` | 0            | **lost**                    |

`toolUseId` is the handle binding a spawned agent to the tool call that created it. A named agent is registered as a teammate and carries none, so **no tool call is awaiting a result** and the final message has no return path — it lands only in the agent's own transcript.

Three aggravating behaviors, each measured, not inferred:

- **`run_in_background: false` does NOT override it.** A named + synchronous spawn returns `"Spawned successfully"` instead of the reply. There is no opt-out via the synchronous flag.
- **`name` shadows `subagent_type`.** A spawn requesting `general-purpose` was recorded with `agentType` equal to the NAME.
- **The idle notification reads as completion.** `idleReason: "available"` is a lifecycle signal, not a delivery signal.

## Why it cost so much before it was caught

Every other dispatch failure in this corpus announces itself — an errored agent returns an error, a throttled wave returns a throttle string, a shallow clone refuses. This one **reports success at every surface**: the spawn succeeds, the agent succeeds, the notification says "available". The orchestrator waits, re-requests, and eventually re-derives the work by hand having already paid for it.

The instruction made it worse. _"Your final message IS the return value"_ is the correct contract for a task subagent and is actively destructive for a teammate: it tells the agent to write its report as plain prose into a transcript nobody reads. **A mismatch between how an agent is SPAWNED and how it is INSTRUCTED destroys the output of an otherwise-correct run.**

## How it was root-caused

Not by reasoning about the tool description — by reading `subagents/*.meta.json` in the session's own transcript directory, where `taskKind` / `toolUseId` / `spawnDepth` are recorded verbatim. Then confirmed by a **two-spawn controlled experiment**: an unnamed probe returned its text as the tool result; a named + `run_in_background:false` probe returned "Spawned successfully", and its transcript proves it produced the exact requested string that was never delivered.

The falsifying result was available throughout — the unnamed probe also failing to return would have refuted the hypothesis — and was not observed.

## The work was never lost, only undelivered

Agent transcripts persist per spawning session, one file per agent. Extracting the last `type=="assistant"` record's final text block recovered **9 reports / ~146k characters (~36k tokens)** of completed adjudication and research.

Worth doing even after the work has been redone by hand: the recovered reports independently corroborated every hand-derived finding **and surfaced one additional security vector the hand pass had missed**.

## Codified

- `rules/agents.md` § "A Dispatched Agent's Result Is Not Received Until It Is DELIVERED" — SPAWN CONTRACT + DELIVERY GATE halves, with clause-scoped 8-field Trust-Posture Wiring.
- `skills/30-claude-code-patterns/agent-result-delivery.md` — measurement, DO/DO-NOT, BLOCKED corpus, recovery procedure.
- Both routed upstream as Step-7b proposal entries so the fix cascades rather than sitting in one repo.

Distinct from `redteam-dispatch-evidence-gate.md` Axis 1: that axis covers an agent that ERRORED and returned nothing; this covers one that SUCCEEDED and returned nothing. Same rule family (`evidence-first-claims.md` MUST-3), different and more dangerous cause.
