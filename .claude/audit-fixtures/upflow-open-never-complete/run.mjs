#!/usr/bin/env node
/**
 * Audit fixtures — `upstream-issue-hygiene.md` MUST-4 (Open, Never Complete).
 *
 * Locks the structural fence on `completeUpflowPR` in BOTH VCS adapters: a PR
 * may only be completed on the repo the caller IS, so a downstream consumer's
 * Step-7c upflow can open a PR against its upstream and can NEVER merge it.
 *
 * THE FENCE DERIVES THE SELF-IDENTITY FROM `process.cwd()`; IT DOES NOT ACCEPT
 * ONE. There is no `selfRepoRef` field and no `_deriveSelfFn` seam: no identity,
 * `cwd`, or deriver value is taken off the caller's DESCRIPTOR
 * (`deriveSelfRepoRef` does take a `cwd` argument, which both adapters hardcode
 * to `process.cwd()`; what was removed is the caller's ability to SUPPLY one) —
 * in production OR in these fixtures. The caller-authored operand was MOVED
 * TWICE before it was removed — three shapes across two corrections
 * (`selfRepoRef` → `_deriveSelfFn` → `cwd`) — and a Tier-1 redteam defeated each
 * shape in turn; an earlier cut of THIS FILE then drove the fence through the
 * `_deriveSelfFn` seam, which meant the suite was exercising an injection point
 * rather than the fence.
 *
 * WHAT A GREEN RUN DOES AND DOES NOT SHOW. A green run does NOT show the fence
 * is an identity boundary. `process.cwd()` is selected by whoever launches the
 * process, so a scratch tree whose `origin` points at the upstream derives that
 * upstream and clears the fence. What these cases lock is that the fence refuses
 * any completion whose target does not match the identity derived from the
 * working tree the process runs in — which CLOSES the accident class (the
 * originating incident) and RAISES THE COST of a deliberate act. It is NOT a
 * boundary against a caller that can choose its own working directory, and
 * cannot be: a caller able to run arbitrary in-process code can replace the
 * module outright.
 *
 * HOW THIS SUITE DRIVES IT INSTEAD — a real repo, in a child process.
 * Each case (1) mkdtemps a directory, (2) `git init`s it and configures the
 * origin remote that case needs, (3) optionally writes a `.claude/VERSION`,
 * (4) spawns a CHILD `node` with `cwd` set to that directory, which requires the
 * adapter by absolute path, builds a spy transport in-process, calls
 * `completeUpflowPR`, and prints one line of JSON, (5) asserts on that JSON, and
 * (6) removes the tree. `cwd` is set at the PROCESS boundary — the only place it
 * can be set now — so the fixture reaches the fence exactly the way a real
 * session does.
 *
 * TRANSPORT injection stays: that is the NETWORK seam, and it is what makes
 * "did the fence refuse BEFORE any call went out?" answerable. IDENTITY
 * injection is what is gone.
 *
 * WHAT EACH CASE ASSERTS: `ok`, `fired` (did the transport get reached?),
 * `error === null`, AND — on every refusal case — `expectReason`, a substring
 * or RegExp naming WHICH refusal fired.
 *
 * The third is load-bearing — deleting a fail-closed guard usually makes the
 * next line throw on `undefined`, which a bare `ok === false` assertion happily
 * accepts as a refusal. Asserting the refusal is a TYPED refusal rather than a
 * crash is what gives those guards an instrument.
 *
 * The FOURTH is the same discipline one step further. `ok`/`fired`/`error` say
 * only THAT a refusal happened; the fence has SIX distinct refusal branches
 * (underivable-no-remote, underivable-unparseable, VERSION-disagreement,
 * non-GitHub host, non-ADO remote, cross-repo target) — plus, downstream of the
 * fence, the path/enum shape guards on the two values the caller still authors
 * (`prId`, `mergeMethod`) — and a case can pass via a DIFFERENT branch than the
 * one its `mutation:` field names — at which point the
 * recorded mutation is INERT and the case is no longer an instrument for it.
 * That is not hypothetical: `gh/bare-path-remote-refuses` under its own recorded
 * mutation refuses at the host check instead of the bare-path guard, so without
 * `expectReason` the mutation leaves the case green (README § "Row 9
 * re-measured"). `expectReason` is matched against `"<error label> | <reason>"`
 * as a SUBSTRING (or RegExp) deliberately — pinning whole sentences would red
 * the suite on every prose tweak.
 *
 * Layout: inline-case runner (the variant `cc-artifacts.md` Rule 9 sanctions —
 * see `.claude/audit-fixtures/codex-dispatcher/README.md` § "Fixture layout").
 *
 * Every case records, in `mutation:`, the specific source change that REDS it.
 * Those mutations were EXECUTED one at a time, per `instrument-discipline.md`
 * MUST-2(b): a mutation that does not red leaves two live hypotheses (vacuous
 * test OR inert mutation), so an un-run `mutation:` field is a claim, not
 * evidence.
 * PROVENANCE IS NOT UNIFORM ACROSS ROWS, so this header does not assert that it
 * is: some rows were measured in the LIVE tree, others against a byte-copy of
 * `.claude/hooks/` in a scratch sandbox (chosen while sibling agents were
 * editing the adapters concurrently). README.md § Mutation validity records
 * which is which, per row, along with the verdicts and the cases each reddened.
 * That per-pass method statement is the authority — read it there rather than
 * inferring a single provenance from this comment.
 *
 * Run: node .claude/audit-fixtures/upflow-open-never-complete/run.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(HERE, "../../hooks/lib");
const GH = path.join(LIB, "vcs-github-adapter.js");
const ADO = path.join(LIB, "vcs-azure-adapter.js");

const RESULT_PREFIX = "@@UPFLOW-FENCE-RESULT@@";

// ---------------------------------------------------------------------------
// Real temp repos
// ---------------------------------------------------------------------------

function git(cwd, args) {
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
}

/**
 * Build a throwaway git repo.
 *
 * `dirName` is the repo directory's NAME, and it is load-bearing in the
 * no-remote cases: naming the directory after the repo the caller is trying to
 * merge is what makes those cases discriminating against a restored
 * directory-name fallback. Without it, "no remote refuses" would also pass
 * against a build that DID fall back to the dirname.
 *
 * @returns {{root:string, repo:string}} `root` is what the caller removes.
 */
