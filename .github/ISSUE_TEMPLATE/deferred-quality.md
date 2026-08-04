---
name: Deferred quality (INCREMENTAL)
about: An INCREMENTAL finding held with the four conditions that make it a tracked hold rather than an abandonment
title: "[deferred-quality] "
labels: deferred-quality
---

<!--
STOP FIRST — is this actually INCREMENTAL?

Per `rules/product-completion-first.md` MUST-1 the CATEGORY gates fix-vs-defer, and
SEVERITY never does. A LOW-severity bug is still a BUG and is fixed now; a MED-severity
polish item with no forward-impact is deferred.

This template is ONLY for INCREMENTAL: polish, prose/naming, defense-in-depth BEYOND an
already-working guard, tail-quality OFF shipped paths, redundant coverage,
refactor-for-elegance. No forward-impact; does not block testing or closure.

It is NOT for:
  - a failing test / build / type check          -> BUG, fix now
  - a shipped path that is wrong, insecure, lossy -> BUG, fix now
  - a contract or API break                       -> BUG, fix now
  - anything foundational that later work builds on -> INVEST-NOW, fix now + surface at /sweep

Classification is FAIL-CLOSED: if the category is ambiguous, it resolves toward
IMMEDIATE, never toward defer. And if you cannot name the success-criterion you checked
this against (§1 below), the disposition is ESCALATE — not auto-defer.

All four sections below are REQUIRED. An issue missing any one of them is not a
compliant defer; it is silent deferral, which MUST-2 BLOCKS.
-->

## 1. Blocking-safety note

<!--
Which shipped / success path does this NOT touch? Be specific enough that a reader can
check it. This is what demonstrates the item is genuinely off-path INCREMENTAL rather
than a mis-labelled BUG.

Name the success-criterion you checked against. If no criterion covers this path, say so
explicitly and ESCALATE instead of filing here.
-->

## 2. Value-anchor

<!--
ONE sentence: why does this deliver value to the USER?

MUST cite a user-anchored source from the closed allowlist in
`rules/value-prioritization.md` MUST-1:
  (a) the user's brief in the originating session
  (b) `briefs/` in an active workspace
  (c) a journal DECISION entry
  (d) a literal user quote
  (e) a spec section success-criterion the user authored or approved

Code-health reasoning (test coverage, blast radius, tech debt, "it's cleaner") is a
SECONDARY anchor and cannot stand alone here. "It's obviously worth doing" is not an
anchor. Without this, the item's rationale evaporates at the next /clear and the issue
becomes institutionally dead — 7 of 7 deferred items decayed rather than being picked up,
which is why this field exists.
-->

## 3. Full-fix acceptance criteria

<!--
The testable definition of done. What must be true for this to close?

Write it so a future session can execute it without reconstructing your reasoning —
that session will not have your context.
-->

## 4. Revisit trigger

<!--
Exactly one:

  after-milestone:<name>   fires when <name> lands
  on-demand                surfaced at every /sweep

Both are re-surfaced by Sweep-N. An item deferred >= 2 sweeps or >= 2 sessions ago gets a
"still wanted?" gate; the disposition is yours, not the agent's — implement,
re-defer-with-a-fresh-anchor, or close-with-gate. It is never auto-closed as not_planned.
-->
