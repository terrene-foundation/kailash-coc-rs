/**
 * upflow-self-repo.js — derive THIS repo's own identity for the
 * `upstream-issue-hygiene.md` MUST-4 ("Open, Never Complete") fence.
 *
 * WHY THIS MODULE EXISTS. The first cut of the MUST-4 fence took `selfRepoRef`
 * as a DESCRIPTOR FIELD and compared it against `repoRef` — but both operands
 * then came off the same caller-authored object, so `{repoRef: X, selfRepoRef: X}`
 * cleared it trivially. Deriving the identity from the environment rather than
 * accepting it from the caller is NECESSARY for the fence to mean anything —
 * and it is not SUFFICIENT to make the identity unforgeable, which this module
 * does not attempt and cannot achieve (see the bound below).
 *
 * TWO LATER ROUNDS EACH *MOVED* THE CALLER-AUTHORED OPERAND INSTEAD OF REMOVING
 * IT — `selfRepoRef` became a `_deriveSelfFn` injection seam, then a `cwd` field.
 * Either one still let a caller choose the answer: substituting the deriver is
 * self-evident, and pointing `cwd` at a scratch directory holding a forged
 * `.claude/VERSION` and no git remote made the dirname fallback in
 * `version-utils.js::readRepoIdentity` yield `slug: null`, at which point the
 * forged declaration was the only slug left and the fence returned `ok:true` on
 * an arbitrary upstream. Both seams are now GONE, in production and in tests:
 * `deriveSelfRepoRef` takes exactly one parameter, and the adapters hardcode
 * `process.cwd()`.
 *
 * WHAT IS AUTHORITATIVE, AND WHAT IS NOT.
 *   - The LIVE GIT REMOTE (`git -C <cwd> remote get-url origin`) is the SOLE
 *     source of the identity. If it cannot be read, or does not parse to an
 *     owner/name pair, the fence REFUSES. There is deliberately NO dirname
 *     fallback: a directory name is caller-chosen, and that fallback was the
 *     exploit path above.
 *   - `.claude/VERSION::repo` is a CROSS-CHECK ONLY. It can REFUSE (when it
 *     disagrees with the remote) but it can NEVER SUPPLY the identity. A forged
 *     VERSION file is therefore powerless — the worst it can do is deny a
 *     completion, which is the safe direction.
 *
 * WHAT THIS IS AND IS NOT EVIDENCE OF (`instrument-discipline.md` MUST-1 asks
 * what result the instrument would produce if the proposition were false). This
 * refuses any completion whose target does not match the identity derived from
 * the working tree the process runs in. That CLOSES the accident class — which
 * IS the originating incident — and raises the cost of a deliberate act, since
 * the caller must now stand up a tree whose origin remote names the upstream
 * rather than fill in a field. It is NOT a boundary against a caller that can
 * choose its own working directory: `process.cwd()` is selected by whoever
 * launches the process, so a scratch tree with `origin` pointed at the upstream
 * derives that upstream and clears the fence. It cannot be such a boundary — a
 * caller running arbitrary code in-process can replace this module outright.
 * Removing the descriptor seams was still correct: they were forgeable by
 * writing one object literal, which is not the same cost at all.
 *
 * ONE SHARED HELPER, NOT PER-CALL-SITE (`security.md` § Credential Decode Helpers):
 * both VCS adapters route through this, so the two providers cannot normalize
 * differently — the drift shape `security.md` § Enforcement-Surface Parity blocks.
 */

const path = require("path");
const { execFileSync } = require("child_process");
const { resolveGitBinary, gitEnv } = require("./git-subprocess-env.js");

/**
 * Normalize one repo-identity component the SAME way `version-utils.js::
 * declaredSelfRepo` does — lowercase, strip a trailing `.git`, drop ADO `_git`
 * routing segments. Divergent normalization between the derivation source and
 * the comparator produced a FALSE "cross-repo" refusal against a maintainer
 * whose repoRef was built from a remote URL (`.git` retained) — fail-closed,
 * but it accused them of the exact violation they were not committing.
 */
