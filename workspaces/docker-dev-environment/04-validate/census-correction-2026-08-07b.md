# Enforcement-layer census — CORRECTION at `2c4cd1e`

**Supersedes** the census taken at commit **`4418328`**. (That census lives in a
per-operator session-notes fragment which is gitignored and therefore unreadable from a clone
of this public repo — the commit SHA above is the durable anchor, not the path.)
**Instrument:** each runner driven individually, `timeout 150 node run.mjs`, exit code read
directly — never through a pipe. Same cap as the superseded census, so the two ARE comparable.

The prior census reported **10 non-green** and routed them as ten problems. Six share ONE
root cause, one is not a failure at all, and one carried a wrong diagnosis. The substantive
red set at this tier is **two**, not ten.

---

## 1. The correction, per runner

| runner                                 | prior verdict          | measured now              | actual class                        |
| -------------------------------------- | ---------------------- | ------------------------- | ----------------------------------- |
| `variant-overlay`                      | red (exit 78)          | exit 78                   | **NOT A FAILURE — declared skip**   |
| `validate-proximity-band`              | **genuine hang >151s** | **exit 1, 12/20**         | terminates; cascade of emit RED     |
| `codex-dispatcher`                     | red (exit 1)           | exit 1, 8/8 failed        | shipped-fixture / unshipped-subject |
| `strip-build-internal`                 | red (exit 1)           | exit 1, ENOENT            | shipped-fixture / unshipped-subject |
| `coc-manifest-integrity-class-derived` | module-not-found       | unchanged                 | shipped-fixture / unshipped-subject |
| `detection-dispatch-check`             | module-not-found       | unchanged                 | shipped-fixture / unshipped-subject |
| `envelope-dna-rollup`                  | module-not-found       | unchanged                 | shipped-fixture / unshipped-subject |
| `pact-envelope`                        | module-not-found       | unchanged                 | shipped-fixture / unshipped-subject |
| `validate-emit`                        | red (exit 1)           | exit 1, 34 pass / 21 fail | **genuinely substantive**           |
| `scan-synced-disclosure`               | red, root-caused #109  | unchanged                 | empty fixture content (#109)        |

## 2. Root cause A — shipped fixture, deliberately unshipped subject (6 runners)

The fixture DIRECTORY ships to this USE tier; the artifact it tests does NOT. The runner then
fails on absence and reads as an enforcement regression. For two of the six the exclusion is
not an oversight — `sync-manifest.yaml` **declares it deliberately**:

- `.claude/codex-templates/` — _"loom-internal Codex emitter SOURCE tree … NEVER belongs on a
  consumer surface"_ (manifest ~line 3133; actively purged via `.coc-obsoleted`).
- `agents/management/coc-sync.md` — _"Gate-2 distributor — loom-only orchestration"_ (~line 3234).

So `codex-dispatcher` and `strip-build-internal` **contradict the manifest's own stated intent**:
the manifest purges the subject from every consumer while the fixture that tests it still ships.
The other four import `.claude/bin/*.mjs` modules absent for the same reason.

Verified absent here, with a working control that the check CAN report PRESENT:

```
.claude/codex-templates/bin/coc               ABSENT
.claude/agents/management/coc-sync.md         ABSENT
.claude/bin/coc-manifest-integrity.mjs        ABSENT
.claude/bin/detection-dispatch-check.mjs      ABSENT
.claude/bin/validate-envelope-dna.mjs         ABSENT
.claude/bin/validate-pact-envelope.mjs        ABSENT
.claude/bin/emit.mjs                          PRESENT   <- control: check discriminates
.claude/audit-fixtures/codex-dispatcher       PRESENT   <- the fixture DID ship
```

**Fix (loom-side, one change):** `use_exclude` each fixture directory alongside the subject it
tests. A fixture is an enforcement instrument for an artifact; it belongs on exactly the tiers
that receive the artifact. **Do not "fix" these locally** — `.claude/**` is Class-A.

**Why it matters beyond noise:** six runners that cannot pass at any consumer tier train every
future reader to treat a red enforcement layer as normal. That is the condition under which a
real red goes unnoticed.

## 3. Root cause B — `validate-proximity-band` does not hang; emit is RED

The prior census recorded a **genuine hang (>151s)**. That is falsified: it **terminates at
exit 1, 12 of 20 fixtures passing**. Its 8 failures all carry one upstream reason:

```
"emit dry-run exited 2 (expected 0) — no lane data is trustworthy"
"emit dry-run produced 0 parseable lanes — no lane was examined"
```

Measured directly (exit read with no pipe): `node .claude/bin/emit.mjs --cli codex --lang rs
--dry-run` → **EXIT=1**, failing `[validator-14] rule-frontmatter` (`rule-authoring.md` Rule 7):

| file in `.claude/rules/`               | finding                         | assessment                                     |
| -------------------------------------- | ------------------------------- | ---------------------------------------------- |
| `build-speed.md`                       | missing `priority:` + `scope:`  | genuine gap                                    |
| `dataflow-null-typing.md`              | missing `priority:` + `scope:`  | genuine gap                                    |
| `llm-auth-strategy-hygiene.md`         | missing `priority:` + `scope:`  | genuine gap                                    |
| `release.md`                           | missing `priority:` + `scope:`  | genuine gap                                    |
| `patterns.md`                          | **no frontmatter block at all** | genuine gap — and it is a loaded baseline rule |
| `ci-runners.operator.local.example.md` | no frontmatter block            | **likely validator false-positive**            |

The last row is not a rule. It is the committed **schema/template** an operator copies to a
gitignored `ci-runners.operator.local.md`; `ci-runners.md` itself describes it that way. A
validator that walks `.claude/rules/*.md` and demands rule frontmatter will always fail it.
Either the file does not belong in `rules/`, or validator-14 needs an `*.example.md` carve-out.

Note the cascade shape: one validator failure makes emit exit non-zero, which strips
proximity-band of lane data, which surfaces as eight unrelated-looking fixture failures and was
recorded as a hang. **The proximity-band failures are a symptom; validator-14 is the defect.**

## 4. Root cause C — the one genuinely substantive failure

`validate-emit`: **34 pass / 21 fail**, all in the `hookEvent` family. Ruled out as
absence-driven — `grep -cE "ENOENT|Cannot find module|No such file"` over its output returns
**0**, and its subject `.claude/bin/validate-emit.mjs` is **PRESENT**. This is the single red
runner at this tier that is a real enforcement defect rather than a distribution artifact.

## 5. Instrument note (carry forward)

`variant-overlay`'s exit **78 is a deliberate skip**, not a failure. Its own output says so:

```
SKIP: repo class "coc-use-template" — this suite applies to coc-source.
```

A census that buckets by exit code alone will mis-file it every time. **Bucket by the runner's
own reported verdict, not by non-zero-exit.** The prior census's "1 exit-78" line is what a
purely numeric instrument produces.

Equally: `timeout 150 node run.mjs | tail` reports the exit status of `tail`, not `node`. That
mistake was made once in this session and caught — a direct `$?` read is the only valid form.

## 6. Net effect on the ledger

- **G11** — premise falsified. Not a hang. Re-file as: validator-14 rule-frontmatter failure
  makes emit exit non-zero; proximity-band is downstream of it.
- **G8 / G9 / F36** — consolidate. Six runners, one root cause, one loom-side fix
  (`use_exclude` fixture dirs with their subjects).
- Remaining genuinely substantive at this tier: **`validate-emit` (21 hookEvent fixtures)** and
  **validator-14's six frontmatter offenders**.
