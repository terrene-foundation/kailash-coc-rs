#!/usr/bin/env node
/**
 * Audit fixtures — `upstream-issue-hygiene.md` MUST-4 (Open, Never Complete).
 *
 * Locks the structural fence on `completeUpflowPR` in BOTH VCS adapters: a PR
 * may only be completed on the repo the caller IS, so a downstream consumer's
 * Step-7c upflow can open a PR against its upstream and can NEVER merge it.
 *
 * THE FENCE DERIVES THE SELF-IDENTITY; IT DOES NOT ACCEPT ONE. The first cut
 * took a `selfRepoRef` descriptor field, and a Tier-1 redteam found that both
 * operands then came off the same caller-authored object. These fixtures drive
 * the deriver through the TEST-ONLY `_deriveSelfFn` seam; production passes
 * nothing, so no caller can substitute an identity.
 *
 * Layout: inline-case runner (the variant `cc-artifacts.md` Rule 9 sanctions —
 * see `.claude/audit-fixtures/codex-dispatcher/README.md` § "Fixture layout").
 *
 * COVERAGE IS 4 KINDS × 2 PROVIDERS (+1 normalization case), and the count is
 * load-bearing: the first cut shipped 7, omitting `ado/case-insensitive-own-repo`,
 * and a reviewer probe proved that predicate had NO instrument — dropping ADO's
 * case-fold left the suite fully green. Each case records the MUTATION that reds
 * it, per `instrument-discipline.md` MUST-2(b); a fixture that cannot fail is not
 * evidence.
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
// question, not merely "was ok false?". A fence returning ok:false AFTER
// merging would pass a naive assertion.
function spyTransport(reached) {
  return () => {
    reached.fired = true;
    return { ok: true, status: 200, body: { merged: true, sha: "deadbeef" } };
  };
}

// Injected derivations. `_deriveSelfFn` is the TEST-ONLY seam.
const derive = (self) => () => ({ ok: true, self });
const deriveFails = () => () => ({
  ok: false,
  reason: "no git remote, no VERSION::repo",
});

const GH_SELF = { owner: "terrene-foundation", name: "kailash-coc-rs" };
const GH_UPSTREAM = {
  owner: "terrene-foundation",
  name: "kailash-coc-claude-py",
};
const ADO_SELF_ID = { org: "contoso", project: "platform", repo: "coc-rs" };
const ADO_SELF = { org: "contoso", project: "platform", repo: "coc-rs" };
const ADO_UPSTREAM = {
  org: "contoso",
  project: "platform",
  repo: "coc-template",
};

const cases = [
  // ---- GitHub -------------------------------------------------------------
  {
    name: "gh/refuse-downstream-merging-upstream",
    mutation: "drop the isSelfRepo check → transport fires, merge succeeds",
    run: () => {
      const reached = { fired: false };
      const r = gh.completeUpflowPR(spyTransport(reached), {
        repoRef: GH_UPSTREAM,
        prId: 77,
        _deriveSelfFn: derive(GH_SELF),
      });
      return { pass: r.ok === false && reached.fired === false, r, reached };
    },
  },
  {
    name: "gh/refuse-underivable-identity-fails-closed",
    mutation:
      "treat a failed derivation as permissive → underivable repos merge",
    run: () => {
      const reached = { fired: false };
      const r = gh.completeUpflowPR(spyTransport(reached), {
        repoRef: GH_UPSTREAM,
        prId: 77,
        _deriveSelfFn: deriveFails(),
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
        prId: 77,
        _deriveSelfFn: derive(GH_SELF),
      });
      return { pass: r.ok === true && reached.fired === true, r, reached };
    },
  },
  {
    name: "gh/case-insensitive-own-repo-still-allowed",
    mutation:
      "drop normalizeComponent's toLowerCase → case variant spuriously refuses",
    run: () => {
      const reached = { fired: false };
      const r = gh.completeUpflowPR(spyTransport(reached), {
        repoRef: { owner: "Terrene-Foundation", name: "Kailash-COC-RS" },
        prId: 77,
        _deriveSelfFn: derive(GH_SELF),
      });
      return { pass: r.ok === true && reached.fired === true, r, reached };
    },
  },
  {
    name: "gh/dot-git-suffix-own-repo-still-allowed",
    mutation:
      "drop normalizeComponent's /\\.git$/ strip → false cross-repo refusal",
    run: () => {
      const reached = { fired: false };
      const r = gh.completeUpflowPR(spyTransport(reached), {
        repoRef: { owner: "terrene-foundation", name: "kailash-coc-rs.git" },
        prId: 77,
        _deriveSelfFn: derive(GH_SELF),
      });
      return { pass: r.ok === true && reached.fired === true, r, reached };
    },
  },
  // ---- Azure DevOps (provider parity — same 4 kinds) ----------------------
  {
    name: "ado/refuse-downstream-merging-upstream",
    mutation: "drop the ADO fence → the un-fenced provider becomes the bypass",
    run: () => {
      const reached = { fired: false };
      const r = ado.completeUpflowPR(spyTransport(reached), {
        repoRef: ADO_UPSTREAM,
        prId: 42,
        _deriveSelfFn: derive(ADO_SELF_ID),
      });
      return { pass: r.ok === false && reached.fired === false, r, reached };
    },
  },
  {
    name: "ado/refuse-underivable-identity-fails-closed",
    mutation:
      "treat a failed derivation as permissive → underivable repos complete",
    run: () => {
      const reached = { fired: false };
      const r = ado.completeUpflowPR(spyTransport(reached), {
        repoRef: ADO_UPSTREAM,
        prId: 42,
        _deriveSelfFn: deriveFails(),
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
        prId: 42,
        _deriveSelfFn: derive(ADO_SELF_ID),
      });
      return { pass: r.ok === true && reached.fired === true, r, reached };
    },
  },
  {
    // THE 8TH CASE. Its absence was a reviewer finding: without it, dropping
    // ADO's case-fold left the suite green — an unprotected predicate whose
    // regression would fail-CLOSED on the maintainer's own ingest merge.
    name: "ado/case-insensitive-own-repo-still-allowed",
    mutation: "drop ADO case-folding → maintainer's own ingest merge is refused",
    run: () => {
      const reached = { fired: false };
      const r = ado.completeUpflowPR(spyTransport(reached), {
        repoRef: { org: "Contoso", project: "Platform", repo: "COC-RS" },
        prId: 42,
        _deriveSelfFn: derive(ADO_SELF_ID),
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