function normalizeComponent(v) {
  if (v === undefined || v === null) return null;
  const raw = String(v);
  // Repo-identity components are ASCII on both providers, per the validators
  // that already gate them — each quoted from its source, since the ASCII
  // property is the only thing claimed here and a mis-attributed pattern would
  // hide which component permits what:
  //   github-login.js:33 GITHUB_LOGIN_RE   /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/
  //   github-login.js:37 GITHUB_REPO_RE    /^[a-zA-Z0-9._-]{1,100}$/
  //   ado-login.js:52    ADO_ORG_RE        /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/
  //   ado-login.js:61-62 ADO_PROJECT_RE / ADO_REPO_RE  /^[A-Za-z0-9._-]{1,64}$/
  // Note ADO_ORG_RE admits NEITHER dots NOR underscores and caps at 63 — it is
  // materially tighter than the project/repo pattern, so no VALIDATOR-GATED org
  // can carry a `.git` suffix for the strip below to act on. Stated with that
  // qualifier because the unqualified form was false on the half that matters:
  // the DERIVED org comes from an ungated URL path segment (`_parseAdo` reads
  // `segs[0]`), so `https://dev.azure.com/foo.git/proj/_git/repo` DOES reach
  // the strip and derives org `foo`. Inert in practice — ADO forbids dots in
  // org names, so no such org exists, and the derived value is what the request
  // is addressed to either way — but this file's standard is precise claims,
  // and it has already had to correct two comments that asserted more than the
  // code guaranteed. All five are ASCII-only,
  // which is the property this guard rests on. Reject non-ASCII BEFORE lowercasing to close the
  // locale-aware
  // case-fold surface — Turkish "İ".toLowerCase() resolves to "i" on
  // locale-aware engines, and U+212A KELVIN SIGN lowercases to ASCII "k" under
  // Unicode default case-folding, so a non-ASCII component could otherwise
  // compare equal to an ASCII one. Node's `.toLowerCase()` is
  // locale-INDEPENDENT, but the guard makes the property structural rather than
  // engine-dependent — the same guard `github-login.js::normalizeLogin` and
  // `ado-login.js::normalizePrincipal` carry. Zero-length input needs no
  // separate guard here: the trailing `s && ...` below already returns null.
  // eslint-disable-next-line no-control-regex
  if (!/^[\x00-\x7f]*$/.test(raw)) return null;
  const s = raw
    .trim()
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
  // PATH-SHAPE REJECTION, and it must come AFTER the `.git` strip because the
  // strip is what CREATES the dangerous value: `"...git"` -> `".."`. Both sides
  // of every comparison normalize identically, so a `..` would clear the fence
  // and then reach an interpolated request path. On ADO that is a repo-scope
  // ESCAPE — `${org}/${project}/_apis/git/repositories/../pullrequests/${id}`
  // collapses to the PROJECT-scoped PR address, which is not scoped to any
  // repository, and `ADO_REPO_RE`/`ADO_PROJECT_RE` both permit dots so
  // `"...git"` is a valid caller value. `security.md` § Path Containment: test
  // the canonical form, then USE the canonical form — a `..` surviving the
  // canonicalization is exactly the containment miss that section blocks.
  // Note both adapters already guard `..` on `head`/`base` (BODY positions);
  // the repo components reach PATH positions and were unguarded.
  if (s === "." || s === ".." || s.includes("/") || s.includes("\\"))
    return null;
  // POSITIVE ALLOWLIST, replacing what was a four-member denylist (`.`, `..`,
  // `/`, `\`). Everything else in the `\x00-\x7f` range the ASCII guard admits
  // used to survive to an interpolated request path — `?` and `#` (which
  // TERMINATE a path: `.../repositories/repo?x=1/pullrequests/5` addresses
  // `repo` with the rest as query string), percent-encoded separators (`%2e%2e`
  // reconstitutes `..` under RFC 3986 §6.2.2.2 normalization at any server or
  // proxy that decodes), and raw control bytes (`\x00`, `\r`, `\n`).
  //
  // Measured, so the change is not theoretical: an origin of
  // `https://dev.azure.com/org/proj/_git/repo?x=1` derived `ado.repo` as
  // `"repo?x=1"` before this line existed.
  //
  // REACHABILITY WAS ALREADY CLOSED, and this is defense-in-depth, stated so no
  // reader mistakes it for a live-bug fix: both adapters call `validateRepoRef`
  // as their FIRST statement, and the fence requires the derived component to
  // COMPARE EQUAL to a `repoRef` component that has passed GITHUB_REPO_RE /
  // ADO_REPO_RE — neither of which admits any of these bytes. So the dangerous
  // derived value could never match a caller value and always refused. That
  // safety depended on a SECOND module's regex staying strict; the allowlist
  // here makes it a property of this function.
  //
  // The set is the UNION of what the providers' validators accept across the
  // component classes quoted above — `GITHUB_LOGIN_RE` and `ADO_ORG_RE` admit
  // neither `.` nor `_`, so the intersection would be narrower and would reject
  // legitimate repo names. UNION is what the safety argument below actually
  // needs (no legitimate component is refused); an earlier draft said
  // "INTERSECTION", which named the wrong set for a correct conclusion.
  // (`[A-Za-z0-9._-]`, quoted with line numbers above), so no legitimate owner,
  // name, org, project, or repo is affected. A denylist would have to enumerate
  // every future dangerous byte; this closes the class (`cc-artifacts.md`
  // Rule 10 — positive allowlists where the vocabulary is enumerable).
  if (!/^[A-Za-z0-9._-]+$/.test(s)) return null;
  return s && s !== "_git" ? s : null;
}

/**
 * Read the origin remote URL. Returns null on ANY failure (no remote, not a git
 * repo, git unresolvable, timeout) — the caller turns that into a refusal.
 *
 * ROUTED THROUGH THE SHARED GIT ALLOWLIST (`git-subprocess-env.js`), as the
 * three sibling guards (`violation-patterns.js`, `guard-path-scope.js`,
 * `coordination-mode.js`) already are — `security.md` § Enforcement-Surface
 * Parity: a fail-closed dimension lands at EVERY surface through ONE shared
 * function, or the un-routed surface becomes the bypass.
 *
 * Two things the routing buys, and this fence needs BOTH:
 *   - `gitEnv()` builds the child's environment from constants, so NOTHING is
 *     inherited. `GIT_DIR` outranks repository DISCOVERY, so neither `cwd:` nor
 *     `-C <path>` pins WHICH repository git resolves — an ambient `GIT_DIR`
 *     pointing at a clone of the upstream would otherwise make this derivation
 *     return the UPSTREAM's slug, which is a fence bypass, not a nuisance.
 *   - `resolveGitBinary()` returns an ABSOLUTE path, so the spawn itself performs
 *     no PATH lookup. Stated precisely, because an earlier draft of this comment
 *     claimed it "removes the PATH lookup" outright and that is stronger than the
 *     code: `git-subprocess-env.js::resolveGitBinary` tries a FIXED CANDIDATE LIST
 *     first and falls back to `_resolveViaPath(process.env.PATH)` (`:156`) when no
 *     candidate resolves — which is the normal case on nix / asdf / conda / Scoop
 *     hosts. So PATH still selects the binary on those hosts; what is removed is
 *     the lookup at spawn time, not PATH's role in resolution. A PATH-planted
 *     `git` defeats the fence regardless of the env, which the next paragraph's
 *     in-process bound already covers.
 *
 * An unresolvable git returns null → the caller's typed refusal. That is the
 * TIGHTEST ranking the shared module's caller contract requires: git that
 * cannot answer is INDETERMINATE, never a clean derivation.
 */
