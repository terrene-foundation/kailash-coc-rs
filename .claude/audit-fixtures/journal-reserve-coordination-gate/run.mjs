#!/usr/bin/env node
/**
 * journal-reserve-coordination-gate — the regression lock for issue #76 AND for
 * the failure its own fix re-opened one path over.
 *
 * WHAT IS UNDER TEST. `journal-reserve.js::reserveJournalSlotSigned` gates
 * `requireSigningIdentity` on
 *
 *     isCoordinationEnabled(resolveMainCheckout(repoDir) || repoDir)
 *
 * and BOTH halves of that expression are load-bearing:
 *
 *   - WITHOUT the gate at all (`requireSigningIdentity` hard-true): a
 *     coordination-OFF repo cannot satisfy /codify's mandatory journal receipt,
 *     because the sibling `codify-lease.js` degrades cleanly while this one
 *     hard-fails on a null person_id. That is issue #76.
 *   - WITHOUT `resolveMainCheckout` (reading the predicate against the worktree
 *     cwd): the tier-2 local override `.claude/learning/coordination-mode.json`
 *     is GITIGNORED and therefore ABSENT inside a worktree, so a tier-2-enrolled
 *     repo resolves OFF here while `journal-write-guard.js` reads it ON from
 *     main — no record reserved, then the Write halts for "slot unreserved".
 *     That is issue #76's own failure class, re-opened on the worktree path by
 *     the fix for #76. It was caught by a Tier-1 redteam and shipped with NO
 *     fixture; this file is that fixture.
 *
 * HOW IT DISCRIMINATES. Each case drives a REAL git repository (and, for the
 * worktree cases, a REAL `git worktree`) through the REAL module — no stubbed
 * resolver, no injected coordination verdict. The identity is injected because
 * `opts.identity` is a documented injection point, and it is the LEVER: an
 * identity carrying `display_id` but NO signing fields is accepted when the gate
 * resolves OFF and REFUSED when it resolves ON. So the same input yields
 * opposite results either side of the predicate, which is what makes a green
 * here evidence rather than decoration (`instrument-discipline.md` MUST-1).
 *
 * WHY THE CASES ASSERT `step`, NOT JUST `ok`. The first cut of this file
 * asserted only `r.ok === false` on the two coordination-ON cases, and it was
 * VACUOUS — measured, not suspected. Under the hard-`false` mutation the call
 * still returns `ok:false`, because the unsigned identity is caught further
 * downstream at the emitter (`step: "emit:identity"`) instead of at the gate
 * (`step: "reserve"`). Both are `ok:false`, so the assertion could not tell
 * "the gate fired" from "something else fired later" — a result consistent with
 * both branches of the hypothesis, i.e. no evidence at all
 * (`instrument-discipline.md` MUST-1). Pinning `step === "reserve"` is what
 * makes these cases discriminate. Left recorded because this fixture exists to
 * lock a gate, and a gate-lock that any downstream refusal satisfies is the
 * failure mode it was written to prevent, one layer up.
 *
 * Each case names the mutation that reds it (`instrument-discipline.md`
 * MUST-2(b)); the mutations are recorded as measured in README.md.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// The modules under test are CommonJS; this file is ESM (`.mjs`, matching the
// sibling upflow suite). `createRequire` is what lets the fixture drive the REAL
// CJS module rather than a re-implementation of it.
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const LIB = path.join(REPO_ROOT, ".claude", "hooks", "lib");
const JOURNAL_RESERVE = path.join(LIB, "journal-reserve.js");

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.invalid",
      GIT_COMMITTER_NAME: "Fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.invalid",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
  });
}

/**
 * Build a real repo, optionally coordination-ON via the tier-2 local override,
 * and optionally add a real worktree. Returns the path the caller should treat
 * as `repoDir`.
 */
function makeRepo({ coordinationOn, withWorktree }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jrcg-"));
  const main = path.join(root, "main");
  fs.mkdirSync(main, { recursive: true });
  git(main, ["init", "-q", "-b", "main"]);
  fs.mkdirSync(path.join(main, "journal"), { recursive: true });
  fs.writeFileSync(path.join(main, "journal", ".keep"), "");
  fs.writeFileSync(path.join(main, "README.md"), "fixture\n");
  git(main, ["add", "-A"]);
  git(main, ["commit", "-q", "-m", "init"]);

  if (coordinationOn) {
    // Tier 2, the GITIGNORED local override — deliberately written ONLY at main
    // and never committed, which is exactly why a worktree-cwd read misses it.
    const learning = path.join(main, ".claude", "learning");
    fs.mkdirSync(learning, { recursive: true });
    fs.writeFileSync(
      path.join(learning, "coordination-mode.json"),
      JSON.stringify({ enabled: true }, null, 2),
    );
  }

  if (!withWorktree) return { root, repoDir: main };

  const wt = path.join(root, "wt");
  git(main, ["worktree", "add", "-q", "-b", "wtbranch", wt]);
  fs.mkdirSync(path.join(wt, "journal"), { recursive: true });
  return { root, repoDir: wt };
}

