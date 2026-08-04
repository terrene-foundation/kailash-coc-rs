#!/usr/bin/env node
/**
 * #64 — sync-preflight-local-mods behavioral tests.
 * Builds a synthetic template + consumer pair reproducing the issue's scenario.
 * Each case names its falsifying result (instrument-discipline MUST-1).
 */
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL =
  process.env.TOOL ||
  path.resolve(HERE, "..", "..", "bin", "sync-preflight-local-mods.mjs");

let pass = 0, fail = 0;
function check(name, ok, detail, falsifier) {
  ok ? pass++ : fail++;
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}`);
  if (detail) console.log(`      ${detail}`);
  if (!ok) console.log(`      FALSIFIER: ${falsifier}`);
}

function git(cwd, ...a) {
  return execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}
function write(root, rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function commit(root, subject) {
  git(root, "add", "-A");
  execFileSync("git", ["commit", "-q", "-m", subject], { cwd: root, stdio: "ignore" });
}
function mkrepo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "s64-"));
  git(d, "init", "-q", ".");
  git(d, "config", "user.email", "t@t.t");
  git(d, "config", "user.name", "t");
  return d;
}
function run(root, template, extra = []) {
  try {
    const out = execFileSync("node", [TOOL, "--template", template, "--root", root, "--json", ...extra], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, json: JSON.parse(out) };
  } catch (e) {
    let json = null;
    try { json = JSON.parse(e.stdout); } catch { /* usage error path */ }
    return { code: e.status ?? -1, json, err: e.stderr || "" };
  }
}

// ---- Build the fixture pair --------------------------------------------------
const template = mkrepo();
write(template, ".claude/rules/security.md", "TEMPLATE v2 security\n");
write(template, ".claude/rules/testing.md", "TEMPLATE v2 testing\n");
write(template, ".claude/rules/identical.md", "same on both sides\n");
write(template, ".claude/commands/analyze.md", "TEMPLATE v2 analyze\n");
write(template, ".claude/team-memory/build-targets.md", "TEMPLATE build targets\n");
write(template, ".claude/agents/project/keepme.md", "template copy\n"); // preserved category
commit(template, "chore: template v2");

const consumer = mkrepo();
// Baseline: consumer at template v1, landed by a recognizable sync commit.
write(consumer, ".claude/rules/security.md", "TEMPLATE v1 security\n");
write(consumer, ".claude/rules/testing.md", "TEMPLATE v1 testing\n");
write(consumer, ".claude/rules/identical.md", "same on both sides\n");
write(consumer, ".claude/commands/analyze.md", "TEMPLATE v1 analyze\n");
write(consumer, ".claude/team-memory/build-targets.md", "TEMPLATE build targets\n");
write(consumer, ".claude/agents/project/keepme.md", "LOCAL project agent\n");
commit(consumer, "chore(sync): land template v1");

// Consumer authors a local edit to a SHARED rule (the #64 loss case).
write(consumer, ".claude/rules/security.md", "TEMPLATE v1 security\n+ locally codified clause\n");
commit(consumer, "feat(rules): codify our own security clause");
write(consumer, ".claude/rules/security.md", "TEMPLATE v1 security\n+ locally codified clause\n+ second\n");
commit(consumer, "fix(rules): tighten the local clause");

// Consumer edits its team-memory (per-repo signed state; NOT in the preserved list).
write(consumer, ".claude/team-memory/build-targets.md", "LOCAL build targets\n");
commit(consumer, "chore(team-memory): record our build targets");

// testing.md + analyze.md are stale-only (never touched locally after the sync).

console.log("\n=== T1: at-risk detection (consumer-authored edits to a shared rule) ===");
{
  const r = run(consumer, template);
  const paths = (r.json?.at_risk || []).map((x) => x.path);
  check("exit code 2 signals 'a human must decide'", r.code === 2, `exit=${r.code}`,
    "exit 0 = the sync would proceed and silently discard local work");
  check("security.md flagged AT RISK", paths.includes(".claude/rules/security.md"),
    `at_risk=${JSON.stringify(paths)}`, "absent = the loss case #64 reports is undetected");
  const sec = (r.json?.at_risk || []).find((x) => x.path === ".claude/rules/security.md");
  check("counts the 2 consumer-authored commits", sec?.commits_local === 2,
    `commits_local=${sec?.commits_local} of ${sec?.commits_total}`,
    "wrong count = the sync-vs-local subject split is broken");
  check("surfaces the local commit subjects", (sec?.local_subjects || []).some((s) => /codify our own/.test(s)),
    JSON.stringify(sec?.local_subjects), "no subjects = report is not actionable");
}

console.log("\n=== T2: stale-only artifacts are NOT flagged (anti alert-fatigue) ===");
{
  const r = run(consumer, template);
  const atRisk = (r.json?.at_risk || []).map((x) => x.path);
  check("testing.md differs but is STALE, not at-risk",
    r.json.stale.includes(".claude/rules/testing.md") && !atRisk.includes(".claude/rules/testing.md"),
    `stale=${JSON.stringify(r.json.stale)}`,
    "flagged at-risk = every differing file alarms and the gate gets ignored");
  check("analyze.md likewise stale-only",
    r.json.stale.includes(".claude/commands/analyze.md") && !atRisk.includes(".claude/commands/analyze.md"),
    "stale", "flagged at-risk = false positive on a clean template-ahead file");
}

console.log("\n=== T3: identical files are not reported at all ===");
{
  const r = run(consumer, template);
  const all = [...(r.json.at_risk || []).map((x) => x.path), ...r.json.stale];
  check("identical.md absent from the report", !all.includes(".claude/rules/identical.md"),
    `reported=${all.length} files`, "present = noise; replacing an identical file changes nothing");
}

console.log("\n=== T4: preserved categories are excluded (they are never replaced) ===");
{
  const r = run(consumer, template);
  const all = [...(r.json.at_risk || []).map((x) => x.path), ...r.json.stale];
  check("agents/project/** excluded despite differing",
    !all.some((p) => p.startsWith(".claude/agents/project/")),
    "excluded", "reported = false alarm on a path the sync already preserves");
}

console.log("\n=== T5: team-memory is now PRESERVED, so it is excluded (AC4 reconciled) ===");
{
  const r = run(consumer, template);
  const all = [...(r.json?.at_risk || []).map((x) => x.path), ...r.json.stale];
  check("team-memory excluded from the report",
    !all.some((p) => p.startsWith(".claude/team-memory/")),
    `reported=${JSON.stringify(all)}`,
    "reported = the tool still treats per-repo signed state as replaceable, contradicting the command");
}

console.log("\n=== T6: a clean consumer exits 0 ===");
{
  const clean = mkrepo();
  write(clean, ".claude/rules/security.md", "TEMPLATE v1 security\n");
  write(clean, ".claude/rules/testing.md", "TEMPLATE v1 testing\n");
  commit(clean, "chore(sync): land template v1");
  const r = run(clean, template);
  check("exit 0 when nothing is consumer-authored", r.code === 0,
    `exit=${r.code}, at_risk=${r.json?.at_risk_count}`,
    "exit 2 on a clean consumer = the gate cries wolf on every sync");
}

console.log("\n=== T7: --sync-subject-re override (consumer with its own sync convention) ===");
{
  const c2 = mkrepo();
  write(c2, ".claude/rules/security.md", "TEMPLATE v1 security\n");
  commit(c2, "SYNC: pulled template v1");           // non-default sync convention
  write(c2, ".claude/rules/security.md", "TEMPLATE v1 security\nlocal\n");
  commit(c2, "SYNC: pulled template v1 again");     // also a sync, under their convention
  const dflt = run(c2, template);
  const over = run(c2, template, ["--sync-subject-re", "^SYNC:"]);
  check("default pattern OVER-reports (fails safe, not silent)", dflt.code === 2,
    `exit=${dflt.code}`, "exit 0 = unrecognized sync commits would silently hide a real loss");
  check("override reclassifies them as sync commits", over.code === 0,
    `exit=${over.code}`, "exit 2 = the override does not work");
}

console.log("\n=== T8: the check FAILING to run is distinguishable from 'safe' ===");
{
  const r = run(consumer, "/nonexistent/template/path");
  check("bad --template exits 1, not 0", r.code === 1, `exit=${r.code}`,
    "exit 0 = a check that never ran reads as 'nothing at risk' — the fail-open this rule exists to block");
  check("stderr names the problem", /does not contain a \.claude/.test(r.err || ""),
    (r.err || "").trim(), "silent failure");
}

console.log("\n=== T9: PARITY — the tool's preserved set == the command's documented list ===");
{
  // The #64 failure IS a contract stated in two places that drifted. Having
  // fixed it, the same drift must not reopen between the command and this tool.
  const REPO = path.resolve(HERE, "..", "..", "..");
  const cmd = fs.readFileSync(path.join(REPO, ".claude/commands/sync-from-template.md"), "utf8");
  const toolSrc = fs.readFileSync(path.join(REPO, ".claude/bin/sync-preflight-local-mods.mjs"), "utf8");

  const block = cmd.split("**Preserved** (never modified by sync):")[1] || "";
  const cmdPaths = new Set();
  for (const m of block.split("\n### ")[0].matchAll(/`([^`]+)`/g)) {
    const t = m[1];
    if (/\*\*$/.test(t) || t.endsWith("/**")) cmdPaths.add(t.replace(/\/\*\*$/, "/"));
    else if (t === "settings.local.json" || t === "CLAUDE.md") cmdPaths.add(t);
  }
  const toolPrefixes = new Set(
    [...(toolSrc.match(/const PRESERVED_PREFIXES = \[([\s\S]*?)\]/)?.[1] || "").matchAll(/"([^"]+)"/g)]
      .map((m) => m[1].replace(/^\.claude\//, "")),
  );
  const missing = [...cmdPaths].filter(
    (p) => !toolPrefixes.has(p) && !["settings.local.json", "CLAUDE.md"].includes(p),
  );
  check("every path the command preserves is excluded by the tool",
    missing.length === 0,
    `command lists ${cmdPaths.size}; tool prefixes ${toolPrefixes.size}; missing from tool: ${JSON.stringify(missing)}`,
    "non-empty = the command promises to preserve a path the tool still reports as replaceable — #64's drift, reopened");
  for (const req of ["rules/project/", "commands/project/", "team-memory/"]) {
    check(`command documents '${req}' as preserved (AC3/AC4)`, cmdPaths.has(req),
      `present=${cmdPaths.has(req)}`,
      "absent = the acceptance criterion is not actually met in the shipped command");
  }
}

fs.rmSync(template, { recursive: true, force: true });
fs.rmSync(consumer, { recursive: true, force: true });
console.log(`\n${"=".repeat(58)}\nPASS ${pass}   FAIL ${fail}\n${"=".repeat(58)}`);
process.exit(fail === 0 ? 0 : 1);