function _readOriginRemote(cwd) {
  // CLEAR FIRST. `_lastGitStderr` is module-scope and was assigned ONLY in the
  // catch below, never reset — so a later call that returned null through a
  // branch which sets nothing (`!gitBin`, or empty stdout) left the PREVIOUS
  // call's stderr standing, and `deriveSelfRepoRef` spliced it into a refusal as
  // `git said: …`. That states, in the grammar of an observation, something git
  // never said on THAT call, about a repo it was never asked about
  // (`evidence-first-claims.md` MUST-4) — and it re-emits operator-environment
  // text from an unrelated directory into a second refusal `reason` that
  // `/codify` Step-7c may embed in a journal or PR body
  // (`user-flow-validation.md` MUST-6). Production runs one-shot per node
  // invocation so the multi-call precondition is not met there, but the
  // differential oracle drives ~30 URLs in ONE process, which is shipped code.
  _lastGitStderr = null;
  const gitBin = resolveGitBinary();
  if (!gitBin) return null;
  try {
    const out = execFileSync(gitBin, ["remote", "get-url", "origin"], {
      cwd,
      encoding: "utf8",
      // stderr is CAPTURED, not discarded. It was `"ignore"`, which collapsed
      // every git failure into one reason string naming three causes — and the
      // most common real cause in a container or on a shared machine is a
      // FOURTH the message never named: `detected dubious ownership`
      // (safe.directory). A maintainer hitting that was sent looking for a
      // missing remote they actually have. The bytes are surfaced by the caller,
      // truncated; see `_readOriginRemote`'s return contract below.
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 3000,
      env: gitEnv(),
    });
    const s = typeof out === "string" ? out.trim() : "";
    return s || null;
  } catch (err) {
    // Return the FIRST stderr line so the refusal can name what git said.
    // Bounded to 200 chars and newline-free: this string reaches a refusal
    // `reason` that is logged, and an unbounded echo of subprocess output is a
    // log-injection surface. It carries no remote URL — git's ownership and
    // not-a-repo errors name a PATH, and the URL-bearing errors are not on this
    // failure path — but it IS operator-environment text, so it is truncated
    // rather than trusted (`security.md` § "No secrets in logs" is about
    // credentials; this is the adjacent hygiene).
    const raw =
      err && typeof err.stderr === "string"
        ? err.stderr
        : err && err.stderr
          ? String(err.stderr)
          : "";
    const first = raw.split("\n").find((l) => l.trim());
    _lastGitStderr = first ? first.trim().slice(0, 200) : null;
    return null;
  }
}

// Set by `_readOriginRemote` on failure; read once by `deriveSelfRepoRef` to
// enrich its refusal. Module-scope because the failure and the message are two
// frames apart and threading a second return value would change the helper's
// contract for every caller. Deliberately NOT part of any security decision —
// it is diagnostic text only, never an operand.
let _lastGitStderr = null;

/**
 * Split a remote URL into `{host, segments}`. Handles `scheme://host/path` and
 * scp-style `git@host:path`.
 *
 * The returned `host` is the authority with things removed in this order:
 * anything from the first `#` or `?` onward — ON THE SCHEME BRANCH ONLY, see
 * below — then userinfo (everything through the last `@`), then the port, then
 * case.
 *
 * THE CUT IS SCHEME-BRANCH-ONLY, and stating it unconditionally here was wrong
 * for every scp remote. It models CURL, which git uses for http/https; OpenSSH
 * has no such terminator and splits user@host at the last `@`. Applying it to
 * the scp branch put the decoy in the RETAINED host and the real host in the
 * discarded userinfo — the measured `git@github.com#@evil.com:o/r` defect.
 * On the scheme branch the cut MUST precede the userinfo split — see the comment on
 * it. Returns null when no host is present (a bare local path is not a hosting
 * identity) or when the authority is empty after the cuts.
 */
