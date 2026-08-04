# cross-repo-authorize audit fixtures

Per `cc-artifacts.md` Rule 9. Behavioral fixtures for
`.claude/bin/cross-repo-authorize.mjs`, covering the receipt-collision defect
(issue #88 defect 2) and the invariants that defect exposed.

```bash
node .claude/audit-fixtures/cross-repo-authorize/run.mjs
# exit 0 = all 17 checks behaved as expected; 1 = a regression
```

Every fixture builds its own throwaway git repo in `os.tmpdir()` and removes it.
Nothing here reads or writes the real `.claude/cross-repo-authz/`. All org slugs
(`acme/one`, `other/repo`) are synthetic.

## What the reported defect actually was

The filing described the second same-day receipt as **refused**, and proposed
only to disambiguate the filename while "preserving the refusal-to-overwrite
invariant". Measured against the tree: **there was no such invariant.**
`fs.writeFileSync` carried no `wx` flag, so the second write **silently
destroyed the first receipt** — including its verbatim authorizing instruction.

Because a receipt is the ONLY distinguisher between an authorized cross-repo
action and an unauthorized one (`repo-scope-discipline.md` § User-Authorized
Exception condition 4 — "present = in-scope, absent = critical L1"), the
consequence is stronger than an ergonomics annoyance:

- **Audit-record destruction.** The authorization evidence for a real,
  human-approved action disappears with no error.
- **Tier defeat.** A cheap `--mode read` receipt for the same action
  overwrote an existing `write` receipt, after which the hook reported the
  authorized WRITE action as unauthorized. The read/write tier the tool's own
  comments call "the design's central tier" was defeated by a filename
  collision.

Both halves were therefore required: the `wx` refusal (the invariant that was
assumed to exist) **and** the filename discriminator (so distinct actions stop
colliding in the first place).

## Discrimination — do not trust these greens without it

Per `instrument-discipline.md` MUST-2(a), a green is evidence only once the run
has been shown to RED in the behavior's absence. Reproduce:

```bash
git show <sha-before-the-fix>:.claude/bin/cross-repo-authorize.mjs > /tmp/orig.mjs
TOOL=/tmp/orig.mjs node .claude/audit-fixtures/cross-repo-authorize/run.mjs
```

Measured against the pre-fix tool: **PASS 9 / FAIL 8.** The reds are T1 (two
distinct actions collapse to one receipt; action A's text and instruction gone),
T2 (identical re-run exits 0 and rewrites the record), and T3 (read and write
receipts collide).

`TOOL=<path>` is the supported override and exists for exactly this check.

## Case map

| Case | Predicate pinned                                                           |
| ---- | -------------------------------------------------------------------------- |
| T1   | two DISTINCT same-day actions → two surviving receipts (the reported bug)  |
| T2   | identical re-run → REFUSED (exit 1), original byte-identical, no clobber   |
| T3   | same action, different `--mode` → distinct receipts (tier preservation)    |
| T4   | the REAL hook consumer still resolves the renamed receipts (no regression) |
| T5   | a read receipt does NOT clear a write action (the central tier holds)      |
| T6   | marker-injection guard still rejects newline / forged marker text          |

T4 and T5 call the actual
`hooks/lib/violation-patterns.js::hasCrossRepoAuthorizationReceipt`, not a
re-implementation of it — the filename changed, so the real consumer is the
only thing that can prove nothing broke.

## Note for a future reader

The consumer enforces a **6-hour content-timestamp window**
(`CROSS_REPO_RECEIPT_WINDOW_MS`). A receipt older than that resolves `false` by
design. If you hand-check the repo's committed receipts and find them all
`false`, that is expiry, not a regression — the fixtures generate fresh receipts
precisely so the window is not what they are measuring.
