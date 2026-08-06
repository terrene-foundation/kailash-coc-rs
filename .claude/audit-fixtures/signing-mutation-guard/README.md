# signing-mutation-guard audit fixtures

Per `cc-artifacts.md` Rule 9 + `hook-output-discipline.md` MUST-4. One
fixture per scope-restriction predicate the hook
(`.claude/hooks/signing-mutation-guard.js`, B3a) relies on.

## PRECONDITION — coordination MUST be ON (read this before triaging a "fail-open")

**Every `block` disposition below presumes multi-operator coordination is
ENABLED on the repo under test.** The hook gates its ENTIRE substrate — both the
§4.2 sibling-porcelain check and the degraded-mode block — behind
`isCoordinationEnabled()` (the MO-OPT W1-c opt-in gate) and passes through
BEFORE either predicate is evaluated when coordination is OFF. That passthrough
is CORRECT and deliberate: coordination is opt-in / OFF by default, and on a
solo or un-enrolled repo an absent signing key means "un-enrolled", not
"degraded" — blocking every tracked-path Edit because no GPG key is configured
would be the real disruption.

**Consequence:** driving these fixtures on a coordination-OFF repo yields
`{"continue":true}` / exit 0 for `03` and `06`. That is NOT a fail-open, and it
is NOT a regression in the guard — it is a MISSING PRECONDITION in the harness.
Issue #74 was filed as a suspected fail-open from exactly this shape; the guard
was correct and the harness was driving a lane the guard does not gate.

### Canonical invocation

The canonical runner is **`run.mjs`** in this directory (#89 AC-3). It builds a
temp git repo per fixture, ESTABLISHES coordination ON explicitly, drives the
hook, and asserts `severity` / `exit_code` / `continue` / `stderr_tag` from each
`expected.txt`. It exits non-zero when any check fails, so it can gate CI.

```bash
node .claude/audit-fixtures/signing-mutation-guard/run.mjs   # 42 checks
echo $?                                                      # 0 = green
```

Each precondition is NAMED in the check text, so a precondition failure can never
be mistaken for a guard failure — the confusion that produced #74. `T8` drives the
same fixtures at a coordination-OFF repo as a NEGATIVE CONTROL, reproducing #89's
measured passthrough, so the ON-repo greens are demonstrably attributable to the
precondition rather than to luck.

These fixtures are ALSO driven by `.codex-mcp-guard/test-server.mjs`
(`npm test` in `.codex-mcp-guard/`), whose `makeCoordinationEnabledRepo()`
helper builds a temp git repo with the tier-2 local override
(`.claude/learning/coordination-mode.json` → `{"enabled":true}`) and passes it
as `cwd`. To drive the hook by hand, reproduce that precondition:

```bash
T=$(mktemp -d); git -C "$T" init -q
printf 'x\n' > "$T/tracked.txt"; git -C "$T" add -f tracked.txt
git -C "$T" -c user.email=t@t -c user.name=t commit -qm init
mkdir -p "$T/.claude/learning"
printf '{"enabled":true}' > "$T/.claude/learning/coordination-mode.json"
printf '{"hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"%s/tracked.txt"},"cwd":"%s"}' "$T" "$T" \
  | COC_OPERATOR_KEY_PATH="" COC_SIGNING_MUTATION_GUARD_FORCE_DEGRADED=1 \
    node .claude/hooks/signing-mutation-guard.js   # → exit 2, [BLOCK]
```

Tier-2 force-ON is used deliberately: `coordination-mode.js` ASYMMETRIC
PRECEDENCE always honors `enabled:true` but REFUSES `enabled:false` on an
enrolled repo, so this precondition cannot be repurposed to weaken a real repo.

## Predicates covered

| Fixture                            | Predicate exercised                                                     | Expected disposition |
| ---------------------------------- | ----------------------------------------------------------------------- | -------------------- |
| `01-halt-sibling-porcelain/`       | Sibling worktree porcelain shows EXACT target path uncommitted-modified | halt-and-report      |
| `02-pass-no-sibling/`              | No sibling worktrees → empty match-set                                  | silent passthrough   |
| `03-block-degraded-mode-mutation/` | No signing key + Edit on tracked path                                   | block                |
| `04-pass-degraded-mode-read/`      | No signing key + Read on tracked path (non-mutating)                    | silent passthrough   |
| `05-pass-signing-key-present/`     | Signing key resolved + no sibling contention + Edit                     | silent passthrough   |
| `06-block-git-commit-degraded/`    | No signing key + `git commit` Bash (git-mut command)                    | block                |

## Why these and only these

The hook's scope-restriction predicates are (per `cc-artifacts.md`
Rule 9 + architecture v11 §2.3 + §4.3 + R4-S-02 + R5-S-03):

1. **Operation classification** (`classifyOperation`): Edit | Write |
   Bash-with-mutation. Fixtures 04 (Read) and 02 (Edit + no sibling)
   cover the non-mutating + non-contended branches.
