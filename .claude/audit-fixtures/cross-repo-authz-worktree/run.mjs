#!/usr/bin/env node
/*
 * Audit fixture runner — a cross-repo authorization receipt MUST be visible to
 * the guard from EVERY worktree of the repo, not only the one it was written in.
 *
 * WHY THIS EXISTS (issue #174). `hasCrossRepoAuthorizationReceipt` rooted its
 * whole search at `repoRoot(cwd)` — a single worktree's toplevel. The session
 * cwd and the cwd a guarded command runs in are routinely DIFFERENT worktrees
 * of one repo; that is the normal shape of parallel lane work. So an operator
 * could run the sanctioned `/cross-repo-authorize` affordance, get a valid
 * receipt, and still be halted by the guard that demanded it. The natural next
 * move is to override the halt — the one outcome the ceremony exists to prevent.
 *
 * The reporter measured it at 71 worktrees sharing one `.git`. Reproduced here
 * on a scratch repo before the fix: receipt in worktree A, guard called from
 * worktree B returned FALSE with the receipt sitting on disk.
 *
 * WHY A RUNNER AND NOT A .txt FIXTURE. Every other violation-patterns fixture
 * is an input STRING. This check's input is a filesystem TOPOLOGY — two
 * worktrees sharing a common-dir — which no text fixture can express. Same
 * reasoning as the append-sink-boundary-roots runner.
 *
 * Self-contained: builds its own scratch repo under os.tmpdir(), never touches
 * the host repo's worktree forest, and removes it on the way out.
 *
 * Exit 0 = all fixtures pass. Exit 1 = >=1 failed.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { hasCrossRepoAuthorizationReceipt } = require(
  path.resolve(HERE, "..", "..", "hooks", "lib", "violation-patterns.js"),
);

let passed = 0;
let failed = 0;
const check = (name, ok, detail) => {
  if (ok) {
    passed++;
    process.stdout.write(`  PASS  ${name}\n`);
  } else {
    failed++;
    process.stderr.write(`  FAIL  ${name}\n`);
    if (detail) process.stderr.write(`        ${detail}\n`);
  }
};

const git = (args, cwd) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const SLUG = "acme-org/widget-service";

/** Write a receipt whose content-timestamp is `hoursAgo` hours in the past. */
function writeReceipt(root, hoursAgo, mode = "read") {
  const dir = path.join(root, ".claude", "cross-repo-authz");
  mkdirSync(dir, { recursive: true });
  const ts = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  writeFileSync(
    path.join(dir, "fixture-receipt.md"),
    `# Cross-repo authorization receipt\n\ntimestamp: ${ts}\n\ncross-repo-authorized: ${SLUG} ${mode}\n`,
  );
}

const tmp = mkdtempSync(path.join(os.tmpdir(), "authz-wt-"));
try {
  // ---- scratch repo with two sibling worktrees -----------------------------
  const main = path.join(tmp, "repo");
  mkdirSync(main);
  git(["init", "-q", "-b", "main"], main);
  git(["config", "user.email", "fixture@example.invalid"], main);
  git(["config", "user.name", "fixture"], main);
  writeFileSync(path.join(main, "README.md"), "fixture\n");
  git(["add", "-A"], main);
  git(["commit", "-qm", "init"], main);
  const A = path.join(tmp, "wt-a");
  const B = path.join(tmp, "wt-b");
  git(["worktree", "add", "--detach", "-q", A, "HEAD"], main);
  git(["worktree", "add", "--detach", "-q", B, "HEAD"], main);

  // The topology must be real, or every assertion below is vacuous.
  const forest = git(["worktree", "list", "--porcelain"], B);
  const treeCount = (forest.match(/^worktree /gm) || []).length;
  check(
    "topology-is-non-degenerate",
    treeCount === 3,
    `expected 3 worktrees (main + A + B), porcelain reported ${treeCount}`,
  );

  // ---- negative control, FIRST: with NO receipt anywhere, the answer is false.
  // Without this a later `true` would be a statement about the function's
  // eagerness, not about the receipt.
  check(
    "negative-control-no-receipt-anywhere-is-false",
    hasCrossRepoAuthorizationReceipt(SLUG, B, "read") === false,
    "the guard cleared a cross-repo action with no receipt on disk — it cannot discriminate",
  );

  // ---- the fix: a receipt in A is authoritative from A, B and main ---------
  writeReceipt(A, 0);
  check(
    "receipt-visible-in-its-own-worktree",
    hasCrossRepoAuthorizationReceipt(SLUG, A, "read") === true,
    "positive control failed: the receipt is not even found where it was written",
  );
  check(
    "receipt-visible-from-SIBLING-worktree",
    hasCrossRepoAuthorizationReceipt(SLUG, B, "read") === true,
    "#174: a valid receipt in a sibling worktree is invisible — the ceremony halts an operator who followed it",
  );
  check(
    "receipt-visible-from-MAIN-checkout",
    hasCrossRepoAuthorizationReceipt(SLUG, main, "read") === true,
    "#174: a valid receipt in a linked worktree is invisible from the main checkout",
  );

  // ---- widening the SEARCH must not widen anything else --------------------
  check(
    "read-receipt-does-NOT-clear-a-write-action",
    hasCrossRepoAuthorizationReceipt(SLUG, B, "write") === false,
    "tier collapse: a cheap read receipt cleared a write action across worktrees",
  );
  check(
    "prefix-slug-cannot-collide",
    hasCrossRepoAuthorizationReceipt("acme-org/widget", B, "read") === false,
    "a receipt for acme-org/widget-service cleared acme-org/widget",
  );
  check(
    "unrelated-slug-is-false",
    hasCrossRepoAuthorizationReceipt("other/repo", B, "read") === false,
    "a receipt for one target cleared a different target",
  );

  writeReceipt(A, 7); // window is 6h
  check(
    "EXPIRED-receipt-in-sibling-is-still-false",
    hasCrossRepoAuthorizationReceipt(SLUG, B, "read") === false,
    "the search widened the AGE WINDOW, not just the search — an expired receipt cleared the gate",
  );

  writeReceipt(A, -3); // future-dated by 3h; skew allowance is 5min
  check(
    "FUTURE-dated-receipt-in-sibling-is-still-false",
    hasCrossRepoAuthorizationReceipt(SLUG, B, "read") === false,
    "a future-dated receipt in a sibling authorizes indefinitely",
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