function makeRepo({ dirName, remote, version }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "upflow-fence-"));
  const repo = path.join(root, dirName);
  fs.mkdirSync(repo);
  git(repo, ["init", "-q"]);
  if (remote) git(repo, ["remote", "add", "origin", remote]);
  if (version) {
    fs.mkdirSync(path.join(repo, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(repo, ".claude", "VERSION"),
      JSON.stringify(version, null, 2) + "\n",
      "utf8",
    );
  }
  return { root, repo };
}

/**
 * The child program. Runs with `cwd` = the temp repo, so the adapter's
 * hardcoded `process.cwd()` resolves there. The spy transport RECORDS whether
 * it was reached: "did the fence refuse before any network call?" is the
 * discriminating question — a fence that merged and then returned `ok:false`
 * would satisfy a naive `ok === false` assertion.
 */
function childProgram(adapterPath, prRef) {
  return [
    `const adapter = require(${JSON.stringify(adapterPath)});`,
    `let fired = false;`,
    // CAPTURES THE ENDPOINT, not just whether it fired. Both adapters build the
    // request path from the DERIVED identity rather than the caller's `repoRef`
    // ("check and use are the same bytes"), and that construction had NO
    // instrument until this argument was recorded: reverting either adapter to
    // interpolate `repoRef` changed no value the harness read, so no case could
    // red. GitHub passes the path as a string first arg; ADO passes an object
    // with a `path` property — both shapes are normalized here.
    `let endpoint = null;`,
    `const transport = (a) => { fired = true; endpoint = (a && typeof a === "object") ? (a.path || null) : (typeof a === "string" ? a : null); return { ok: true, status: 200, body: { merged: true, sha: "deadbeef" } }; };`,
    `let r = null, error = null;`,
    // The `_deriveSelfFn` seam must arrive as a REAL FUNCTION, not the sentinel
    // string. `JSON.stringify` cannot carry a function, so the sentinel is
    // swapped for a literal here. This is load-bearing: a NAIVE restoration
    // (`(prRef._deriveSelfFn || derive)(cwd)`) would throw on a string and red
    // via `error !== null`, but a DEFENSIVE one
    // (`typeof x === "function" ? x(...) : derive(process.cwd())`) — the shape a
    // careful author would actually write — would fall through on a string and
    // leave the case GREEN. With a real function it is honored, the derivation
    // returns the upstream, and the case flips refuse→authorize as intended.
    `try { r = adapter.completeUpflowPR(transport, ${JSON.stringify(prRef).replace(
      '"__must_be_ignored__"',
      '(function(){ return {ok:true, self:{host:"github.com", owner:"terrene-foundation", name:"kailash-coc-claude-py", ado:null, source:"remote"}}; })',
    )}); }`,
    `catch (e) { error = (e && e.message) ? e.message : String(e); }`,
    `process.stdout.write(${JSON.stringify(RESULT_PREFIX)} + JSON.stringify({`,
    `  ok: !!(r && r.ok), fired, error, endpoint,`,
    `  reason: (r && r.reason) || null,`,
    // The adapters' `_fail(error, reason)` short LABEL. Carried separately
    // because two ADO branches share a label while their reasons differ, and
    // two GitHub branches share reason wording while their labels differ — the
    // pair discriminates where neither field alone does.
    `  label: (r && r.error) || null,`,
    `}) + "\\n");`,
  ].join("\n");
}

