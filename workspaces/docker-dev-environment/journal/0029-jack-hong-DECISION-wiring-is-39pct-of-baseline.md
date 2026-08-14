# 0029 — DECISION — Rule-11 fired on agents.md; the answer is not a split, it is that wiring is 39.6% of the baseline

**Type:** DECISION · **Date:** 2026-08-14 · **Phase:** 05-codify · **Status:** applied

**verified_id:** 548F2C562EB4246D025FA80A70552B124755B685 · **display_id:** jack-hong

## Why this fired

`rule-authoring.md` Rule 11 escalates when the same (rule, CLI) lane takes a second Rule-10-mandated invocation inside 30 days. `agents.md` took one on **2026-07-18** (§ Triad + paired extraction to `parallel-dispatch-default.md`) and another on **2026-08-13** (§ Agent-Result-Delivery + extraction to `guides/rule-extracts/agents.md`) — **26 days apart**. Rule 11's whole point is that the second invocation means _"this rule's per-CLI emission strategy is structurally over-budget"_, not _"this addition is heavy"_ — so the disposition must be corpus-level.

## The measurement that decided it

Across the **11** `priority: 0` + `scope: baseline` rules:

|                                                      | bytes      |
| ---------------------------------------------------- | ---------- |
| total always-on baseline                             | 112,816    |
| `Trust Posture Wiring` + clause-scoped wiring blocks | **44,666** |
| **share of baseline**                                | **39.6%**  |

Per rule: `security.md` 14,481 (48%) · **`agents.md` 13,404 (72%)** · `instrument-discipline.md` 6,101 (55%) · `repo-scope-discipline.md` 3,475 (41%) · `git.md` 2,861 (28%) · `issue-triage-routing.md` 2,738 (56%) · `evidence-first-claims.md` 1,606 (27%).

Method: select on frontmatter, sum each wiring heading to the next same-or-higher heading. Re-derivable.

## The argument

**All eight canonical wiring fields are consumed by REVIEW and HOOK surfaces, not by the agent doing the work.** Severity / Detection mechanism / Violation scope → reviewers + cc-architect at gates. Cumulative posture impact / Regression-within-grace → the posture math. Receipt requirement → the SessionStart _hook_ reading `posture.json`; the agent never needs the rule text to be told to ack. Grace period / Origin → provenance.

The agent needs the MUST clauses. The **reviewer** needs the wiring. Shipping reviewer metadata into the always-on agent baseline is a 39.6% misallocation — and it is the structural reason `agents.md` keeps re-triggering Rule 10, because every clause-scoped wiring block a new MUST requires is itself baseline-emitted. Each fix makes the next fix more expensive.

**Recommendation (Rule 11's fourth option — per-CLI emission strategy change):** emit wiring blocks on the skill/reference channel reachable at the gate surfaces that consume them; keep MUST clauses baseline.

## Alternatives considered and rejected

- **Split `agents.md` into sibling baseline rules** — two `scope: baseline` rules emit the same total bytes as one. Relieves nothing on the axis Rule 10 gates, and fragments the orchestration contract every delegation consults.
- **Demote to `scope: path-scoped`** — orchestration has no file-glob signal; an agent dispatches _before_ touching any matching path. Demotion makes the rule unreachable exactly when it governs — the reachability gap `issue-triage-routing.md` was created to close, reintroduced one rule over.
- **A fourth extraction-to-skill** — insufficient, not wrong. `agents.md` has already been extracted three times; the residual is minimum-viable MUSTs plus mandatory wiring. A fourth would recur within the month, which is the pattern Rule 11 exists to escalate rather than repeat.

## Honest bounds

- The wiring **is** agent-facing in one case: an agent _authoring_ a rule must emit the 8 fields (`trust-posture.md` MUST-8). That agent is in a `/codify` session touching `.claude/rules/**` — a path-scoped trigger — so the skill/reference channel serves it without loss.
- Any implementation MUST keep the `**Violation scope:**` grep token reachable to the cc-architect sweep MUST-8 anchors on. A naive "strip the section" breaks that sweep. This is a **routing** change, not a deletion.
- **This proposal changes no emission behavior.** It is the disposition Rule 11 requires; the emitter is loom's.

## Value-anchor

Source (d), literal operator quote, 2026-08-13: _"we have multiple runs where we waste tokens and time… eradicate it at the root"_ and _"root cause long term fix please."_ The always-on baseline is the largest recurring token cost every consumer session pays, and 39.6% of it is metadata the agent never acts on. That is the same waste class, one surface over — and a fourth extraction would be the symptom fix the operator explicitly ruled out.