2. **§4.2 sibling-worktree porcelain predicate**
   (`detectSiblingContention` → `lib/sibling-porcelain.js`):
   grounded in the process-local structural primitive (`git status
--porcelain` against enumerated sibling worktrees), so
   `hook-output-discipline.md` MUST-2 PERMITS `severity: "block"` —
   it does NOT require it, and since loom#1323 this branch emits
   **halt-and-report**: sibling worktrees have physically separate
   working trees, so the write cannot clobber the sibling's bytes and
   the only real collision is a recoverable 3-way merge conflict at
   merge time. Fixture 01 covers the positive via
   `COC_PORCELAIN_OVERRIDE`; the override-precedence contract matches
   B1's adjacency-leasecheck convention (whose §4.2 branch was
   downgraded in the same change, so BOTH guards on the shared
   `Edit|Write|NotebookEdit` matcher now surface rather than deny —
   the enforcement-surface parity that makes the downgrade real).
3. **Degraded-mode working-tree-mutation predicate**
   (`wouldMutateWorkingTree`): the ONLY remaining `severity: "block"`
   branch in this hook, grounded in `git ls-files --error-unmatch
<path>` structural signal. Per R5-S-03, degraded mode is a working-
   tree-mutation predicate, NOT an Edit/Write tool-name allowlist —
   fixtures 03 (Edit on tracked path) and 06 (`git commit` Bash
   command) cover both the Edit-form and the git-mut-form of the
   mutation predicate. It STAYS `block` deliberately: an unsigned
   mutation lands with no attributable, chain-verifiable record and
   nothing recovers the missing signature after the fact (the
   IRRECOVERABLE class). Fixtures 01 vs 03/06 exist as a matched pair
   precisely to lock that asymmetry against a future "consistency
   fix" that downgrades 03/06 to match 01.
4. **Signing-key resolution** (operator-id 3-tier + override env
   vars): fixture 05 covers the happy-path where the key is
   present.

### Removed: `01-block-sibling-porcelain/` (stale, pre-loom#1323)

That directory carried a **byte-identical `input.json`** to
`01-halt-sibling-porcelain/` and the **opposite** expectation
(`severity: block` / `exit_code: 2`). It was the pre-#1323 fixture: the sync that
ADDED the downgraded `01-halt-*` never DELETED its predecessor, so both shipped.
No guard can satisfy both, and the loser stood as a permanent argument for
re-upgrading the §4.2 branch — the exact regression the matched pair exists to
prevent, wearing the costume of a fixture. Removed here; `run.mjs` T1 (coverage)
and T2 (contradiction lock) each catch a recurrence independently. **If a future
`/sync-to-use` re-adds it, that is the deletion failing to propagate upstream —
fix it at the source, do not re-delete locally.**

## Runner discrimination (instrument-discipline.md MUST-2)

A green runner is evidence ONLY if it would go RED in the behaviour's absence.
Measured 2026-08-06 against the shipped guard. Each mutant was a `cp` of the
guard carrying a `process.stderr.write("[MUTANT-Mx-EXECUTED]")` marker at the
mutated site and driven via `HOOK=<mutant> node run.mjs`; the guard itself was
never edited in place (`cmp` vs the pristine backup: identical).

| #   | Mutation                                                                                         | Reached code?   | Result                        | Checks reddened                                                                                       |
| --- | ------------------------------------------------------------------------------------------------ | --------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| M1  | degraded-mode branch `block` → `halt-and-report` (the "consistency fix" this README warns about) | yes (marker ×2) | 32 pass / **10 fail**, exit 1 | 03 + 06 exit/continue/tag, T7 both `STAYS block` rows, T7 both `does NOT emit [HALT-AND-REPORT]` rows |
| M2  | §4.2 sibling-porcelain `halt-and-report` → `block` (asymmetry normalized the other way)          | yes (marker ×1) | 37 pass / **5 fail**, exit 1  | 01 exit/continue/tag, T7 `is halt-and-report`, T7 `does NOT emit [BLOCK]`                             |
| M3  | `isCoordinationEnabled` opt-in gate deleted (always ON)                                          | yes (marker ×5) | 40 pass / **2 fail**, exit 1  | T8 negative control for 03 + 06                                                                       |
| M4  | opt-in gate INVERTED (passthrough when ON)                                                       | yes (marker ×5) | 27 pass / **15 fail**, exit 1 | all ON-repo halt/block rows + T7 + T8                                                                 |
| M5  | `wouldMutateWorkingTree` returns false for `git-mut`                                             | yes (marker ×2) | 37 pass / **5 fail**, exit 1  | 06 exit/continue/tag/guard-named + T7 `STAYS block`                                                   |

**M1 and M2 together are the asymmetry lock.** M1 reds ONLY the 03/06 rows; M2
reds ONLY the 01 rows. A change that normalized both branches to one severity
would trip both sets, so the matched pair holds the distinction from either side.

**A non-reddening mutation has TWO explanations** (vacuous check OR inert
mutation), so the marker column is load-bearing, not decoration. The first cut of
M1/M2 injected its marker INSIDE the `emit({...})` object literal, producing a
`SyntaxError`; the mutant crashed before reaching any branch and reddened 24
checks for a reason unrelated to the mutation. That result was DISCARDED, not
recorded — the marker never printed, so it proved nothing. Any future re-run MUST
gate each mutant on `node --check` and confirm a non-zero marker count before
reading its tally.