function runInRepo(repo, adapterPath, prRef, extraEnv) {
  const res = spawnSync(process.execPath, ["-e", childProgram(adapterPath, prRef)], {
    cwd: repo,
    encoding: "utf8",
    timeout: 30000,
    // `extraEnv` exists for ONE case: the ambient-`GIT_DIR` probe. The
    // derivation routes `git` through `git-subprocess-env.js::gitEnv()`, which
    // builds the child env from constants so nothing is inherited — and that
    // routing closes a documented FENCE BYPASS (`GIT_DIR` outranks repository
    // discovery, so neither `cwd:` nor `-C` pins WHICH repo git resolves).
    // Until this hook existed no case set `GIT_DIR`, so removing `gitEnv()`
    // changed no value the harness read.
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  });
  const line = String(res.stdout || "")
    .split("\n")
    .find((l) => l.startsWith(RESULT_PREFIX));
  if (!line) {
    throw new Error(
      `child produced no result line (status=${res.status}) — stderr: ` +
        String(res.stderr || "").trim().slice(0, 400),
    );
  }
  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

// ---------------------------------------------------------------------------
// Identities
// ---------------------------------------------------------------------------

const GH_SELF = { owner: "terrene-foundation", name: "kailash-coc-rs" };
const GH_UPSTREAM = {
  owner: "terrene-foundation",
  name: "kailash-coc-claude-py",
};
const GH_SELF_REMOTE =
  "https://github.com/terrene-foundation/kailash-coc-rs.git";

const ADO_SELF = { org: "contoso", project: "platform", repo: "coc-rs" };
const ADO_UPSTREAM = {
  org: "contoso",
  project: "platform",
  repo: "coc-template",
};
const ADO_SELF_REMOTE = "https://dev.azure.com/contoso/platform/_git/coc-rs";

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

const cases = [
  // ---- GitHub -------------------------------------------------------------
  {
    name: "gh/refuse-downstream-merging-upstream",
    mutation:
      "vcs-github-adapter.js::completeUpflowPR — delete the `if (!selfRepo.isSelfRepo(repoRef, d.self))` refusal block",
    repo: { dirName: "kailash-coc-rs", remote: GH_SELF_REMOTE },
    adapter: GH,
    prRef: { repoRef: GH_UPSTREAM, prId: 77 },
    expect: { ok: false, fired: false },
    expectReason: "cross-repo completion refused",
  },
  {
    name: "gh/non-github-host-remote-refuses",
    mutation:
      "vcs-github-adapter.js::completeUpflowPR — drop the `GITHUB_HOSTS.has(d.self.host)` refusal",
    // THE HOST CHECK'S ONLY INSTRUMENT. The remote's PATH is identical to this
    // repo's own (`terrene-foundation/kailash-coc-rs`), so owner+name match self
    // exactly; ONLY the host differs. Without the host check the fence would
    // authorize a merge on github.com/terrene-foundation/kailash-coc-rs from a
    // tree whose origin is an internal GitLab mirror — a DIFFERENT repo than the
    // remote names. A predicate sweep measured that dropping the host check left
    // the suite fully GREEN: every other GitHub case uses a github.com remote, a
    // bare path, or no remote, so none could distinguish it.
    repo: {
      dirName: "kailash-coc-rs",
      remote: "https://gitlab.internal.example/terrene-foundation/kailash-coc-rs.git",
    },
    adapter: GH,
    prRef: { repoRef: GH_SELF, prId: 77 },
    expect: { ok: false, fired: false },
    expectReason: "non-GitHub self-identity refused",
  },
  {
    // THE OWNER LEG'S ONLY INSTRUMENT. Every OTHER GitHub refusal case shares an
    // owner with self (`terrene-foundation/...` vs `terrene-foundation/...`) and
    // differs only in NAME, so the name leg carries all of them and dropping
    // `a === self.owner` left the suite fully GREEN — measured, 16/16. That is
    // the same "leg that can never fail" defect the ADO `org` comparison had
    // (README row 5), reproduced on the primary lane. This case is the one that
    // differs in OWNER while holding NAME equal, so it is the only thing
    // standing between a cross-owner completion and `ok:true`.
    name: "gh/cross-owner-same-name-refuses",
    mutation:
      "upflow-self-repo.js::isSelfRepo — drop the `a === self.owner` leg, keeping only `b === self.name`",
    repo: { dirName: "kailash-coc-rs", remote: GH_SELF_REMOTE },
    adapter: GH,
    prRef: { repoRef: { owner: "fabrikam", name: "kailash-coc-rs" }, prId: 77 },
    expect: { ok: false, fired: false },
    expectReason: "cross-repo completion refused",
  },
  {
    name: "gh/allow-maintainer-merging-own-repo",
    mutation:
      "upflow-self-repo.js::isSelfRepo — `return false;` at the top (fence becomes unconditional)",
    repo: { dirName: "kailash-coc-rs", remote: GH_SELF_REMOTE },
    adapter: GH,
    prRef: { repoRef: GH_SELF, prId: 77 },
    expect: { ok: true, fired: true },
  },
  {
    name: "gh/case-insensitive-own-repo-still-allowed",
    mutation:
      "upflow-self-repo.js::normalizeComponent — drop `.toLowerCase()`",
    repo: { dirName: "kailash-coc-rs", remote: GH_SELF_REMOTE },
    adapter: GH,
    prRef: {
      repoRef: { owner: "Terrene-Foundation", name: "Kailash-COC-RS" },
      prId: 77,
    },
    expect: { ok: true, fired: true },
    // Caller passes MIXED CASE; the path must carry the DERIVED lowercase form.
    // Reverting the adapter to interpolate `repoRef` yields
    // `repos/Terrene-Foundation/Kailash-COC-RS/...` and reds here.
    expectEndpoint: "repos/terrene-foundation/kailash-coc-rs/pulls/",
  },
  {
    // Remote deliberately carries NO `.git`, target does. If the remote also
    // ended in `.git`, dropping the strip would mangle BOTH sides identically
    // and the case would stay green — an inert mutation, not a passing test.
    name: "gh/dot-git-suffix-own-repo-still-allowed",
    mutation:
      "upflow-self-repo.js::normalizeComponent — drop `.replace(/\\.git$/i, \"\")`",
    repo: {
      dirName: "kailash-coc-rs",
      remote: "https://github.com/terrene-foundation/kailash-coc-rs",
    },
    adapter: GH,
    prRef: {
      repoRef: { owner: "terrene-foundation", name: "kailash-coc-rs.git" },
      prId: 77,
    },
    expect: { ok: true, fired: true },
    // Caller passes a `.git` suffix; the path must carry the DERIVED stripped
    // form. Interpolating `repoRef` yields `.../kailash-coc-rs.git/pulls/`.
    expectEndpoint: "repos/terrene-foundation/kailash-coc-rs/pulls/",
  },
  {
    // THE ORIGINAL EXPLOIT, reconstructed exactly: no origin remote, a
    // directory named after the target repo, and a `.claude/VERSION` declaring
    // that same repo. Under the defeated build the dirname fallback yielded
    // `slug: null`, the forged declaration was the only slug left, and the
    // fence returned ok:true on an arbitrary upstream. It must REFUSE.
    name: "gh/no-origin-remote-refuses",
    mutation:
      "upflow-self-repo.js::deriveSelfRepoRef — on `!url`, fall back to `_declaredSlug(cwd)` as an identity SOURCE instead of refusing",
    repo: {
      dirName: "kailash-coc-rs",
      remote: null,
      version: { repo: "terrene-foundation/kailash-coc-rs" },
    },
    adapter: GH,
    prRef: { repoRef: GH_SELF, prId: 77 },
    expect: { ok: false, fired: false },
    expectReason: "yielded no remote for this working tree",
  },
  {
    // A bare filesystem path is not a hosting identity. The path's last two
    // segments spell the target, so a build that treated it as one would
    // authorize.
    // THE AUTHORITY-CUT'S ONLY INSTRUMENT — and its removal is fail-OPEN, which
    // is what makes this a refusal case rather than a normalization one. Without
    // the `#`/`?` truncation, `authority` is `evil.com#@github.com`,
    // `lastIndexOf("@")` yields host `github.com` (clearing GITHUB_HOSTS), and
    // the path yields exactly GH_SELF — so the fence AUTHORIZES a merge against
    // a repo the remote does not name. curl, which git uses for https,
    // terminates the authority at `#`, so git would resolve `evil.com`.
    // Before this case existed, NO fixture remote contained `#` or `?` at all,
    // so both truncation lines were a no-op across the whole suite.
    name: "gh/fragment-authority-spoof-refuses",
    mutation:
      "upflow-self-repo.js::_splitRemoteUrl — drop the `authCut` truncation at the first `#`/`?`",
    repo: {
      dirName: "kailash-coc-rs",
      remote: "https://evil.com#@github.com/terrene-foundation/kailash-coc-rs.git",
    },
    adapter: GH,
    prRef: { repoRef: GH_SELF, prId: 77 },
    expect: { ok: false, fired: false },
    // Pins the HOST branch: the derivation must resolve `evil.com`, not the
    // `github.com` decoy after the `@`.
    expectReason: "non-GitHub self-identity refused",
  },
  {
    // Query-delimiter sibling of the case above. `?` is the other authority
    // terminator curl honors, and `search(/[#?]/)` takes whichever comes first.
    name: "gh/query-authority-spoof-refuses",
    mutation:
      "upflow-self-repo.js::_splitRemoteUrl — drop the `authCut` truncation at the first `#`/`?`",
    repo: {
      dirName: "kailash-coc-rs",
      remote: "https://evil.com?@github.com/terrene-foundation/kailash-coc-rs.git",
    },
    adapter: GH,
    prRef: { repoRef: GH_SELF, prId: 77 },
    expect: { ok: false, fired: false },
    expectReason: "non-GitHub self-identity refused",
  },
  {
    // THIRD authority-spoof route, and the one NEITHER sibling above covered:
    // the SCHEME itself was unanchored. `_splitRemoteUrl` used
    // `indexOf("://")`, which finds the first `://` ANYWHERE — including one
    // sitting in the PATH of an scp-style remote — and then read the authority
    // out of the middle of the string. Measured on the pre-fix code:
    // `"evil.com:x/https://github.com/o/r".indexOf("://")` = 16, so `afterScheme`
    // began at `github.com` and the derivation returned the DECOY host, clearing
    // a caller's `GITHUB_HOSTS` check on a remote whose real host is `evil.com`.
    //
    // Reachability, stated honestly rather than inflated: `git remote add`
    // ACCEPTS this string and `git remote get-url` returns it verbatim (both
    // measured), so the derivation genuinely receives it — but `git ls-remote`
    // refuses it (`fatal: protocol 'evil.com:x/https' is not supported`), so it
    // is not a fetchable remote. The delta over the module header's disclosed
    // in-process bound is therefore ~zero; this is pinned as a CHECK-vs-USE
    // divergence (the fence believing it is a repo git cannot reach), which is
    // the same class as the `#`/`?` cut, not as a new privilege escalation.
    name: "gh/unanchored-scheme-authority-spoof-refuses",
    mutation:
      "upflow-self-repo.js::_splitRemoteUrl — unanchor the scheme test back to `s.includes(\"://\")` + `s.indexOf(\"://\")`",
    repo: {
      dirName: "kailash-coc-rs",
      remote:
        "evil.com:x/https://github.com/terrene-foundation/kailash-coc-rs.git",
    },
    adapter: GH,
    prRef: { repoRef: GH_SELF, prId: 77 },
    expect: { ok: false, fired: false },
    // Pins the HOST branch: anchoring routes this to the scp-style parse, whose
    // authority is `evil.com` — so the refusal must be the host one, NOT a
    // generic parse failure. A reason-less assertion would pass on either.
    expectReason: "non-GitHub self-identity refused",
  },
  {
    // THE REGRESSION GUARD FOR THE ORIGINATING CRIT. The caller-authored
    // identity operand was removed three times — `selfRepoRef`, then
    // `_deriveSelfFn`, then `cwd` — and NOTHING detected its return. Measured:
    // restoring `deriveSelfRepoRef((prRef && prRef.cwd) || process.cwd())` left
    // the suite fully GREEN while a forged tree merged on the upstream. That is
    // the exact defect this whole change exists to fix, reintroducible with no
    // test signal.
    //
    // This case injects ALL THREE removed seams onto the descriptor at once,
    // pointed at a decoy tree whose origin IS the upstream, and targets the
    // upstream. The fence must IGNORE every one of them and refuse, because the
    // real `process.cwd()` is the self repo. If any seam is honored the
    // derivation returns the upstream, `isSelfRepo` matches, and the merge
    // fires — flipping this case refuse→authorize.
    name: "gh/descriptor-identity-seams-are-ignored",
    mutation:
      "vcs-github-adapter.js::completeUpflowPR — restore any caller-authored identity seam, e.g. `deriveSelfRepoRef((prRef && prRef.cwd) || process.cwd())`",
    repo: { dirName: "kailash-coc-rs", remote: GH_SELF_REMOTE },
    decoyRepo: {
      dirName: "kailash-coc-claude-py",
      remote: "https://github.com/terrene-foundation/kailash-coc-claude-py.git",
    },
    decoyMode: "descriptor-seam",
    adapter: GH,
    prRef: { repoRef: GH_UPSTREAM, prId: 77 },
    expect: { ok: false, fired: false },
    expectReason: "cross-repo completion refused",
  },
  {
    // THE `gitEnv()` ROUTING'S ONLY INSTRUMENT. `git-subprocess-env.js` exists
    // because `GIT_DIR` outranks repository DISCOVERY: neither `cwd:` nor
    // `-C <path>` pins WHICH repository git resolves, so an ambient `GIT_DIR`
    // pointing at a clone of the upstream would make the derivation return the
    // UPSTREAM's slug — the module's own docstring calls that "a fence bypass,
    // not a nuisance". Until this case existed NO fixture set `GIT_DIR`, so
    // removing `env: gitEnv()` changed no value the harness read.
    //
    // Shape: cwd is the SELF repo; a decoy repo whose origin is the UPSTREAM is
    // built alongside and the child's ambient `GIT_DIR` points at it. The
    // derivation must still resolve SELF, so the self-targeted merge SUCCEEDS.
    // Chosen over an upstream-targeted refusal because a refusal is what a
    // BROKEN derivation also produces — this shape fails in the loud direction.
    name: "gh/ambient-git-dir-cannot-redirect-derivation",
    mutation:
      "upflow-self-repo.js::_readOriginRemote — drop `env: gitEnv()` from the execFileSync options, letting the child inherit the ambient environment",
    repo: { dirName: "kailash-coc-rs", remote: GH_SELF_REMOTE },
    decoyRepo: {
      dirName: "kailash-coc-claude-py",
      remote: "https://github.com/terrene-foundation/kailash-coc-claude-py.git",
    },
    decoyMode: "git-dir",
    adapter: GH,
    prRef: { repoRef: GH_SELF, prId: 77 },
    expect: { ok: true, fired: true },
    expectEndpoint: "repos/terrene-foundation/kailash-coc-rs/pulls/",
  },
  {
    // THE PATH-SHAPE REJECTION'S ONLY INSTRUMENT. `normalizeComponent` strips a
    // trailing `.git`, and that strip is what CREATES the dangerous value:
    // `"...git"` -> `".."`. Both sides of the comparison normalize identically,
    // so WITHOUT the rejection the fence PASSES on a `..` and interpolates it
    // into the request path. On ADO that is a repo-scope ESCAPE — the path
    // collapses to the PROJECT-scoped PR address, which is scoped to no
    // repository at all — and both `ADO_REPO_RE` and `ADO_PROJECT_RE` permit
    // dots, so `"...git"` is a valid caller value there.
    //
    // Both adapters already guarded `..` on `head`/`base` (BODY positions) while
    // leaving the repo components (PATH positions) open. This case was added
    // because the guard closing that gap shipped with NO instrument — the sixth
    // time in this change a fix landed untested.
    name: "gh/dot-dot-component-refuses",
    mutation:
      "upflow-self-repo.js::normalizeComponent — delete the `s === \".\" || s === \"..\" || s.includes(\"/\")` path-shape rejection",
    repo: {
      dirName: "kailash-coc-rs",
      remote: "https://github.com/terrene-foundation/...git",
    },
    adapter: GH,
    // Target normalizes to `..` too, so without the rejection BOTH sides agree
    // and the fence authorizes — the flip this case exists to catch.
    prRef: { repoRef: { owner: "terrene-foundation", name: "...git" }, prId: 77 },
    expect: { ok: false, fired: false },
    expectReason: "does not parse to an owner/name pair",
  },
  {
    name: "gh/bare-path-remote-refuses",
    mutation:
      "upflow-self-repo.js::_parseRemoteUrl — when `_splitRemoteUrl` returns null, fall back to the last two path segments as owner/name",
    repo: {
      dirName: "kailash-coc-rs",
      remote: "/srv/mirrors/terrene-foundation/kailash-coc-rs",
    },
    adapter: GH,
    prRef: { repoRef: GH_SELF, prId: 77 },
    expect: { ok: false, fired: false },
    // THE BRANCH IS THE ASSERTION HERE. Without `expectReason` the recorded
    // mutation is INERT: a last-two-segments fallback yields owner/name but no
    // host, so the case still refuses — at the `GITHUB_HOSTS` check, not at the
    // bare-path guard it names. Pinning the derivation-layer message is what
    // keeps this case an instrument for its own mutation (README § "Row 9
    // re-measured").
    expectReason: "does not parse to an owner/name pair (no parseable host)",
  },
  {
    // A forged VERSION naming a DIFFERENT repo, against a real remote naming
    // this one. VERSION is a refuse-only cross-check: it can never SUPPLY the
    // identity, so it cannot authorize a completion on the repo it names.
    name: "gh/forged-version-cannot-authorize-its-named-repo",
    mutation:
      "upflow-self-repo.js::deriveSelfRepoRef — prefer `_declaredSlug(cwd)` over the remote when present (VERSION supplies the identity)",
    repo: {
      dirName: "kailash-coc-rs",
      remote: GH_SELF_REMOTE,
      version: { repo: "terrene-foundation/kailash-coc-claude-py" },
    },
    adapter: GH,
    prRef: { repoRef: GH_UPSTREAM, prId: 77 },
    expect: { ok: false, fired: false },
    // Refuses at the DERIVATION's disagreement check, before the target is ever
    // compared — the same branch as its sibling below. That is what makes this
    // case unable to instrument the cross-check on its own (see the sibling's
    // comment); pinning the branch records it rather than leaving it implied.
    expectReason: "disagrees with the origin remote",
  },
  {
    // Same tree; target now AGREES with the remote. Still refuses, because the
    // declaration disagrees and the identity is therefore unprovable. This is
    // the only case that instruments the cross-check itself: in the case above
    // the target-mismatch refusal would fire regardless.
    name: "gh/version-remote-disagreement-refuses-even-own-repo",
    mutation:
      "upflow-self-repo.js::deriveSelfRepoRef — delete the `declared && declared !== slug` refusal",
    repo: {
      dirName: "kailash-coc-rs",
      remote: GH_SELF_REMOTE,
      version: { repo: "terrene-foundation/kailash-coc-claude-py" },
    },
    adapter: GH,
    prRef: { repoRef: GH_SELF, prId: 77 },
    expect: { ok: false, fired: false },
    expectReason: "disagrees with the origin remote",
  },
  {
    // THE ASCII PRE-CHECK'S ONLY INSTRUMENT. `normalizeComponent` rejects a
    // non-ASCII component BEFORE lowercasing. The remote's repo name here begins
    // with U+212A KELVIN SIGN, which Unicode case-folds to ASCII "k": with the
    // guard the component normalizes to null, the remote does not parse, and the
    // fence refuses; WITHOUT it the name folds to "kailash-coc-rs", matches self
    // exactly, and the merge is AUTHORIZED. So this is a refuse→authorize flip
    // on `ok`/`fired`, not only a branch change.
    //
    // Stated honestly, because the mutation's REACH and its live-bug status are
    // different questions: Node's `toLowerCase` is locale-INDEPENDENT, and both
    // providers' own validators already confine repoRef components to ASCII, so
    // the guard's job is to make the property STRUCTURAL on the one path those
    // validators do not cover — the origin remote, which nothing validates. This
    // case locks that property; it is not evidence of a reachable defect on
    // github.com, whose repo names are ASCII by construction.
    name: "gh/non-ascii-remote-component-refuses",
    mutation:
      "upflow-self-repo.js::normalizeComponent — delete the `if (!/^[\\x00-\\x7f]*$/.test(raw)) return null;` ASCII pre-check",
    repo: {
      dirName: "kailash-coc-rs",
      // U+212A KELVIN SIGN + "ailash-coc-rs" — written as a `\u212A` ESCAPE, not
      // a raw character, so this file stays ASCII and the codepoint is legible in
      // review. That is load-bearing rather than cosmetic. The raw character sat
      // here for a while under a comment already claiming it was an escape, and
      // any normalizing pass that folded it to ASCII "k" — a lint, an editor, a
      // copy through a Unicode-folding tool — would have turned this case into a
      // silent NO-OP: the remote would derive cleanly as
      // `terrene-foundation/kailash-coc-rs`, match GH_SELF, authorize, and stop
      // exercising the ASCII guard entirely, with nothing anywhere going red.
      // That is the inert-case failure this whole suite exists to prevent, so it
      // does not get to live inside the suite.
      remote: "https://github.com/terrene-foundation/\u212Aailash-coc-rs.git",
    },
    adapter: GH,
    prRef: { repoRef: GH_SELF, prId: 77 },
    expect: { ok: false, fired: false },
    expectReason: "does not parse to an owner/name pair (host github.com)",
  },

  // ---- Azure DevOps (provider parity — the un-fenced provider is the bypass)
  {
    name: "ado/refuse-downstream-completing-upstream",
    mutation:
      "vcs-azure-adapter.js::completeUpflowPR — delete the `if (!selfRepo.isSelfRepoAdo(repoRef, selfAdo))` refusal block",
    repo: { dirName: "coc-rs", remote: ADO_SELF_REMOTE },
    adapter: ADO,
    prRef: { repoRef: ADO_UPSTREAM, prId: 42 },
    expect: { ok: false, fired: false },
    expectReason: "cross-repo completion refused",
  },
  {
    // Userinfo form (`https://<org>@dev.azure.com/...`) — exercises the
    // authority-userinfo strip, without which the host is not an ADO host at
    // all and this legitimate merge would be refused.
    name: "ado/allow-maintainer-completing-own-repo-userinfo-form",
    mutation:
      "upflow-self-repo.js::_splitRemoteUrl — drop the userinfo strip (`authority.lastIndexOf(\"@\")`)",
    repo: {
      dirName: "coc-rs",
      remote: "https://contoso@dev.azure.com/contoso/platform/_git/coc-rs",
    },
    adapter: ADO,
    prRef: { repoRef: ADO_SELF, prId: 42 },
    expect: { ok: true, fired: true },
  },
  {
    name: "ado/case-insensitive-own-repo-still-allowed",
    mutation:
      "upflow-self-repo.js::normalizeComponent — drop `.toLowerCase()`",
    repo: { dirName: "coc-rs", remote: ADO_SELF_REMOTE },
    adapter: ADO,
    prRef: {
      repoRef: { org: "Contoso", project: "Platform", repo: "COC-RS" },
      prId: 42,
    },
    expect: { ok: true, fired: true },
    // ADO twin: caller passes MIXED CASE, path must carry the derived form.
    expectEndpoint: "contoso/platform/_apis/git/repositories/coc-rs/",
  },
  {
    // THE HIGHEST-VALUE CASE. Under the defeated build `org` was read off
    // `repoRef` while project/repo came from the derivation, so the org leg
    // self-compared and could never fail: a foreign org with a matching
    // project+repo completed. All three components must come from the remote.
    name: "ado/cross-org-same-project-and-repo-refuses",
    mutation:
      "upflow-self-repo.js::isSelfRepoAdo — drop `org` from the compared key list (`[\"project\", \"repo\"]`)",
    repo: { dirName: "coc-rs", remote: ADO_SELF_REMOTE },
    adapter: ADO,
    prRef: {
      repoRef: { org: "fabrikam", project: "platform", repo: "coc-rs" },
      prId: 42,
    },
    expect: { ok: false, fired: false },
    // Pins the TARGET-COMPARE branch. Both underivable branches share a label,
    // so a case that drifted into either would still read as "a refusal" without
    // this; here it also asserts the refusal is the org leg's, not a derivation
    // failure that would fire for a repo with no ADO remote at all.
    expectReason: "cross-repo completion refused",
  },
  {
    // THE PROJECT LEG'S ONLY INSTRUMENT. Sibling of the cross-ORG case above and
    // of `gh/cross-owner-same-name-refuses`. A predicate sweep measured that
    // dropping `project` from `isSelfRepoAdo`'s compared keys left the suite
    // fully GREEN: the existing ADO cases differ in ORG (cross-org) or in REPO
    // (upstream), never in PROJECT alone, so no case could distinguish it.
    // Third instance of the same "leg that can never fail" defect — after the
    // ADO `org` leg and the GitHub `owner` leg.
    name: "ado/cross-project-same-org-and-repo-refuses",
    mutation:
      "upflow-self-repo.js::isSelfRepoAdo — drop `project` from the compared keys, leaving org+repo",
    repo: { dirName: "coc-rs", remote: ADO_SELF_REMOTE },
    adapter: ADO,
    prRef: {
      repoRef: { org: "contoso", project: "otherproject", repo: "coc-rs" },
      prId: 42,
    },
    expect: { ok: false, fired: false },
    expectReason: "cross-repo completion refused",
  },
  {
    // A repo whose origin is not an ADO remote cannot prove an ADO identity.
    // The mutation is the historical self-compare shape, which is what this
    // guard exists to keep out.
    // THE ADO HOST PREDICATE'S ONLY INSTRUMENT — and it is FAIL-OPEN, which is
    // why it needs its own case rather than sharing the sibling below.
    // `_parseAdo`'s `if (!isAdoHost) return null;` IS the ADO adapter's host
    // fence; unlike GitHub there is no `GITHUB_HOSTS`-style allowlist at the
    // adapter. Deleting it leaves the suite green while ANY 3-or-more-segment
    // non-ADO remote (an internal GitLab/Gitea mirror) parses as org/project/
    // repo and AUTHORIZES a completion against a repo the remote does not name.
    //
    // The sibling `ado/non-ado-remote-refuses` cannot cover this: it drives a
    // 2-segment GitHub remote, which `segs.length < 3` refuses FIRST, so the
    // host predicate is never the discriminator there. Three segments is what
    // reaches it.
    name: "ado/three-segment-non-ado-remote-refuses",
    mutation:
      "upflow-self-repo.js::_parseAdo — delete the `if (!isAdoHost) return null;` host predicate",
    repo: {
      dirName: "coc-rs",
      remote: "https://gitlab.internal.example/contoso/platform/coc-rs.git",
    },
    adapter: ADO,
    prRef: { repoRef: ADO_SELF, prId: 42 },
    expect: { ok: false, fired: false },
    expectReason: "is not an Azure DevOps remote",
  },
  {
    name: "ado/non-ado-remote-refuses",
    mutation:
      "vcs-azure-adapter.js::completeUpflowPR — replace the `if (!selfAdo)` refusal with the self-compare fallback `let selfAdo = d.self.ado; if (!selfAdo) selfAdo = repoRef;`",
    repo: { dirName: "coc-rs", remote: GH_SELF_REMOTE },
    adapter: ADO,
    prRef: { repoRef: ADO_SELF, prId: 42 },
    expect: { ok: false, fired: false },
    // SPLITS THE SHARED LABEL. `vcs-azure-adapter.js` emits
    // `completeUpflowPR: self-identity underivable` from BOTH the `!d.ok` branch
    // and this `!selfAdo` branch, so `label` alone cannot say which fired —
    // exactly the wrong-branch-pass hole `gh/bare-path-remote-refuses` was fixed
    // for. The reason is where the two diverge, so it is what gets pinned.
    expectReason: "is not an Azure DevOps remote",
  },
  {
    name: "ado/allow-own-repo-ssh-v3-form",
    mutation:
      "upflow-self-repo.js::_parseAdo — drop the leading-`v3` segment strip",
    repo: {
      dirName: "coc-rs",
      remote: "git@ssh.dev.azure.com:v3/contoso/platform/coc-rs",
    },
    adapter: ADO,
    prRef: { repoRef: ADO_SELF, prId: 42 },
    expect: { ok: true, fired: true },
  },
  {
    name: "ado/allow-own-repo-visualstudio-subdomain-form",
    mutation:
      "upflow-self-repo.js::_parseAdo — drop the `isOrgSubdomain` branch that takes `<org>` from the host",
    repo: {
      dirName: "coc-rs",
      remote: "https://contoso.visualstudio.com/platform/_git/coc-rs",
    },
    adapter: ADO,
    prRef: { repoRef: ADO_SELF, prId: 42 },
    expect: { ok: true, fired: true },
  },
  {
    // The ADO adapter's underivable branch. Its instrument is `error === null`:
    // deleting the guard does not flip `ok`, it makes `d.self.ado` throw — and a
    // crash reads as a refusal to any assertion that only checks `ok === false`.
    name: "ado/no-origin-remote-refuses-typed-not-throws",
    mutation:
      "vcs-azure-adapter.js::completeUpflowPR — delete the `if (!d || !d.ok)` underivable refusal (the next line then throws on `d.self`)",
    repo: {
      dirName: "coc-rs",
      remote: null,
      // Value is incidental to the assertion — this case has NO remote and must
      // refuse regardless; the declaration exists only to prove `VERSION` cannot
      // RESCUE a missing remote. Written with the Foundation slug because the
      // synced-disclosure scanner matches any other `owner/name`-shaped literal
      // as a possible org slug, and a synthetic ADO project/repo pair is not
      // worth an allowlist edit to that fence.
      version: { repo: "terrene-foundation/coc-rs" },
    },
    adapter: ADO,
    prRef: { repoRef: ADO_SELF, prId: 42 },
    expect: { ok: false, fired: false },
    // The other half of the shared-label split (see the case above). Pins the
    // DERIVATION-layer message, which only the `!d.ok` branch forwards.
    expectReason: "yielded no remote for this working tree",
  },

  // ---- Path-interpolation guards (downstream of the fence) ------------------
  // These three do NOT exercise a fence branch. They sit one step LATER, at the
  // shape guards on the two values still authored by the caller after the fence
  // has sourced every repo component from the derivation. `prId` is interpolated
  // straight into the request path, which makes it the last caller-controlled
  // path content on a path that was just hardened to source everything else from
  // `d.self` / `selfAdo` — so its guard is load-bearing, not decorative.
  //
  // Each uses a remote that CLEARS the fence (self remote + self repoRef), which
  // is what lets the case reach the guard at all; a cross-repo target would be
  // refused earlier and the case would instrument the fence again instead.
  {
    name: "gh/non-numeric-pr-id-refuses",
    mutation:
      "vcs-github-adapter.js::completeUpflowPR — delete the `PR_NUMBER_RE.test(String(prId))` prId guard block",
    repo: { dirName: "kailash-coc-rs", remote: GH_SELF_REMOTE },
    adapter: GH,
    // Path traversal in the PR-number position: with the guard gone this
    // interpolates into `repos/<o>/<n>/pulls/<HERE>/merge` and the request
    // addresses a different repo's PR than the fence just authorized.
    prRef: { repoRef: GH_SELF, prId: "77/../../repos/other/x/pulls/1" },
    expect: { ok: false, fired: false },
    expectReason: "prId must match /^[0-9]+$/ (PR number)",
  },
  {
    name: "gh/invalid-merge-method-refuses",
    mutation:
      "vcs-github-adapter.js::completeUpflowPR — delete the `MERGE_METHOD_RE.test(mergeMethod)` guard block",
    repo: { dirName: "kailash-coc-rs", remote: GH_SELF_REMOTE },
    adapter: GH,
    // `mergeMethod` reaches the request BODY rather than the path, so this is
    // the enum guard rather than a traversal one. No pre-existing case passed
    // `mergeMethod` at all, so the whole guard was un-instrumented.
    prRef: { repoRef: GH_SELF, prId: 77, mergeMethod: "force-push" },
    expect: { ok: false, fired: false },
    expectReason: "mergeMethod must be one of merge|squash|rebase",
  },
  {
    name: "ado/non-numeric-pr-id-refuses",
    mutation:
      "vcs-azure-adapter.js::completeUpflowPR — delete the `ADO_PR_ID_RE.test(String(prId))` prId guard block",
    repo: { dirName: "coc-rs", remote: ADO_SELF_REMOTE },
    adapter: ADO,
    prRef: {
      repoRef: ADO_SELF,
      prId: "42/../../pullrequests/1",
    },
    expect: { ok: false, fired: false },
    // "(PR id)" not "(PR number)" — the two providers' guards word the tail
    // differently, so this also pins WHICH adapter refused.
    expectReason: "prId must match /^[0-9]+$/ (PR id)",
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * The string `expectReason` is matched against: the adapter's short `_fail`
 * label joined to its long reason. Substring/RegExp, never whole-sentence — see
 * the header.
 */
function refusalBlob(out) {
  return [out.label, out.reason].filter(Boolean).join(" | ");
}

function reasonMatches(expectReason, blob) {
  if (expectReason === undefined) return true;
  return expectReason instanceof RegExp
    ? expectReason.test(blob)
    : blob.includes(expectReason);
}

let failed = 0;
for (const c of cases) {
  let made = null;
  let decoy = null;
  try {
    made = makeRepo(c.repo);
    // `c.decoyRepo` builds a SECOND repo and points the child's ambient
    // `GIT_DIR` at it. Used only by the ambient-GIT_DIR probe.
    let extraEnv;
    let prRef = c.prRef;
    if (c.decoyRepo) {
      decoy = makeRepo(c.decoyRepo);
      if (c.decoyMode === "git-dir") {
        extraEnv = { GIT_DIR: path.join(decoy.repo, ".git") };
      } else if (c.decoyMode === "descriptor-seam") {
        // Inject the ONCE-REMOVED caller-authored identity seams onto the
        // descriptor, pointed at the decoy. The decoy path only exists at
        // runtime, so it cannot be written into the static case.
        prRef = {
          ...c.prRef,
          cwd: decoy.repo,
          selfRepoRef: { owner: "terrene-foundation", name: "kailash-coc-claude-py" },
          _deriveSelfFn: "__must_be_ignored__",
        };
      }
    }
    const out = runInRepo(made.repo, c.adapter, prRef, extraEnv);
    const blob = refusalBlob(out);
    const reasonOk = reasonMatches(c.expectReason, blob);
    // `expectEndpoint` pins the request path the adapter actually built. Only
    // meaningful on ALLOW cases whose `repoRef` differs in BYTES from the
    // derived identity (mixed case, `.git` suffix) — everywhere else the two
    // are identical and the assertion cannot discriminate.
    const endpointOk =
      c.expectEndpoint === undefined
        ? true
        : c.expectEndpoint instanceof RegExp
          ? c.expectEndpoint.test(String(out.endpoint || ""))
          : String(out.endpoint || "").includes(c.expectEndpoint);
    const pass =
      out.ok === c.expect.ok &&
      out.fired === c.expect.fired &&
      out.error === null &&
      reasonOk &&
      endpointOk;
    if (pass) {
      console.log(`  ✓ ${c.name}`);
    } else {
      failed++;
      console.log(
        `  ✗ ${c.name}` +
          `\n      expected ok=${c.expect.ok} fired=${c.expect.fired} error=null` +
          (c.expectReason === undefined
            ? ""
            : `\n      expected reason to contain: ${c.expectReason}`) +
          `\n      actual   ok=${out.ok} fired=${out.fired} error=${out.error}` +
          (reasonOk ? "" : `\n      WRONG REFUSAL BRANCH`) +
          (endpointOk
            ? ""
            : `\n      WRONG ENDPOINT — expected to contain: ${c.expectEndpoint}` +
              `\n      actual endpoint: ${out.endpoint || "(none)"}`) +
          `\n      reason:  ${blob || "(none)"}`,
      );
    }
  } catch (err) {
    failed++;
    console.log(`  ✗ ${c.name} — THREW: ${err && err.message}`);
  } finally {
    if (made) fs.rmSync(made.root, { recursive: true, force: true });
    if (decoy) fs.rmSync(decoy.root, { recursive: true, force: true });
  }
}

console.log(
  failed === 0
    ? `\nupflow-open-never-complete: ${cases.length}/${cases.length} PASS`
    : `\nupflow-open-never-complete: ${failed}/${cases.length} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
