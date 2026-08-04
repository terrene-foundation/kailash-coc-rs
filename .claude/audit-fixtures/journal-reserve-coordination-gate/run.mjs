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
// Slot values a hostile or malformed record can carry. `parseInt` accepts an
// arbitrarily long digit string and `Number.isFinite` does NOT reject the
// result — 1e21 is finite — so without a shape check the high-water is
// permanently poisoned and every later reservation returns a garbage slot.
const POISON_SLOTS = ["999999999999999999999", "1e5", "0004junk", " 12"];
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

/**
 * Write a `journal-slot-reservation` record into the coordination log the
 * high-water fold reads. `COC_TEST_SKIP_SIGN=1` makes the fold count RAW
 * records, which is the same posture the module already documents for that env
 * var — so the record does not need a valid signature to be counted. That is
 * not a shortcut for the fixture: `_foldHighWater` folds with
 * `skipSignatureVerify: true` on the normal path too, which is precisely why an
 * unvalidated `content.slot` is reachable.
 */
function writeSlotRecord(repoDir, slot) {
  const { resolveLogPath } = require(path.join(LIB, "state-io.js"));
  const logPath = resolveLogPath(repoDir);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(
    logPath,
    JSON.stringify({
      type: "journal-slot-reservation",
      content: { dir: "journal", slot },
    }) + "\n",
    "utf8",
  );
}

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

// ---------------------------------------------------------------------------
// Slot-shape validation in the high-water fold
// ---------------------------------------------------------------------------

cases.push({
  // THE INSTRUMENT FOR THE SLOT SHAPE CHECK. `_foldHighWater` folds with
  // `skipSignatureVerify: true` — stated and justified in the module — so a
  // record's `content.slot` is attacker-reachable without a valid signature,
  // and `multi-operator-coordination.md` puts a write-capable team member
  // squarely inside the threat model.
  //
  // Unbounded, `slot: "999999999999999999999"` yields n = 1e21, and
  // `String(1e21).padStart(4, "0")` is "1e+21" — so the reservation, the emitted
  // record, and the FILENAME all become `1e+21-…`. The poisoning record is
  // re-folded on every later call, so the damage is PERMANENT for every operator
  // on the repo: a denial of the journal receipt `/codify` mandates, from a
  // single append.
  //
  // Each poison value targets a different way the old check failed: an
  // overflowing digit run (finite, so `Number.isFinite` passed), exponent
  // notation, a digits-then-junk prefix `parseInt` happily truncates, and a
  // leading-space form.
  // WHAT THIS CASE DOES AND DOES NOT REACH — measured, and load-bearing.
  // It FORCES `COC_TEST_SKIP_SIGN=1`, and that is not a convenience: with the
  // default fold path this case stays GREEN EVEN UNDER ITS OWN MUTATION,
  // because the synthetic records a fixture can write are rejected by the fold's
  // OTHER rules (chain continuity / emitter registration) before they ever reach
  // the slot loop. A case that cannot red is not an instrument, so the env var
  // is set deterministically here rather than left to the caller — otherwise
  // this file would ship a green that means nothing on the default path.
  //
  // The honest consequence: this instruments the shape check against records the
  // fold ADMITS, and the population that can produce such a record on the
  // default path is a ROSTERED operator emitting a properly-chained record whose
  // `content.slot` is arbitrary — `content` is not validated by the fold. That
  // is exactly `multi-operator-coordination.md`'s stated adversary (a legitimate
  // team member with write access seeking sabotage), so the guard is not
  // theatre; but constructing that record needs real signing infrastructure this
  // fixture deliberately does not stand up. Stated rather than papered over.
  name: "slot-shape/poisoned-high-water-cannot-escape-4-digits",
  mutation:
    "journal-reserve.js::_foldHighWater — drop the `/^[0-9]{1,4}$/` shape check and restore `Number.isFinite(n)` (reds ONLY with COC_TEST_SKIP_SIGN=1, which this case sets)",
  setup: { coordinationOn: false, withWorktree: false },
  poison: POISON_SLOTS,
  forceSkipSign: true,
  expect: (r) =>
    r.ok === true && /^[0-9]{4}$/.test(r.reservation && r.reservation.slot),
  describe:
    "ok === true AND the slot is still a 4-digit string (no 1e+21 filename)",
});

let failed = 0;
for (const c of cases) {
  let made = null;
  try {
    made = makeRepo(c.setup);
    if (c.poison) for (const s of c.poison) writeSlotRecord(made.repoDir, s);
    const prevSkipSign = process.env.COC_TEST_SKIP_SIGN;
    if (c.forceSkipSign) process.env.COC_TEST_SKIP_SIGN = "1";
    let r;
    try {
      r = reserve(made.repoDir);
    } finally {
      if (c.forceSkipSign) {
        if (prevSkipSign === undefined) delete process.env.COC_TEST_SKIP_SIGN;
        else process.env.COC_TEST_SKIP_SIGN = prevSkipSign;
      }
    }
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
