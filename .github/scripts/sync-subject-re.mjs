#!/usr/bin/env node
/**
 * Print the sync-commit-subject pattern, sourced from the SHIPPED tool rather
 * than restated here.
 *
 * WHY NOT A COPY. `.claude/bin/sync-preflight-local-mods.mjs` owns this pattern
 * and its header records why: a plausible first cut (`chore(sync)` /
 * `chore(coc-sync)` / `sync:`) was measured against real history and
 * MISCLASSIFIED 59 of 82 differing artifacts as consumer-authored, because real
 * syncs also land as `chore(coc):`, `sync(loom):`, `sync(coc):`,
 * `release(coc-template):` and a one-off `feat: … first-sync from loom`.
 * Re-derived against observed history the count fell to 10, all genuine local
 * edits. A second hand-maintained copy of that pattern would drift back toward
 * the 59-false-positive cut on the first convention change — and an alert-
 * fatiguing gate is a gate that gets ignored.
 *
 * So this reads the constant out of the tool's source. There is exactly one
 * pattern in the repo, and it lives where its derivation is documented.
 *
 * FAIL DIRECTION. If the tool is missing, or the constant is no longer a plain
 * double-quoted literal this can parse, we exit NON-ZERO and print nothing
 * usable. The caller must treat that as "the check did not run" — never as
 * "nothing at risk" (`rules/evidence-first-claims.md` MUST-3). The operator
 * escape hatch is the COC_SYNC_SUBJECT_RE env var, mirroring the tool's own
 * `--sync-subject-re` override, so an unusual convention is recoverable without
 * editing this gate.
 *
 * Re-derivation command (recorded in the tool + its audit-fixtures README):
 *   git log --format=%s -- .claude/rules/ | sed -E 's/[0-9]+/N/g' | sort | uniq -c | sort -rn
 */

import fs from "fs";

const override = process.env.COC_SYNC_SUBJECT_RE;
if (override && override.trim() !== "") {
  // Validate before handing it on: an invalid regex must fail here, loudly,
  // rather than silently matching nothing downstream (which would read every
  // sync commit as local authorship and bury the real finding in noise).
  try {
    new RegExp(override);
  } catch (e) {
    process.stderr.write(`sync-subject-re: COC_SYNC_SUBJECT_RE is not a valid regex: ${e.message}\n`);
    process.exit(1);
  }
  process.stdout.write(override + "\n");
  process.exit(0);
}

const TOOL = process.argv[2] || ".claude/bin/sync-preflight-local-mods.mjs";

let src;
try {
  src = fs.readFileSync(TOOL, "utf8");
} catch {
  process.stderr.write(
    `sync-subject-re: cannot read ${TOOL} — the pattern's source of truth is absent.\n` +
      `sync-subject-re: set COC_SYNC_SUBJECT_RE to supply it explicitly.\n`,
  );
  process.exit(1);
}

const m = src.match(/const\s+DEFAULT_SYNC_SUBJECT_RE\s*=\s*("(?:[^"\\]|\\.)*")\s*;/);
if (!m) {
  process.stderr.write(
    `sync-subject-re: DEFAULT_SYNC_SUBJECT_RE not found in ${TOOL} as a single\n` +
      `sync-subject-re: double-quoted literal. It may have been refactored.\n` +
      `sync-subject-re: set COC_SYNC_SUBJECT_RE to supply the pattern explicitly.\n`,
  );
  process.exit(1);
}

let pattern;
try {
  // Every escape in the literal is a JS string escape that JSON also accepts
  // (`\\(`, `\\)`), so JSON.parse decodes it without eval.
  pattern = JSON.parse(m[1]);
  new RegExp(pattern);
} catch (e) {
  process.stderr.write(`sync-subject-re: extracted literal is unusable: ${e.message}\n`);
  process.exit(1);
}

process.stdout.write(pattern + "\n");