function _splitRemoteUrl(url) {
  const s = String(url || "").trim();
  if (!s) return null;

  let authority;
  let rest;
  // The scheme MUST be ANCHORED at the start. An unanchored `indexOf("://")`
  // finds the first `://` ANYWHERE, including one sitting in the PATH of an
  // scp-style remote, and then reads the authority out of the middle of the
  // string: `evil.com:x/https://github.com/o/r` yielded authority `github.com`
  // (measured: `indexOf("://")` = 16) and cleared a caller's host check on a
  // remote whose real host is `evil.com`. That is the SAME check-vs-use
  // divergence the fragment/query cut below exists to prevent, reached by a
  // different route, so it is closed the same way — structurally, at the parse.
  // Anchoring sends that input to the scp-style branch, where the authority is
  // `evil.com` and the provider host check then refuses. Scheme charset is
  // RFC-3986 (`ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )`).
  // The `#`/`?` authority cut belongs to the SCHEME branch ONLY, because it
  // models CURL's parsing — and curl is what git uses for https. Applying it to
  // the scp-style branch models nothing: OpenSSH does not treat `#`/`?` as
  // authority terminators at all. An earlier revision applied the cut to BOTH
  // branches and justified it in prose that had the operand order backwards; it
  // claimed cutting an scp authority "yields `evil.com` where ssh would connect
  // to `github.com` — a DISAGREEMENT that resolves as a refusal". The opposite
  // happened, because the cut runs BEFORE the userinfo split, so the `#` payload
  // lands in the DISCARDED userinfo and the RETAINED host is the decoy:
  //
  //   git@github.com#@evil.com:org/repo      (well-formed scp-style; git accepts it)
  //     cut at `#`      -> "git@github.com"
  //     lastIndexOf("@")-> host "github.com"   <- fence reads GITHUB
  //     ssh -G          -> host evil.com       <- ssh CONNECTS to EVIL  (measured)
  //
  // That is strictly worse than the unanchored-scheme defect fixed alongside it:
  // that one produced a URL `git ls-remote` REFUSES, so nothing was reachable,
  // whereas this remote is well-formed and FETCHES. Scoping the cut to the
  // scheme branch makes each branch model its OWN resolver: the scp branch now
  // splits at the last `@` exactly as OpenSSH does, so the authority above
  // resolves to `evil.com` and the provider host check refuses.
  let isSchemeForm = false;
  const schemeMatch = s.match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//);
  if (schemeMatch) {
    isSchemeForm = true;
    const afterScheme = s.slice(schemeMatch[0].length);
    const firstSlash = afterScheme.indexOf("/");
    authority =
      firstSlash === -1 ? afterScheme : afterScheme.slice(0, firstSlash);
    rest = firstSlash === -1 ? "" : afterScheme.slice(firstSlash + 1);
  } else if (s.includes(":")) {
    const colon = s.indexOf(":");
    authority = s.slice(0, colon);
    rest = s.slice(colon + 1);
  } else {
    return null; // bare filesystem path — no host, not a hosting identity
  }

  // SCHEME FORM ONLY: terminate the authority at the first `#` or `?`, BEFORE
  // the userinfo split below. curl ends the authority at either character, so
  // `https://evil.com#@github.com/o/r` resolves EVIL.COM; without this cut the
  // `lastIndexOf("@")` below would take `github.com` as the host and a caller's
  // host check would pass on a URL git resolves elsewhere. Neither provider's
  // real authorities contain these characters, so no legitimate remote is
  // affected.
  if (isSchemeForm) {
    const authCut = authority.search(/[#?]/);
    if (authCut !== -1) authority = authority.slice(0, authCut);
  }

  // Both forms split userinfo at the LAST `@` — RFC 3986 for the scheme form,
  // OpenSSH's own rule for the scp form (verified: `ssh -G git@github.com#@evil.com`
  // prints `host evil.com`, `user git@github.com#`).
  const at = authority.lastIndexOf("@");
  if (at !== -1) authority = authority.slice(at + 1);

  // ASCII GUARD ON THE HOST, symmetric with `normalizeComponent`'s. The host is
  // an identity operand compared against closed sets (`GITHUB_HOSTS`,
  // `isAdoHost`), exactly like the components — but it was the ONE such operand
  // reaching `.toLowerCase()` with no ASCII precheck, so the locale/case-fold
  // surface that guard exists to close was open here. Placed AFTER the userinfo
  // split on purpose: userinfo is discarded and may legitimately be non-ASCII,
  // so guarding the whole authority would refuse remotes that are fine.
  //
  // NOT A LIVE BYPASS TODAY, and this is not claimed as one. The only code
  // points whose `.toLowerCase()` yields a pure-ASCII letter are U+212A KELVIN
  // SIGN → "k" and U+212B ANGSTROM SIGN → "å" (itself non-ASCII); U+0130 yields
  // "i"+U+0307, two code units, so it cannot forge "i". No member of the current
  // host sets contains a "k", so nothing is forgeable at this commit.
  //
  // It is closed anyway because THIS FILE'S OWN STANDARD, stated at the IPv6
  // comment below, is that "safe-by-accident becomes a bypass the moment a
  // caller compares hosts differently" — and `vcs-github-adapter.js` explicitly
  // schedules that change ("A GHES deployment adds its appliance host here").
  // A GHES appliance host containing "k" (`github.k8s.corp`) is forgeable by
  // `github.<U+212A>8s.corp`, which lowercases into the set while git and ssh
  // resolve the distinct IDN host. The guard is what makes the property
  // structural rather than a coincidence of the current set's spelling.
  // eslint-disable-next-line no-control-regex
  if (!/^[\x00-\x7f]*$/.test(authority)) return null;

  // No trailing-dot normalization is applied, and that is deliberate: DNS
  // treats `github.com.` as the same absolute name, but this returns it
  // verbatim, so it does not match a caller's host set and the derivation
  // REFUSES. That is the fail-closed direction and is intended — do not "fix"
  // it by stripping the dot without re-checking every host-set comparison.
  // IPv6 literals are BRACKETED, and the port split below is colon-delimited —
  // so a naive `split(":")[0]` returns `"["` for `https://[::1]/o/r`, which is
  // not a host at all. Take the bracketed span whole, then any `:port` after
  // the closing bracket. Found by a differential check against the real
  // resolvers (`ssh -G` for scp forms, WHATWG `URL` for scheme forms), which
  // reported derived `[` vs oracle `[::1]`.
  //
  // The OUTCOME was already safe — `[` matches no entry in GITHUB_HOSTS and is
  // not an ADO host, so the fence refused — and neither provider serves an IPv6
  // literal, so this refuses either way. It is corrected because a
  // known-INCORRECT parse is what each of this PR's three host defects began as:
  // safe-by-accident becomes a bypass the moment a caller compares hosts
  // differently. Parity with the resolver is the property; the refusal is a
  // consequence, not the guarantee.
  let host;
  if (authority.startsWith("[")) {
    const close = authority.indexOf("]");
    if (close === -1) return null; // unterminated literal — refuse
    host = authority
      .slice(0, close + 1)
      .trim()
      .toLowerCase();
  } else {
    host = authority.split(":")[0].trim().toLowerCase();
  }
  if (!host) return null;

  const segments = String(rest)
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;
  return { host, segments };
}

/**
 * Azure DevOps identity from a parsed remote, or null when the remote is not
 * ADO-shaped. Forms handled — FIVE, and this list is load-bearing: an earlier
 * four-entry version of it omitted the collection form, a fix was written
 * against the short list, and it REGRESSED that form into a maintainer lockout.
 * Keep this in sync with the inline count block in the body.
 *   https://dev.azure.com/<org>/<project>/_git/<repo>
 *   https://<org>@dev.azure.com/<org>/<project>/_git/<repo>
 *   https://<org>.visualstudio.com/<project>/_git/<repo>
 *   https://<org>.visualstudio.com/<collection>/<project>/_git/<repo>  (legacy)
 *   git@ssh.dev.azure.com:v3/<org>/<project>/<repo>
 * `vs-ssh.visualstudio.com` takes the org-from-path branch, NOT the subdomain
 * one (it is excluded explicitly), so it follows the ssh/v3 shape.
 *
 * This parses ADO SEPARATELY on purpose. `version-utils.js::
 * normalizeRemoteIdentity` keeps only the LAST TWO path segments and drops
 * `_git`, which structurally loses `<org>` — so an ADO fence built on it could
 * never compare org at all.
 */
function _parseAdo(host, segments) {
  const isAdoHost =
    host === "dev.azure.com" ||
    host === "ssh.dev.azure.com" ||
    host === "vs-ssh.visualstudio.com" ||
    host.endsWith(".visualstudio.com");
  if (!isAdoHost) return null;

  let segs = segments.slice();
  if (segs[0] && segs[0].toLowerCase() === "v3") segs = segs.slice(1);
  segs = segs.filter((p) => p.toLowerCase() !== "_git");

  // KNOWN DEFECT, NOT FIXED — recorded because the obvious fix is wrong and I
  // could not establish the right one. Only `_git` is filtered, so ADO's OTHER
  // routing segment `_ssh` is treated as a NAME. Measured:
  //   ssh://acct@vs-ssh.visualstudio.com:22/Proj/_ssh/Repo
  //     -> {org: "proj", project: "_ssh", repo: "repo"}     <- MIS-DERIVED
  // The 4-segment collection variant refuses on the count, so only the
  // 3-segment form mis-derives.
  //
  // Filtering `_ssh` alongside `_git` does NOT fix it — traced, and it trades
  // one wrong answer for another: the 3-segment form then refuses (correct),
  // but the 4-segment form becomes ["Collection","Proj","Repo"] and derives
  // org=Collection, which is wrong in a new way. A correct parse needs to know
  // where the org lives in the `_ssh` form, and that is ADO ground truth this
  // repo cannot check.
  //
  // FAIL-CLOSED in effect: the bogus project `_ssh` (or a wrong org) is
  // compared against the caller's `repoRef` and mismatches, so a completion is
  // refused rather than misdirected. Left as a wrong DERIVATION that refuses,
  // which is not the same as a correct refusal — the distinction this file
  // already draws for the 2-segment ambiguity below.
  //
  // Deliberately not guessed at: acting on an incomplete enumeration of ADO
  // URL forms is precisely what caused the collection-form regression this file
  // records above. Settling it needs a real ADO org emitting `_ssh` clone URLs.

  // VALIDATE EVERY SEGMENT BEFORE ANY IS DROPPED. The collection slot below is
  // discarded by `slice(1)`, and until this line it was the ONE position in the
  // whole parser whose content never passed `normalizeComponent` — which made
  // it a junk drawer that let a dirty path clear the count check:
  //
  //   https://realorg.visualstudio.com/realproj#/proj2/_git/repo2
  //     filter -> ["realproj#", "proj2", "repo2"]   3, passes the count
  //     slice  -> ["proj2", "repo2"]                the dirty one is GONE
  //     derived-> {org: realorg, project: proj2, repo: repo2}   (measured)
  //
  // A COMMENT IN THIS FUNCTION PREVIOUSLY CLAIMED THIS COULD NOT HAPPEN — that
  // an injection "would need three CLEAN segments and cannot forge them,
  // because the `#`/`?` necessarily lands ON a segment". False, and refuted by
  // measurement: it never needed three clean segments, only two plus a slot
  // whose contents are thrown away. The claim held for RETAINED slots and was
  // stated as if it held for all of them. Recorded rather than quietly
  // replaced, because a security comment asserting a property the code lacks is
  // the exact defect class this file keeps re-learning.
  //
  // Harm was ~zero — `#` truncates the path at curl and `?` collides with git's
  // own `/info/refs?service=…`, so neither remote is fetchable, and the cwd
  // bound in the module header dominates anyway. Fixed regardless: the IPv6
  // note above refuses to rely on safe-by-accident, and this is the same shape.
  //
  // Validating first also closes the class rather than the instance — anchoring
  // on `_git` position would NOT have, since the junk sits BEFORE the anchor.
  if (segs.some((p) => normalizeComponent(p) === null)) return null;

  let org = null;
  const isOrgSubdomain =
    host.endsWith(".visualstudio.com") && host !== "vs-ssh.visualstudio.com";
  // EXACT counts, same reasoning as the GitHub branch above and the same
  // measured defect: the path is never cut at `#`/`?`, so
  // `.../realorg/realproj/_git/realrepo#/otherproj/otherrepo` filtered to
  // ["realorg","realproj","realrepo#","otherproj","otherrepo"] and the trailing
  // pair won — deriving {org: realorg, project: OTHERPROJ, repo: OTHERREPO},
  // i.e. the real org with an attacker-chosen project/repo, which is what the
  // completion PATCH is then addressed to.
  //
  // After the `v3` strip and `_git` filter the legitimate forms are exact:
  //   dev.azure.com/<org>/<project>/_git/<repo>      -> 3 (org, project, repo)
  //   ssh.dev.azure.com:v3/<org>/<project>/<repo>    -> 3
  //   <org>.visualstudio.com/<project>/_git/<repo>   -> 2 (org comes from host)
  //   <org>.visualstudio.com/<collection>/<project>/_git/<repo> -> 3 (legacy)
  //
  // The legacy collection form is the ONE place a trailing pair is still taken
  // from three segments, and it is safe ONLY BECAUSE every segment — INCLUDING
  // the collection that is about to be discarded — is passed through
  // `normalizeComponent` first, at the validate-before-drop line above. THE TWO
  // ARE COUPLED: relax the allowlist, or move that check after the slice, and
  // this reopens.
  //
  // An earlier version of this comment argued the safety differently and was
  // WRONG. It said an injection "would need three CLEAN segments and cannot
  // produce them, because the `#`/`?` necessarily lands ON a segment". That is
  // true only of RETAINED segments; the discarded collection slot was an
  // unvalidated junk drawer, and `.../realproj#/proj2/_git/repo2` cleared the
  // count with two clean segments and derived proj2/repo2 (measured). The
  // validate-before-drop line is what makes the property real.
  if (isOrgSubdomain) {
    org = host.slice(0, host.indexOf("."));
    // The org-subdomain form takes an OPTIONAL leading COLLECTION segment:
    //   <org>.visualstudio.com/<project>/_git/<repo>                    -> 2
    //   <org>.visualstudio.com/DefaultCollection/<project>/_git/<repo>  -> 3
    // The second is the legacy TFS/VSTS collection URL and is a REAL form.
    // Recorded because a first cut of this exactness fix required exactly 2 and
    // REGRESSED it — that remote derived correctly before the fix and refused
    // after, locking out any maintainer still on a collection URL. It was
    // caught by widening the legitimate-form check, not by review; the
    // enumeration this fix was written against listed four forms and this was
    // not among them.
    //
    // KNOWN AMBIGUITY IN THE 2-SEGMENT CASE, measured and recorded because it
    // cannot be resolved from the URL alone. ADO permits OMITTING the project
    // segment when the project and repository names match, so a 2-segment
    // subdomain path is genuinely ambiguous:
    //   <org>.visualstudio.com/<project>/_git/<repo>     -> [project, repo]
    //   <org>.visualstudio.com/<collection>/_git/<repo>  -> [collection, repo]
    // Both filter to two segments and nothing in the string distinguishes them.
    // This code takes the first reading, so a project-omitted URL DERIVES THE
    // COLLECTION AS THE PROJECT — measured:
    //   .../DefaultCollection/_git/repo -> {project: "defaultcollection", ...}
    // which is wrong.
    //
    // PRE-EXISTING, not introduced by the collection allowance above: the old
    // last-two rule produced the identical pair. It is FAIL-CLOSED in effect —
    // the wrong project is then compared against the caller's `repoRef.project`
    // and mismatches, so the completion is refused rather than misdirected —
    // but it is a wrong derivation, not a correct refusal, and the distinction
    // matters to anyone reading a refusal reason that names a project they
    // never used. Resolving it needs a signal outside the URL (an API lookup),
    // which this module deliberately does not do.
    if (segs.length !== 2 && segs.length !== 3) return null;
    if (segs.length === 3) segs = segs.slice(1); // drop the collection
  } else {
    // NOT INDEPENDENTLY LOAD-BEARING, and measured to be so rather than
    // assumed. Relaxing this line alone to `< 3` reds NOTHING — the suite stays
    // fully green — because everything it then admits is refused by the
    // `segs.length !== 2` gate below: that gate demands `n - 1 === 2`, i.e.
    // `n === 3`, which is what this line already enforces. So this is a
    // defensive restatement, not a tested guard, and a reader must not cite a
    // green suite under a mutation here as evidence the ADO count is
    // instrumented. Per `instrument-discipline.md` MUST-2(b) a non-reddening
    // mutation leaves two live hypotheses — vacuous test OR inert mutation —
    // and this one is resolved as INERT by the arithmetic above.
    //
    // (An earlier revision of this comment cited "the suite stays 35/35". The
    // suite was 35 cases when that was written and grew the next commit; the
    // bare count decayed while the claim around it stayed true. Stated as a
    // property now, so there is no number left to go stale — the same remedy
    // the fixture README prescribes for itself.)
    //
    // THE PAIR (this line AND the gate below) IS THE HONEST MUTATION, and as of
    // this commit it is INSTRUMENTED — by
    // `ado/exact-segment-count-rejects-all-clean-extra-segments`, which drives
    // an ADO remote whose extra segments are ALL CLEAN. That shape is required:
    // every other ADO multi-segment case carries a DIRTY segment that the
    // validate-before-drop check catches first, so none of them can reach these
    // gates. A previous revision asserted the pair was "how the originating
    // exploit was actually closed", which a reader would take as a claim that
    // the pair was tested; an adversarial round measured it and found the pair
    // redded NOTHING and was VACUOUS, not inert. The claim is recorded here
    // rather than quietly replaced, because a false claim about an instrument
    // in a security comment is the exact class this file has now logged three
    // times.
    if (segs.length !== 3) return null; // exactly org + project + repo
    org = segs[0];
    segs = segs.slice(1);
  }
  // THIS is the load-bearing ADO count gate (see the note above).
  if (segs.length !== 2) return null;

  const ado = {
    org: normalizeComponent(org),
    project: normalizeComponent(segs[segs.length - 2]),
    repo: normalizeComponent(segs[segs.length - 1]),
  };
  if (!ado.org || !ado.project || !ado.repo) return null;
  return ado;
}

/**
 * Parse a remote URL into `{host, owner, name, ado}`. `owner`/`name` are the
 * path's EXACTLY TWO components (ADO: project/repo, matching the shape both
 * adapters compare on); `ado` is populated only for ADO remotes. Said as
 * "exactly two", not "the last two": the body requires the exact count, and the
 * last-two phrasing describes the rule that fragment-injected segments
 * defeated.
 *
 * `host` is RETURNED, not just used internally. It was previously destructured,
 * consulted only for ADO detection, and then discarded — which left `owner/name`
 * as a HOST-FREE pair. A GitHub caller comparing against that pair is asking
 * "does this path match?" and not "on which host?", so an internal mirror at
 * `https://<internal-host>/<org>/<repo>` derived as `<org>/<repo>` and cleared a
 * fence whose merge would then go to github.com/<org>/<repo> — a DIFFERENT repo
 * than the remote names. Mirrors of upstream templates are ordinary, so that is
 * realistic confusion, not only an attack. The host is normalized by
 * `_splitRemoteUrl` — fragment/query cut (SCHEME BRANCH ONLY), userinfo and
 * port stripped, lowercased, in that order (see that function); the
 * PROVIDER-appropriate host check belongs to each adapter, which knows its own
 * host set.
 */
function _parseRemoteUrl(url) {
  const split = _splitRemoteUrl(url);
  if (!split) return null;
  const { host, segments } = split;

  const ado = _parseAdo(host, segments);
  if (ado) return { host, owner: ado.project, name: ado.repo, ado };

  // EXACTLY two segments, not "at least two, take the last two". Every GitHub
  // remote that resolves has exactly two path segments — `https://github.com/o/r[.git]`,
  // `git@github.com:o/r.git`, `ssh://git@github.com/o/r.git`. A "last two" rule
  // silently accepts extra leading segments, and the fragment/query cut applied
  // to the AUTHORITY does not touch the PATH, so anything after a `#`/`?` in the
  // path became segments and the LAST TWO won:
  //
  //   https://github.com/evil/repo#/upstream/repo
  //     segments -> ["evil", "repo#", "upstream", "repo"]
  //     last two -> upstream/repo        <- derived identity
  //     the URL actually names evil/repo
  //
  // Measured, both the `#` and `?` forms. `git ls-remote` REFUSES such a remote
  // (`fatal: .../info/refs not valid`), so it is not fetchable and the capability
  // delta over the module header's disclosed bound is ~zero — it is a PARSE
  // defect, ranked accordingly, not a new privilege. Fixed structurally anyway:
  // exactness closes the whole class in one comparison instead of adding a third
  // cut, and it also refuses a pasted browser URL (`/o/r/tree/main`), which the
  // "last two" rule silently derived as `tree/main`.
  const parts = segments.filter((p) => p.toLowerCase() !== "_git");
  if (parts.length !== 2) return null;
  const owner = normalizeComponent(parts[0]);
  const name = normalizeComponent(parts[1]);
  if (!owner || !name) return null;
  return { host, owner, name, ado: null };
}

/**
 * The slug `.claude/VERSION::repo` DECLARES, normalized, or null when the file
 * is absent, unreadable, unparseable, or declares no owner/name slug. Parsing
 * goes through `version-utils.js::declaredSelfRepo` so the declaration is read
 * by exactly one parser repo-wide.
 *
 * This value is used ONLY to REFUSE on disagreement. It is never a source of
 * identity, so a missing or forged VERSION cannot widen what the fence allows.
 */
function _declaredSlug(cwd) {
  let local;
  try {
    const fs = require("fs");
    local = JSON.parse(
      fs.readFileSync(path.join(cwd, ".claude", "VERSION"), "utf8"),
    );
  } catch {
    return null;
  }
  try {
    const vu = require(path.join(__dirname, "version-utils.js"));
    const declared = vu.declaredSelfRepo(local);
    if (!declared || !declared.slug) return null;
    const parts = String(declared.slug).split("/");
    const owner = normalizeComponent(parts[0]);
    const name = normalizeComponent(parts[1]);
    return owner && name ? `${owner}/${name}` : null;
  } catch {
    return null;
  }
}

/**
 * Derive this repo's OWN identity from the live git remote.
 *
 * `cwd` is the ONLY parameter, in production and in tests: there is no
 * `selfRepoRef` field and no deriver to substitute, so a caller cannot hand this
 * function an answer directly. It can still CHOOSE one. Naming the directory
 * selects WHICH working tree's origin remote is read, and therefore which
 * identity comes back — that is not a leftover seam, it is what this function
 * does. See the module header for what that does and does not make it evidence
 * of.
 *
 * `self.host` is the origin remote's host, normalized by `_splitRemoteUrl`
 * (fragment/query cut on the SCHEME BRANCH ONLY, userinfo and port stripped,
 * lowercased — in that order; on that branch the cut precedes the userinfo
 * split, which is what makes the host agree with what curl resolves. The scp
 * branch takes no cut and splits at the last `@`, which is what makes it agree
 * with ssh). It is carried so a caller can check the identity was derived
 * from a host that provider serves — an owner/name pair alone says nothing about
 * WHERE the repo lives. The check itself belongs to the calling adapter, which
 * knows its own host set; this module does not rank hosts.
 *
 * @param {string} cwd repo directory
 * @returns {{ok:true, self:{host:string,owner:string,name:string,
 *                           ado:{org:string,project:string,repo:string}|null,
 *                           source:"remote"}}
 *          |{ok:false, reason:string}}
 */
function deriveSelfRepoRef(cwd) {
  if (typeof cwd !== "string" || !cwd.trim()) {
    return {
      ok: false,
      reason:
        "no repo directory given, so this repo's own identity cannot be derived; " +
        "refusing to authorize a completion",
    };
  }

  const url = _readOriginRemote(cwd);
  if (!url) {
    return {
      ok: false,
      reason:
        "`git remote get-url origin` yielded no remote for this working tree " +
        `(no origin, not a git repo, dubious ownership, or git unavailable${
          _lastGitStderr ? ` — git said: ${_lastGitStderr}` : ""
        }); the live remote is the ` +
        "only authoritative self-identity and there is deliberately no directory-name " +
        "fallback, so a completion cannot be authorized",
    };
  }

  const parsed = _parseRemoteUrl(url);
  if (!parsed) {
    // The raw URL is NOT echoed — it may carry credentials in userinfo
    // (`security.md` § "No secrets in logs").
    const split = _splitRemoteUrl(url);
    const where = split ? `host ${split.host}` : "no parseable host";
    return {
      ok: false,
      reason:
        `the origin remote does not parse to an owner/name pair (${where}); ` +
        "self-identity is unprovable, refusing to authorize a completion",
    };
  }

  const slug = `${parsed.owner}/${parsed.name}`;
  const declared = _declaredSlug(cwd);
  if (declared && declared !== slug) {
    return {
      ok: false,
      reason:
        `.claude/VERSION::repo (${declared}) disagrees with the origin remote (${slug}); ` +
        "self-identity is unprovable, refusing to authorize a completion",
    };
  }

  return {
    ok: true,
    self: {
      host: parsed.host,
      owner: parsed.owner,
      name: parsed.name,
      ado: parsed.ado,
      source: "remote",
    },
  };
}

/**
 * Does `repoRef` name the SAME repo as the derived self-identity?
 * Both sides go through `normalizeComponent`, so the derivation source and the
 * comparator cannot drift.
 */
function isSelfRepo(repoRef, self) {
  if (!repoRef || !self) return false;
  const a = normalizeComponent(repoRef.owner);
  const b = normalizeComponent(repoRef.name);
  return a !== null && b !== null && a === self.owner && b === self.name;
}

/**
 * ADO shape: {org, project, repo} — all three compared, all three sourced from
 * the DERIVATION (`deriveSelfRepoRef(...).self.ado`). A null/absent `selfAdo`
 * returns false: an origin remote that is not ADO-shaped cannot authorize an
 * ADO completion, and no component may fall back to a value read off `repoRef`.
 */
function isSelfRepoAdo(repoRef, selfAdo) {
  if (!repoRef || !selfAdo) return false;
  for (const k of ["org", "project", "repo"]) {
    const l = normalizeComponent(repoRef[k]);
    const r = normalizeComponent(selfAdo[k]);
    if (l === null || r === null || l !== r) return false;
  }
  return true;
}

module.exports = {
  deriveSelfRepoRef,
  isSelfRepo,
  isSelfRepoAdo,
  normalizeComponent,
};
