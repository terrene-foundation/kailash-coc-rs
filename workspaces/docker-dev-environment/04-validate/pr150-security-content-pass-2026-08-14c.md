# PR #150 — bounded security-surface content pass (sweep D2b)

**Scope** One cycle, explicitly NON-EXHAUSTIVE, targeting the risk CLASS (auth, signing,
path containment, sanitization, fail-closed) regardless of Gate-A bucket — the bucket
partition was refuted in the prior cycle and was not used here.

**Refs** OURS `main` `0e69ad0` · THEIRS `refs/adjudicate/sync-150` `55ae4cc` · merge-base
`4522498` · **merged tree `d7c5891`** (`git merge-tree --write-tree`).

**Method** Four parallel read-only lanes (auth/signing · path/sanitization · fail-closed/authz
· plus sub-agent fan-out), each comparing BOTH versions semantically and executing the repo's
own byte-identical fixtures. Every headline below was then re-verified by the orchestrator
against the MERGED tree, because two-tree comparison does not establish merge effect.

---

## The one finding that decides the disposition

**The cross-repo merge fence is deleted at FOUR layers in one PR, and the deletion LANDS.**

`upstream-issue-hygiene.md` MUST-4 "Open, Never Complete" — _you may only complete a PR on
the repo you ARE_ — is removed at:

1. **Code**, both VCS adapters: `completeUpflowPR` loses all four refusals, and the merge
   request path flips from the server-derived identity to the **caller-supplied** `repoRef`.
2. **Rule**: the MUST-4 clause and its entire Trust-Posture Wiring block.
3. **Operator surfaces**: the "OPEN ONLY" prohibition in `.codex/prompts/codify.md` and
   `.gemini/commands/codify.toml`.
4. **Sanitizer**: ~97–116 refusal-operand call sites across the two adapters and
   `vcs-provider.js`.

`upflow-self-repo.js` — the derivation module the fence depends on — ships **byte-identical
with zero production callers**. The guard is intact and wired to nothing, so a reader greps,
finds it, and concludes the fence is live.

**Evidence (executed, both polarities, on a common instrument).** The fixture
`.claude/audit-fixtures/upflow-open-never-complete/run.mjs` is byte-identical in both refs:

| tree   | fixture result                                                                 |
| ------ | ------------------------------------------------------------------------------ |
| OURS   | **55/55 PASS**                                                                 |
| THEIRS | **42/55 FAILED** — `expected ok=false fired=false / actual ok=true fired=true` |

`fired=true` means the merge transport actually executed. Falsifying result had this been
wrong: THEIRS printing 55/55, as OURS does.

**Merge effect, verified by the orchestrator** (this is the load-bearing check — the lanes
compared two trees; only this establishes what merging does):

```
merged tree d7c5891 : vcs-github-adapter.js  GITHUB_HOSTS = 0
main (control)      : vcs-github-adapter.js  GITHUB_HOSTS = 5
```

Control fires (5 on main), so the 0 is a true negative. **Main never touched those files, so
the three-way merge does not rescue them.** The subtractions land.

## Second decisive fact: CI cannot catch any of this

`grep -rn 'audit-fixtures|node --test|test-server' .github/` returns only an allowlist text
file and one code comment. Control: `grep -rln 'runs-on' .github/workflows/` → **6** files,
so the tree is readable and the matcher works.

**No workflow invokes any fixture suite.** Every failing fixture above would stay green in
CI. That is why the disposition cannot be "let CI decide".

## Also confirmed, merged-tree verified

**`.gitignore` reverts `/workspaces/*`.** Main carries an explicit
`# workspaces/ IS tracked (owner directive 2026-08-07)` with only `.env` exclusions; the
merged tree replaces it with a blanket `/workspaces/*` + `!/workspaces/_template/`.

Behavioural test against the MERGED `.gitignore` in a scratch repo:

| path                                     | verdict under merged rules      |
| ---------------------------------------- | ------------------------------- |
| `workspaces/<ws>/04-validate/sweep-x.md` | **IGNORED**                     |
| `workspaces/<ws>/journal/0031-x.md`      | **IGNORED**                     |
| `workspaces/_template/keep.md`           | tracked                         |
| `README.md` (control)                    | tracked — matcher discriminates |

Consequence: every sweep report and journal entry — **including this file** — becomes
invisible to `git add`. Work would look committed and would not be. This reverses a dated
owner directive.

**Other confirmed items** (single-lane, not orchestrator-re-verified — treat accordingly):
prototype-chain guard removed from `vcs-provider.js` (`resolveProvider("constructor")` →
`ok:true`); `emit.mjs` loses its `.example.md` carve-out so the emit wall moves v16 → v14;
10 dependency rollbacks in `.codex-mcp-guard/package-lock.json` with `package.json`
unchanged (`npm audit` total 2 → 6); `posture-gate.js` L3 shell-grouping bypass;
`gh run *` reclassified WRITE → READ, lowering the cross-repo ceremony.