// An identity with a display_id but NO signing fields. This is the lever: it
// passes when the gate resolves OFF and is refused when it resolves ON.
const UNSIGNED_IDENTITY = { display_id: "fixture-op" };

function reserve(repoDir) {
  delete require.cache[require.resolve(JOURNAL_RESERVE)];
  const { reserveJournalSlotSigned } = require(JOURNAL_RESERVE);
  return reserveJournalSlotSigned(repoDir, {
    dir: "journal",
    type: "DECISION",
    topic: "fixture-topic",
    identity: UNSIGNED_IDENTITY,
    // Emission is stubbed: this fixture is about the GATE, not the transport.
    readChainHead: () => ({ ok: true, prev_hash: null, seq: 0 }),
    append: () => ({ ok: true }),
  });
}

const cases = [
  {
    // COORDINATION ON, read from MAIN. The unsigned identity must be REFUSED.
    // This is the case that reds if `requireSigningIdentity` is hard-wired to
    // `false`, or if the gate is dropped entirely.
    name: "coordination-on/main/unsigned-identity-refused",
    mutation:
      "journal-reserve.js — pass `requireSigningIdentity: false` (or drop the option) in the reserveJournalSlot call",
    setup: { coordinationOn: true, withWorktree: false },
    expect: (r) => r.ok === false && r.step === "reserve",
    describe:
      'ok === false AND step === "reserve" (the GATE refused, not a downstream step)',
  },
  {
    // THE REGRESSION LOCK, and the reason this file exists. cwd is a WORKTREE of
    // a coordination-ON main. The tier-2 override is gitignored and absent here,
    // so a predicate read against the worktree resolves OFF and would ACCEPT the
    // unsigned identity. Reading it against the resolved MAIN checkout resolves
    // ON and REFUSES. Reds the moment `resolveMainCheckout(repoDir) || repoDir`
    // is simplified back to `repoDir`.
    name: "coordination-on/worktree/resolves-main-not-worktree",
    mutation:
      "journal-reserve.js — replace `isCoordinationEnabled(resolveMainCheckout(repoDir) || repoDir)` with `isCoordinationEnabled(repoDir)`",
    setup: { coordinationOn: true, withWorktree: true },
    expect: (r) => r.ok === false && r.step === "reserve",
    describe:
      'ok === false AND step === "reserve" (ON verdict from main, refused AT the gate)',
  },
  {
    // THE OTHER POLARITY, and it is not optional: a refusal-only suite cannot
    // detect over-tightening. Coordination OFF must still ACCEPT the unsigned
    // identity, which is issue #76 itself — /codify's mandatory journal receipt
    // has to remain satisfiable on a coordination-off consumer. Reds if the gate
    // is hard-wired to `true`.
    name: "coordination-off/main/unsigned-identity-accepted",
    mutation:
      "journal-reserve.js — hard-wire `requireSigningIdentity: true` (reverting the #76 fix)",
    setup: { coordinationOn: false, withWorktree: false },
    expect: (r) => r.ok === true,
    describe: "ok === true (issue #76: coordination-off must stay satisfiable)",
  },
];

let failed = 0;
for (const c of cases) {
  let made = null;
  try {
    made = makeRepo(c.setup);
    const r = reserve(made.repoDir);
    if (c.expect(r)) {
      console.log(`  ✓ ${c.name}`);
    } else {
      failed += 1;
      console.log(`  ✗ ${c.name}`);
      console.log(`      expected: ${c.describe}`);
      console.log(`      actual  : ${JSON.stringify(r).slice(0, 300)}`);
    }
  } catch (err) {
    failed += 1;
    console.log(`  ✗ ${c.name} — threw: ${err && err.message}`);
  } finally {
    if (made) fs.rmSync(made.root, { recursive: true, force: true });
  }
}

const total = cases.length;
if (failed) {
  console.log(`\njournal-reserve-coordination-gate: ${failed}/${total} FAILED`);
  process.exit(1);
}
console.log(`\njournal-reserve-coordination-gate: ${total}/${total} PASS`);
