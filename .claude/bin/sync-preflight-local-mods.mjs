#!/usr/bin/env node
/**
 * sync-preflight-local-mods — enumerate shared artifacts a `/sync-from-template`
 * is about to REPLACE, and separate the ones that carry consumer-authored edits
 * from the ones that are merely stale.
 *
 * WHY THIS EXISTS (issue #64). `/sync-from-template` § Merge Semantics opens
 * "This is a **merge**, not an overwrite" and then specifies, four lines later,
 * "If a file exists in BOTH the template and this repo, the template version
 * wins". The second sentence IS an overwrite. There is no per-file merge, no
 * three-way merge and no conflict surface anywhere in the command — preservation
 * is by PATH CATEGORY only (`agents/project/**`, `skills/project/**`,
 * `learning/**`, `.proposals/**`, `settings.local.json`, `workspaces/**`, root
 * `CLAUDE.md`). Every shared artifact outside those categories is replaced.
 *
 * That is survivable ONLY if the consumer never edits a shared artifact. But the
 * same command instructs downstream consumers to `/codify` locally, and there is
 * no `rules/project/` or `commands/project/` namespace — so a consumer who
 * codifies a rule has nowhere sanctioned to put it, and the edit is destroyed on
 * the next sync with no conflict, no warning and no record.
 *
 * This tool does NOT change the merge semantics. It makes the loss VISIBLE
 * BEFORE it happens, which is the difference between a decision and an accident.
 * It answers exactly one question per shared artifact: *if the sync ran now,
 * would it discard work someone here authored?*
 *
 * The distinction it draws is deliberate and is the whole point:
 *   - DIFFERS + only sync-shaped commits  -> STALE. The template moved ahead;
 *     replacing it is the sync working correctly. Not reported as at-risk.
 *   - DIFFERS + >=1 consumer-authored commit -> AT RISK. Local institutional
 *     knowledge is about to be silently discarded.
 * Without that split the report is noise: on a healthy consumer nearly every
 * shared artifact differs from the template, so "differs" alone flags everything
 * and gets ignored — the alert-fatigue failure that makes a gate worthless.
 *
 * Authorship is judged by COMMIT SUBJECT, not by content: a sync lands as a
 * recognizable `chore(sync)` / `chore(coc-sync)` / `sync-from-template` commit,
 * and anything else touching a shared artifact was authored here. The pattern is
 * overridable (`--sync-subject-re`) because a consumer may land syncs under its
 * own convention; a consumer whose sync commits are NOT recognized sees its own
 * syncs counted as local authorship, which fails toward OVER-reporting (a
 * false at-risk), never toward silently missing a real loss.
 *
 * Exit codes are three-valued so this can gate a sync without conflating
 * "nothing at risk" with "the check could not run":
 *   0 = no shared artifact carries consumer-authored edits (safe to replace)
 *   2 = at least one does (a human decides before the sync runs)
 *   1 = usage / resolution error (the check did NOT run — never read as safe)
 *
 * AUDIENCE CAVEAT, found by running this against real history rather than only
 * fixtures: the intended subject is a CONSUMER (`coc-project`) that pulls from a
 * template. Run inside a TEMPLATE repo it over-reports by construction, because a
 * template's own authoring commits are genuinely local authorship of files that
 * are, from its perspective, shared artifacts. That is not a defect and is not
 * worth "fixing" with a repo-class check — but a template-side operator reading a
 * large at-risk count should know why before treating it as alarming.
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

// MUST mirror `/sync-from-template` § Merge Semantics → "Preserved" EXACTLY.
// A file under any of these is never replaced, so it is never at risk and is
// excluded from the scan.
//
// This list and the command's list are ONE contract in TWO places, which is the
// exact drift shape issue #64 reports (a headline promising "merge" while the
// rule below it specified "replace"). `test-64.mjs` § T9 parses the command's
// list out of the markdown and asserts set equality with this constant, so the
// two cannot silently diverge — reproducing #64 one layer down is the failure
// mode that test exists to prevent.
const PRESERVED_PREFIXES = [
  ".claude/agents/project/",
  ".claude/skills/project/",
  ".claude/rules/project/",
  ".claude/commands/project/",
  ".claude/learning/",
  ".claude/.proposals/",
  ".claude/team-memory/",
  ".claude/workspaces/",
  "workspaces/",
];
const PRESERVED_EXACT = new Set([".claude/settings.local.json", "CLAUDE.md"]);

// The shared-artifact surface the command lists as "Updated from template".
const SHARED_GLOB_DIRS = [
  ".claude/agents",
  ".claude/commands",
  ".claude/rules",
  ".claude/skills",
  ".claude/guides",
  ".claude/team-memory",
];

// DERIVED FROM OBSERVED HISTORY, not guessed. The first cut of this pattern
// matched only `chore(sync)` / `chore(coc-sync)` / `sync:` and, run against a
// real 25-commit window, misclassified 59 of 82 differing artifacts as
// consumer-authored — because real syncs also land as `chore(coc):`,
// `sync(loom):`, `sync(coc):` and `release(coc-template):`. That is the
// alert-fatigue failure this tool exists to avoid, so the default is pinned to
// the shapes actually present rather than to a plausible-looking guess.
// Re-derive with:
//   git log --format=%s -- .claude/rules/ | sed -E 's/[0-9]+/N/g' | sort | uniq -c | sort -rn
// Genuine local work in that same window (`fix(upflow):`, `fix(security):`,
// `feat(rules):`) is correctly NOT matched — the pattern must keep letting those
// through, which is what the fixtures pin.
// `first-sync from loom` is the bootstrap sync a consumer lands once, under a
// `feat:` subject; it is unambiguously a sync and is matched anywhere in the
// subject rather than at the start.
const DEFAULT_SYNC_SUBJECT_RE =
  "(^(chore\\((coc-)?sync\\)|chore\\(coc\\)|chore\\(sync-from-template\\)|sync\\([a-z-]+\\)|sync:|release\\(coc-template\\)|Merge pull request .* from .*sync)|first-sync from loom)";

function fail(msg) {
  process.stderr.write(`sync-preflight-local-mods: ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") {
      out.json = true;
      continue;
    }
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const nxt = argv[i + 1];
      if (nxt === undefined || nxt.startsWith("--")) out[k] = true;
      else {
        out[k] = nxt;
        i++;
      }
    }
  }
  return out;
}

function gitTop(dir) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function walk(root, rel, acc) {
  const abs = path.join(root, rel);
  let entries;
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const r = path.posix.join(rel, e.name);
    if (e.isDirectory()) walk(root, r, acc);
    else if (e.isFile()) acc.push(r);
  }
  return acc;
}

function isPreserved(rel) {
  if (PRESERVED_EXACT.has(rel)) return true;
  return PRESERVED_PREFIXES.some((p) => rel.startsWith(p));
}

// Commits touching `rel`, split into sync-shaped vs consumer-authored by SUBJECT.
function commitsFor(root, rel, syncRe) {
  let out;
  try {
    out = execFileSync("git", ["log", "--format=%H%x1f%s", "--", rel], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return { total: 0, local: 0, localSubjects: [] };
  }
  const lines = out.split("\n").filter(Boolean);
  const localSubjects = [];
  for (const line of lines) {
    const [, subject = ""] = line.split("\x1f");
    if (!syncRe.test(subject)) localSubjects.push(subject);
  }
  return { total: lines.length, local: localSubjects.length, localSubjects };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const templateArg = args.template || process.env.KAILASH_COC_TEMPLATE_PATH;
  if (!templateArg || templateArg === true)
    fail("missing --template <path-to-template-checkout> (or KAILASH_COC_TEMPLATE_PATH)");
  const template = path.resolve(String(templateArg));
  if (!fs.existsSync(path.join(template, ".claude")))
    fail(`--template ${template} does not contain a .claude/ directory`);

  const rootArg = args.root && args.root !== true ? String(args.root) : process.cwd();
  const root = gitTop(rootArg);
  if (!root) fail(`not inside a git working tree: ${rootArg}`);

  let syncRe;
  try {
    syncRe = new RegExp(
      args["sync-subject-re"] && args["sync-subject-re"] !== true
        ? String(args["sync-subject-re"])
        : DEFAULT_SYNC_SUBJECT_RE,
    );
  } catch (e) {
    fail(`--sync-subject-re is not a valid regex: ${e.message}`);
  }

  // Candidate set = files present in BOTH trees (the command's "template version
  // wins" case). Template-only files are ADDED (no loss); consumer-only files are
  // PRESERVED by the "exists ONLY in this repo" clause (no loss).
  const candidates = [];
  for (const d of SHARED_GLOB_DIRS) {
    for (const rel of walk(template, d, [])) {
      if (isPreserved(rel)) continue;
      if (fs.existsSync(path.join(root, rel))) candidates.push(rel);
    }
  }
  candidates.sort();

  const atRisk = [];
  const stale = [];
  for (const rel of candidates) {
    let same;
    try {
      same = fs.readFileSync(path.join(root, rel)).equals(fs.readFileSync(path.join(template, rel)));
    } catch {
      continue;
    }
    if (same) continue; // identical → replacing it changes nothing
    const c = commitsFor(root, rel, syncRe);
    const row = { path: rel, commits_total: c.total, commits_local: c.local, local_subjects: c.localSubjects.slice(0, 3) };
    if (c.local > 0) atRisk.push(row);
    else stale.push(row);
  }

  const report = {
    template,
    root,
    shared_in_both: candidates.length,
    would_be_replaced: atRisk.length + stale.length,
    at_risk_count: atRisk.length,
    stale_count: stale.length,
    at_risk: atRisk,
    stale: stale.map((r) => r.path),
  };

  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(
      `\n/sync-from-template preflight — local-modification report\n` +
        `  template : ${template}\n` +
        `  consumer : ${root}\n\n` +
        `  shared artifacts present in BOTH trees : ${report.shared_in_both}\n` +
        `  differing (WOULD BE REPLACED)          : ${report.would_be_replaced}\n` +
        `    - stale only (template moved ahead)  : ${report.stale_count}\n` +
        `    - CARRYING LOCAL EDITS (at risk)     : ${report.at_risk_count}\n\n`,
    );
    if (atRisk.length) {
      process.stdout.write(`  These carry consumer-authored commits and WILL be discarded:\n`);
      for (const r of atRisk) {
        process.stdout.write(`    ${r.path}  (${r.commits_local} local of ${r.commits_total} commits)\n`);
        for (const s of r.local_subjects) process.stdout.write(`        · ${s}\n`);
      }
      process.stdout.write(
        `\n  Nothing has been changed. Disposition is yours: back the edits up, or\n` +
          `  re-home them under a preserved path, before running the sync.\n\n`,
      );
    } else {
      process.stdout.write(`  No shared artifact carries consumer-authored edits.\n\n`);
    }
  }

  process.exit(atRisk.length > 0 ? 2 : 0);
}

main();