---

## Claims the lanes reported that the orchestrator REFUTED

Recorded because a wrong finding costs the next session more than a missing one.

1. **"The PR deletes 7 operator-authored `workspaces/` files, 4 of them origin journals."**
   **REFUTED.** The PR removes exactly 7 files and **none** is under `workspaces/`:
   `cli-orchestrator.md`, `emit-dev-container.mjs`, `repin-targets.local.example.json`,
   `coc-drift-warn.js`, `coc-telemetry-autocommit.js`, `o1-citation-check.js`,
   `.coc/agents/CLI-ORCHESTRATOR.md`. The correct count was attached to the wrong tree.

2. **"The 2026-08-13 `agents.md` DELIVERED clause is clobbered inside its own grace window"**
   and **"the `agent-result-delivery.md` skill is deleted."** **REFUTED as merge outcomes.**
   In the merged tree the clause count is **2** and the skill **SURVIVES**. Both lanes read
   the two trees in isolation and inferred a merge effect that does not occur: `agents.md`
   is a conflict file and the skill was added on main _after_ the merge-base, so it appears
   nowhere in the PR's file list. The fence control in the same check returned 0 vs 5, so
   the instrument was discriminating — these are true negatives, not a dead matcher.

3. **"The `**/journal/.pending/` ignore is deleted."** **REFUTED** — present at line 111 of
   the merged `.gitignore`.

**The generalisable lesson:** three of the four lanes reasoned about merge effect from a
two-tree diff. That is not the same question. `git merge-tree` is the only instrument that
answers it, and it changed the verdict on three findings.

---

## Disposition

**#150 stays HELD**, now on far stronger evidence than the five prior subtractions.

**Not a blanket rejection** — the sync also carries genuine hardening (recursive credential
redaction in `ecosystem-config.mjs`, fail-closed epoch/expiry gates in
`mesh-observability-console.mjs`, a stricter `validate-prod-deploy.js` `PROD_PATTERNS`
superset, an all-detectors/most-restrictive rewrite of `detect-violations.js`). Rejecting
wholesale would discard those.

**The items to fence** are the four-layer MUST-4 cluster, the sanitizer call sites, the
prototype-chain guard, and the `.gitignore` workspaces revert. Because
`upflow-self-repo.js` survives byte-intact, repairing the fence is **re-wiring existing
code, not rewriting it**.

---

## Reachability trace — this REORDERS the risk

A follow-on lane traced who can actually reach the deleted controls. It changes the ranking,
and two of its results cut AGAINST the earlier lanes.

**Controls (1) and (2) — the `completeUpflowPR` fences and the prototype-chain guard —
are UNREACHABLE-HERE (~90%).** `completeUpflowPR` has **zero production callers**: every hit
is a definition, comment, export, or fixture. `vcs-provider.js` has **zero production
requires** — all five references on main are comments. Decisively: **the same zero holds on
OURS**, so #150 does not _change_ their reachability. Four matchers were validated against
known-positives before any zero was trusted.

That bounds the CRITICAL. The fence deletion is real and lands, but it disarms a fence
nothing currently calls.

**The attacker-input claim for (2) is HALF REFUTED.** `getProviderForRoster` /
`getProviderForRecordContent` genuinely do read `roster.genesis.provider` and
`content.provider` unfiltered — confirmed in code. But **nothing calls either wrapper**. The
"attacker-authorable" claim traces back to a source COMMENT describing _intended_ wiring,
which a prior lane repeated as if it described live code.

**Control (4), `posture-gate.js`, is a STRENGTHENING — the earlier framing was inverted.**
383 → 632 lines; severity goes **halt-and-report → `block`**; and the fence is hoisted ABOVE
the posture branches so it applies at L3 **and below** — previously the two STRICTER postures
carried the WEAKER fence. The shell-grouping regression remains unmeasured inference.

### Control (3) is REACHABLE — and it is now the live risk

The lane flagged this as its decisive open question. Answered here:

`vcs-azure-adapter.js` sanitizer call sites: **OURS 62** (`reasonText` 29, `reasonOperand` 23,
`reasonFromError` 10) → **THEIRS 0**. Scoped to the seven ceremony-invoked methods, five carry
sanitized refusal operands in OURS and none in THEIRS:

```
OURS   fetchRepoOwner: `ADO git/repositories/${reasonText(repo)} → status
       ${reasonOperand(r && r.status)} body ${reasonOperand(r && r.body)}`
THEIRS fetchRepoOwner: `ADO git/repositories/${repo} → status
       ${r && r.status} body ${JSON.stringify(r && r.body)}`
```

