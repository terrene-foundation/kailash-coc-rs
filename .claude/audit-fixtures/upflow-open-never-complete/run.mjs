#!/usr/bin/env node
/**
 * Audit fixtures — `upstream-issue-hygiene.md` MUST-4 (Open, Never Complete).
 *
 * Locks the structural fence on `completeUpflowPR` in BOTH VCS adapters: a PR
 * may only be completed on the caller's OWN repo, so a downstream consumer's
 * Step-7c upflow can open a PR against its upstream and can NEVER merge it.
 *
 * Layout: inline-case runner (the variant `cc-artifacts.md` Rule 9 sanctions —
 * see `.claude/audit-fixtures/codex-dispatcher/README.md` § "Fixture layout").
 *
 * Each case records the MUTATION that reds it, per `instrument-discipline.md`
 * MUST-2(b): a fixture that cannot fail is not evidence.
 *
 * Run: node .claude/audit-fixtures/upflow-open-never-complete/run.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(HERE, "../../hooks/lib");

const gh = require(path.join(LIB, "vcs-github-adapter.js"));
const ado = require(path.join(LIB, "vcs-azure-adapter.js"));

// A transport that RECORDS whether it was reached. The fence must refuse
// BEFORE any network call — "did the transport fire?" is the discriminating
// question, not merely "was ok false?".
function spyTransport(reached) {
  return () => {
    reached.fired = true;
    return { ok: true, status: 200, body: { merged: true, sha: "deadbeef" } };
  };
}

const GH_SELF = { owner: "terrene-foundation", name: "kailash-coc-rs" };
const GH_UPSTREAM = { owner: "terrene-foundation", name: "kailash-coc-claude-py" };
const ADO_SELF = { org: "contoso", project: "platform", repo: "coc-rs" };
const ADO_UPSTREAM = { org: "contoso", project: "platform", repo: "coc-template" };

const cases = [
  // ---- GitHub -------------------------------------------------------------
  {
    name: "gh/refuse-downstream-merging-upstream",
    mutation: "drop the `sameRepo` check → transport fires, merge succeeds",
    run: () => {
      const reached = { fired: false };
      const r = gh.completeUpflowPR(spyTransport(reached), {
        repoRef: GH_UPSTREAM,
        selfRepoRef: GH_SELF,
        prId: 77,
      });
      return { pass: r.ok === false && reached.fired === false, r, reached };
    },
  },
  {
    name: "gh/refuse-absent-selfRepoRef-fails-closed",
    mutation: "default selfRepoRef to repoRef → omission silently merges",
    run: () => {
      const reached = { fired: false };
      const r = gh.completeUpflowPR(spyTransport(reached), {
        repoRef: GH_UPSTREAM,
        prId: 77,
      });
      return { pass: r.ok === false && reached.fired === false, r, reached };
    },
  },
  {
    name: "gh/allow-maintainer-merging-own-repo",
    mutation: "make the fence unconditional → maintainer ingest breaks",
    run: () => {
      const reached = { fired: false };
      const r = gh.completeUpflowPR(spyTransport(reached), {
        repoRef: GH_SELF,
        selfRepoRef: GH_SELF,
        prId: 77,
      });
      return { pass: r.ok === true && reached.fired === true, r, reached };
    },
  },
  {
    name: "gh/case-insensitive-own-repo-still-allowed",
    mutation: "drop toLowerCase() → a case variant spuriously refuses",
    run: () => {
      const reached = { fired: false };
      const r = gh.completeUpflowPR(spyTransport(reached), {
        repoRef: GH_SELF,
        selfRepoRef: { owner: "Terrene-Foundation", name: "Kailash-COC-RS" },
        prId: 77,
      });
      return { pass: r.ok === true && reached.fired === true, r, reached };
    },
  },
  // ---- Azure DevOps (provider parity) -------------------------------------
  {
    name: "ado/refuse-downstream-merging-upstream",
    mutation: "drop the ADO fence → the un-fenced provider becomes the bypass",
    run: () => {
      const reached = { fired: false };
      const r = ado.completeUpflowPR(spyTransport(reached), {
        repoRef: ADO_UPSTREAM,
        selfRepoRef: ADO_SELF,
        prId: 42,
      });
      return { pass: r.ok === false && reached.fired === false, r, reached };
    },
  },
  {
    name: "ado/refuse-absent-selfRepoRef-fails-closed",
    mutation: "default selfRepoRef to repoRef → omission silently completes",
    run: () => {
      const reached = { fired: false };
      const r = ado.completeUpflowPR(spyTransport(reached), {
        repoRef: ADO_UPSTREAM,
        prId: 42,
      });
      return { pass: r.ok === false && reached.fired === false, r, reached };
    },
  },
  {
    name: "ado/allow-maintainer-completing-own-repo",
    mutation: "make the ADO fence unconditional → maintainer ingest breaks",
    run: () => {
      const reached = { fired: false };
      const r = ado.completeUpflowPR(spyTransport(reached), {
        repoRef: ADO_SELF,
        selfRepoRef: ADO_SELF,
        prId: 42,
      });
      return { pass: r.ok === true && reached.fired === true, r, reached };
    },
  },
];

let failed = 0;
for (const c of cases) {
  let out;
  try {
    out = c.run();
  } catch (err) {
    console.log(`  ✗ ${c.name} — THREW: ${err && err.message}`);
    failed++;
    continue;
  }
  if (out.pass) {
    console.log(`  ✓ ${c.name}`);
  } else {
    failed++;
    console.log(
      `  ✗ ${c.name} — ok=${out.r && out.r.ok} transportFired=${out.reached.fired}` +
        `\n      reason: ${(out.r && (out.r.reason || out.r.error)) || "(none)"}`,
    );
  }
}

console.log(
  failed === 0
    ? `\nupflow-open-never-complete: ${cases.length}/${cases.length} PASS`
    : `\nupflow-open-never-complete: ${failed}/${cases.length} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
