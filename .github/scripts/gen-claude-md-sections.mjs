#!/usr/bin/env node
/**
 * Generate the DERIVED sections of CLAUDE.md from their single source of truth.
 *
 * WHY THIS EXISTS
 *
 * `validate-emit.mjs` carries ten parity checks. Nine of the eleven checks that
 * have ever failed in this repo are the same defect: ONE FACT stored in TWO
 * artifacts, reconciled by a hand-written checker added after someone was
 * burned. `claude-md-surface-role-parity` is one of them — `surface_roles` in
 * sync-manifest.yaml, and the same list again as English prose in CLAUDE.md.
 *
 * On 2026-08-10 that check failed eighteen times because CLAUDE.md's half was
 * absent entirely, and it was fixed by hand-writing eighteen command names into
 * prose. That fix cleared the findings and reproduced the disease: the prose is
 * still a second copy, still hand-maintained, and still drifts the first time a
 * command is added to the manifest.
 *
 * This script removes the second copy's authorship instead of re-checking it.
 * The manifest stays the source; the prose becomes output. Drift stops being
 * something to detect and becomes something that cannot be authored.
 *
 * WHY IT LIVES IN .github/ AND NOT .claude/bin/
 *
 * `.claude/**` is Class-A at this tier — rebuilt by the next `/sync-to-use`
 * (rules/artifact-flow.md § Distribution-Durability Invariants), so a generator
 * placed there would be deleted by the sync it exists to survive. `.github/` is
 * repo-owned here, and CLAUDE.md is template-owned and sync-preserved. Both
 * halves of this pairing therefore survive, which is what makes the fix durable
 * rather than another Class-A patch.
 *
 * SCOPE, HONESTLY
 *
 * This closes the drift class for the ONE artifact this repo owns both sides
 * of. The other eight duplicated-fact pairs live entirely in synced artifacts
 * and are loom's; they are filed as a root-cause proposal, not patched here.
 *
 * USAGE
 *   node .github/scripts/gen-claude-md-sections.mjs           # rewrite in place
 *   node .github/scripts/gen-claude-md-sections.mjs --check   # exit 1 on drift
 *
 * Exit 0 = in sync (or written). Exit 1 = drift under --check, or a real error.
 * Exit 2 = the source could not be read, which is reported as a failure rather
 * than a silent pass: a generator that cannot see its source has not verified
 * anything, and saying "in sync" there would be the same non-discriminating
 * result this whole class of check exists to avoid.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const MANIFEST = path.join(REPO, ".claude", "sync-manifest.yaml");
const CLAUDE_MD = path.join(REPO, "CLAUDE.md");

const BEGIN = "<!-- BEGIN GENERATED: surface-roles -->";
const END = "<!-- END GENERATED: surface-roles -->";

/**
 * Extract `surface_roles` without a YAML dependency.
 *
 * The block is `surface_roles:` followed by `  <path>: [<role>, ...]` entries.
 * Parsed line-wise on purpose: this script runs in CI where adding a YAML
 * parser is a dependency to maintain, and the shape here is fixed and shallow.
 * If the block ever stops matching, we return null and the caller EXITS 2
 * rather than emitting an empty list — an empty parse and a genuinely empty
 * config must not be indistinguishable.
 */
function parseSurfaceRoles(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^surface_roles:\s*$/.test(l));
  if (start === -1) return null;

  const out = new Map();
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line) && line.trim() !== "") break; // dedented out of the block
    const m = line.match(/^\s+([A-Za-z0-9._/-]+):\s*\[(.*)\]\s*$/);
    if (!m) continue;
    const roles = m[2]
      .split(",")
      .map((r) => r.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    out.set(m[1], roles);
  }
  return out.size === 0 ? null : out;
}

function commandName(artifactPath) {
  const m = artifactPath.match(/^commands\/([a-z0-9-]+)\.md$/);
  return m ? m[1] : null;
}

function render(surfaceRoles) {
  const desurfaced = [];
  const platform = [];
  for (const [p, roles] of surfaceRoles) {
    const name = commandName(p);
    if (!name) continue;
    (roles.includes("platform") ? platform : desurfaced).push(name);
  }
  desurfaced.sort();
  platform.sort();

  const lines = [];
  lines.push(BEGIN);
  lines.push("");
  lines.push(
    "<!-- Generated from .claude/sync-manifest.yaml::surface_roles by",
  );
  lines.push(
    "     .github/scripts/gen-claude-md-sections.mjs. DO NOT EDIT BY HAND —",
  );
  lines.push(
    "     edit surface_roles and regenerate, or CI's --check will fail. The",
  );
  lines.push(
    "     phrases below are load-bearing: validate-emit.mjs's parity check",
  );
  lines.push(
    "     reads bullet lines for the exact strings \"de-surfaced at the",
  );
  lines.push(
    '     platform role" and "default-surfaced for every role", and extracts',
  );
  lines.push("     the backticked /name tokens from them. -->");
  lines.push("");

  if (desurfaced.length) {
    lines.push(
      `- Commands **de-surfaced at the platform role**: ${desurfaced
        .map((c) => `\`/${c}\``)
        .join(", ")}.`,
    );
  }
  if (platform.length) {
    lines.push(
      `- Commands **default-surfaced for every role**: ${platform
        .map((c) => `\`/${c}\``)
        .join(", ")}.`,
    );
  } else {
    lines.push("");
    lines.push(
      "No command is platform-surfaced, so there is no default-surfaced list to",
    );
    lines.push(
      "keep in step. Add one to `surface_roles` and it appears here on the next",
    );
    lines.push("regeneration.");
  }

  lines.push("");
  lines.push(END);
  return lines.join("\n");
}

function main() {
  const check = process.argv.includes("--check");

  let manifestText;
  try {
    manifestText = readFileSync(MANIFEST, "utf8");
  } catch (e) {
    console.error(`gen-claude-md-sections: cannot read ${MANIFEST}: ${e.message}`);
    console.error("  Reported as a FAILURE, not a pass — a generator that");
    console.error("  cannot read its source has verified nothing.");
    process.exit(2);
  }

  const surfaceRoles = parseSurfaceRoles(manifestText);
  if (!surfaceRoles) {
    console.error(
      "gen-claude-md-sections: no parseable `surface_roles:` block in the manifest.",
    );
    console.error(
      "  Exiting 2 rather than emitting an empty list — an unparseable block and",
    );
    console.error("  a genuinely empty one must not produce the same output.");
    process.exit(2);
  }

  const md = readFileSync(CLAUDE_MD, "utf8");
  const b = md.indexOf(BEGIN);
  const e = md.indexOf(END);
  if (b === -1 || e === -1 || e < b) {
    console.error(
      `gen-claude-md-sections: markers not found in CLAUDE.md (expected ${BEGIN} ... ${END}).`,
    );
    process.exit(2);
  }

  const block = render(surfaceRoles);
  const next = md.slice(0, b) + block + md.slice(e + END.length);

  if (next === md) {
    console.log(
      `gen-claude-md-sections: in sync (${surfaceRoles.size} surface_roles entries read).`,
    );
    process.exit(0);
  }

  if (check) {
    console.error("gen-claude-md-sections: CLAUDE.md is STALE against the manifest.");
    console.error("  The generated block no longer matches `surface_roles`.");
    console.error("  Fix: node .github/scripts/gen-claude-md-sections.mjs");
    process.exit(1);
  }

  writeFileSync(CLAUDE_MD, next);
  console.log("gen-claude-md-sections: CLAUDE.md regenerated.");
  process.exit(0);
}

main();