Control: the two pure predicates (`validatePrincipal`, `principalsEqual`, 4 lines each)
return 0 in BOTH refs — the matcher discriminates rather than flagging everything.

**These five are production-reachable**, called by the three operator ceremonies:

| ceremony                   | reaches                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| `genesis-ceremony.js`      | `fetchCommitVerification` `fetchOrgAdmin` `fetchRepoOwner` `validateRepoRef` |
| `owner-add-ceremony.js`    | `listCollaborators` `validateRepoRef`                                        |
| `owner-depart-ceremony.js` | `listCollaborators` `validateRepoRef`                                        |

`r.body` is a remote HTTP response body. `JSON.stringify` escapes only `"`, `\` and sub-0x20,
leaving 0x7f, the C1 range (incl. U+009B CSI), U+2028/9 and bidi controls verbatim — into a
string that is logged and that Step-7c may embed in a PR body a downstream agent reads.

**Revised ranking: the sanitizer removal (3) outranks the fence deletion (1)** on reachability,
even though (1) is the larger structural loss. Fix both; sequence (3) first.

**An instrument failure worth recording.** The first attempt at this measurement reported a
uniform "4" for five different functions — the whole-file count leaking through an awk that
never scoped to the function body. Identical counts across distinct functions is the tell.
Re-instrumented with a declaration-line index and verified against the two pure predicates.

---

## Orphaned-clause sweep — the class is BOUNDED

The prose lane recommended an instrument no keyword sweep can replace: for every fixture
directory, does the rule clause its README cites still exist? Run tree-wide:

**Exactly ONE true subtraction: `upflow-open-never-complete` → "Open, Never Complete".**

That is the already-confirmed MUST-4. **There is no second hidden MUST deletion of that
shape.** A first cut reported 30 apparent orphans; 29 were loose README prose absent from
BOTH refs, so they were never subtractions. The discriminator that matters is
present-in-OURS-AND-absent-in-THEIRS, not absent-in-THEIRS alone.

Two instrument failures on the way, both recorded: the first extractor's leading regex
alternative consumed the `MUST-N` token so the alternative that captures the clause NAME
could never fire (it returned a clean-looking empty result); and `MUST-4` alone appears 210
times across the rules corpus, so the number is not a discriminator — the clause NAME is.

Corpus sizes, worth noting against the "sync deletes things" framing: OURS rules **16,453**
lines, THEIRS **17,294**. The rules corpus is net LARGER.

## Further prose-lane findings

- **MEDIUM-HIGH — the #64 anti-recurrence lock is deleted.** `sync-preflight-local-mods`
  loses its T9 PARITY test, which mechanically asserted the tool's preserved set equals the
  command's documented list. #64 _was_ a contract stated in two places that drifted; the
  replacement is an instruction in prose, not an assertion. The tool's own comment still
  claims the property ("Mirrors the preserved set in `commands/sync-from-template.md`") with
  nothing testing it. No behavioural regression — the lock against a FUTURE divergence is
  what is gone. This is a `derived-not-restated` instance, the class this repo just filed.
- **MEDIUM — `signing-mutation-guard`'s README loses its mutation-discrimination receipt**
  (the M1–M5 matrix, the "M1 and M2 together are the asymmetry lock" statement) and its
  runner invocation. `run.mjs` is byte-identical, so no coverage is lost — but the evidence
  that makes its greens _readable_ is, and the runner is now undiscoverable from its README.
- **LOW — `cli-orchestrator.md` deleted with two dangling pointers left behind** in
  `codex-architect.md:180` and `gemini-architect.md:152`. The deletion is deliberate and
  documented in `.coc-obsoleted`; the un-repointed references are the defect.

## The `rb` lane retirement is almost certainly F13 landing

`sync-manifest.yaml::repos` goes `py rs rb base prism` → `py rs base prism`, and
`emit-axes.mjs::EMIT_LANGS` drops `rb` in the same change — internally consistent, so this
is deliberate, not an accidental subtraction.

**This looks like forest item F13** ("kailash-rs template fleet collapse, rs+rb → one
all-bindings template", LOOM-SCOPED as loom#423, Phase 1 already landed). Retiring the rb
lane is what that collapse means. Flagged for owner confirmation rather than assumed: if it
IS F13, the ledger row should advance; if it is not, it orphans any `kailash-coc-claude-rb`
consumer with no notice.

## A strengthening that matters more than most

**A disclosure-scrub gate that could never fire is repaired.** `scan-synced-disclosure.mjs`
without `--check` runs in report mode and ends `process.exit(0)` _regardless of findings_ —
so the shipped idiom `scan-synced-disclosure.mjs --root "$SISTER" || { echo "HALT"; exit 1; }`
**could never halt**. THEIRS adds `--check` at four call sites, and only that branch reaches
`process.exit(1)`.

This is the sharpest argument against blanket-rejecting the sync: it repairs a live,
silently-dead security gate on the disclosure lane.

---

## Added-files lane — weakening by ADDITION

### NEW CRITICAL — `bin/probe-ancestor-load.mjs --clean <dir>` deletes the operator's directory

A **net-new** file (absent on main). `clean()` resolves `root` to the operator-supplied
argument, checks that `root/outer-repo/.claude/rules/probe-scoped.md` exists — a sentinel
**`--build` itself planted** — and then:

```js
fs.rmSync(root, { recursive: true, force: true }); // root, not the scaffold it created
```

So `--build <existing-dir>` followed by `--clean <existing-dir>` removes the whole directory
including pre-existing content. The lane demonstrated end-to-end loss of an untracked file.
No `os.tmpdir()` containment on the `<dir>` path, no `--dry-run`, no preview; documented to
operators verbatim at `skills/30-claude-code-patterns/worktree-orchestration.md:752` with no
scope warning.

**Scoping the severity honestly** (the lane did not note this): bare `--build` with NO
argument uses `mkdtempSync(os.tmpdir(), …)` and is safe. The hazard requires the operator to
pass an existing directory. It remains a new destructive surface with a guard that cannot
distinguish "scaffold I created" from "your directory I planted a sentinel in", and untracked
files have no reflog — the irrecoverable class `git.md` § Destructive Working-Tree Ops fences,
which does not fence `rm -rf`.

### A SECOND tautological fixture — mutation-proven

`audit-fixtures/session-notes-continuity/run.mjs`'s two ceiling-boundary cases derive their
inputs from the constant under test (`lineCount: NOTES_CEILING_LINES`). Mutating the ceiling
300 → 100000 leaves the suite **26/26 green, exit 0** — and the case NAME rendered `100000`,
so the mutation demonstrably reached the module (MUST-2(b) satisfied: one live hypothesis,
not two). The pair discriminates the comparison OPERATOR only (`>` → `>=` reds it).
`NOTES_TARGET_LINES` is asserted by nothing. This is distinct from the
`sync-preflight-local-mods` T2 tautology already found — the class has two members.

### The added rules cite detection bindings that do not exist here

All five added rules name probe files, registries, and integrity scripts under
`.claude/test-harness/` — a directory with **zero files** on the ref. Two assert enforcement
that cannot occur: `ci-cost-discipline.md` says its deferrals are "hard-failed past their
dates by `phase2-deferral-integrity.mjs`" (absent), and `session-notes-continuity.md` says
its detection is "structural, SHIPPED — nothing in this block is pending" and registered so
fixtures "RUN in CI rather than sit unwired" (no CI job references `audit-fixtures` at all).

That is precisely the shape the same PR's own new `verification-gate-integrity.md` MUST-1
forbids: _a gate that cannot fire is indistinguishable from a gate that fired and found
nothing._ The rules are self-inconsistent as a set.

Related, MEDIUM: a new `probe_authorship_deferrals` exemption channel arrives with no
enforcement present; `phase2-deferral-expiry/run.mjs` cannot execute here
(`ERR_MODULE_NOT_FOUND` on its subject); and in two added rules the deferral sentence was
spliced INTO THE MIDDLE of the sentence describing the only ACTIVE detection mechanism,
corrupting the gate-review procedure that is their sole live coverage. That splice also
appears in `wave-loop.md`, `agents.md`, and `enrollment-operations.md` — systematic.

## Correction to this document's own deletion census

An earlier section of this record stated the PR removes **exactly 7 files**. That is wrong,
and the method was wrong: GitHub's rename detection had paired a real deletion with an
addition, hiding it in the "renamed" bucket.

Re-derived with `git diff --no-renames --diff-filter=D 4522498 refs/adjudicate/sync-150`
(control: the same command with `--diff-filter=A` returns 152, so the filter works):
**8 deletions.** The eighth is `.claude/guides/model-optimization/02-ecosystem-inventory.md`,
a ZERO-BYTE file (git's empty blob), so no content is lost.

**The substantive claim survives the correction:** still **no deletion under `workspaces/`
or `journal/`**, so the refutation of the "7 operator-authored workspaces files deleted"
claim stands — now on a sound enumeration rather than a rename-blind one.

Lesson for the next pass: `gh pr ... files --status=removed` is rename-blind. Use
`git diff --no-renames --diff-filter=D` against the merge-base.

## What this pass did NOT cover

The ~350 changed `.md` files outside `rules/`/`commands/`/derived trees (token-swept, not
read); the 151 ADDED files (not audited for weaken-by-addition — one tautological fixture
was already found incidentally); reachability of the deleted fences from live callers; the
966-line `.proposals/latest.yaml` delta; byte/encoding-level inspection anywhere. Three of
these are in flight as a follow-on wave.
