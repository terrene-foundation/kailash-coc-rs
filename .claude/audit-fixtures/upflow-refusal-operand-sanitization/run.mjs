#!/usr/bin/env node
/**
 * Audit fixtures — refusal-operand sanitization across the two VCS adapters
 * (GH issue #83).
 *
 * WHAT THIS LOCKS. Every free-form operand interpolated into a `{ok:false,
 * reason}` refusal string in `vcs-github-adapter.js` and `vcs-azure-adapter.js`
 * is (a) run through the SHARED `upflow-self-repo.js::sanitizeForReason`
 * character class, (b) LENGTH-BOUNDED, and (c) for transport-error text,
 * URL-userinfo-SCRUBBED before either. Those reasons are logged and `/codify`
 * Step-7c may embed them in a PR body or a journal entry, so a newline forges a
 * second log line and an escape sequence reaches a terminal a human reads as
 * this tool's own output.
 *
 * WHY `JSON.stringify` WAS NOT ENOUGH, which is the whole point of the suite.
 * Both adapters used `JSON.stringify(x)` as the escaping mechanism at ~45 sites.
 * Per ECMA-262 `QuoteJSONString` it escapes `"`, `\`, and code units BELOW
 * 0x20 (plus lone surrogates since ES2019) — and NOTHING else. It does NOT
 * escape:
 *   - 0x7f DEL
 *   - the C1 range 0x80-0x9f, INCLUDING U+009B 8-bit CSI, an ANSI control
 *     introducer that contains no ESC and therefore passes every ESC-based check
 *   - U+2028 LINE SEPARATOR / U+2029 PARAGRAPH SEPARATOR
 *   - any bidi control (U+202A-U+202E, U+2066-U+2069, U+200E/U+200F, U+061C)
 * Every hostile case below is drawn from exactly that set, so each one is a
 * result `JSON.stringify` alone could not produce — `instrument-discipline.md`
 * MUST-1: the falsifying result is "the payload code point appears verbatim in
 * `reason`", and it DID appear before the fix (README § "RED before").
 *
 * BIPOLAR BY CONSTRUCTION. A sanitizer that destroys everything passes a
 * strip-only suite, and that exact failure already happened on this branch
 * (commit `1a25ee1` — "the parity oracle scored a refuse-everything parser as
 * clean"). So every neutralization case has a preservation twin: a legitimate
 * operand — a readable non-ASCII path, an ordinary ECONNREFUSED message, a small
 * JSON error body, a successful call — must still come through readable and
 * unmangled.
 *
 * HOW IT DRIVES THE ADAPTERS. In-process, with the TRANSPORT injected — that is
 * the network seam, and it is what makes "what did the refusal SAY?" answerable
 * without a live host. Unlike `../upflow-open-never-complete/`, no case here
 * needs a real git repo: every refusal exercised fires either BEFORE the
 * Open-Never-Complete fence (descriptor shape guards) or on a path that never
 * reaches it (`fetchRepoOwner`, `pushImage`, `invalidateCache`, `createUpflowPR`,
 * `createUpflowIssue`). `completeUpflowPR`'s own refusals are already
 * instrumented by that sibling suite; this suite deliberately does not duplicate
 * its subprocess machinery.
 *
 * Every case asserts a TYPED refusal (`ok === false` AND a string `reason`),
 * never merely "did not return ok". A guard deleted mid-function usually throws
 * on `undefined`, and a bare `ok === false` assertion accepts that crash as a
 * refusal.
 *
 * Payload characters are built with `String.fromCharCode`, NEVER as source
 * literals: a raw C1 byte or a bidi override written literally into this file
 * would be invisible to a reviewer — the exact property these guards remove.
 *
 * Layout: inline-case runner (the variant `cc-artifacts.md` Rule 9 sanctions —
 * see `../codex-dispatcher/README.md` § "Fixture layout").
 *
 * Every case records in `mutation:` the specific source change that REDS it.
 * Those mutations were EXECUTED, per `instrument-discipline.md` MUST-2(b): a
 * mutation that does not red leaves TWO live hypotheses (vacuous test OR inert
 * mutation), so an un-run `mutation:` field is a claim, not evidence. README.md
 * § "Mutation validity" records the per-pass method and verdicts.
 *
 * Run: node .claude/audit-fixtures/upflow-refusal-operand-sanitization/run.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(HERE, "..", "..", "hooks", "lib");

const gh = require(path.join(LIB, "vcs-github-adapter.js"));
const ado = require(path.join(LIB, "vcs-azure-adapter.js"));

// ---------------------------------------------------------------------------
// Payloads — built from char codes, never source literals.
//
// Split into TWO sets, and the split is load-bearing:
//   JSON_BLIND  — code points `JSON.stringify` leaves VERBATIM. These are the
//                 only payloads that can discriminate at a site that already
//                 used JSON.stringify as its escape; a \n there would be
//                 escaped by JSON.stringify itself and the case would pass
//                 against the UNFIXED code (a green-before-the-fix case is not
//                 an instrument for the fix).
//   RAW_ALL     — JSON_BLIND plus the C0 members, for the sites with NO
//                 JSON.stringify at all (the `err.message` and bare-`${x}`
//                 interpolations), where even a plain newline survives.
// ---------------------------------------------------------------------------

const DEL = String.fromCharCode(0x7f); // DELETE
const CSI8 = String.fromCharCode(0x9b); // C1 8-bit CSI — ANSI control, no ESC
const NEL = String.fromCharCode(0x85); // C1 NEXT LINE
const PU1 = String.fromCharCode(0x91); // C1 PRIVATE USE ONE (mid-range probe)
const LSEP = String.fromCharCode(0x2028); // LINE SEPARATOR
const PSEP = String.fromCharCode(0x2029); // PARAGRAPH SEPARATOR
const RLO = String.fromCharCode(0x202e); // RIGHT-TO-LEFT OVERRIDE (bidi)
const LRI = String.fromCharCode(0x2066); // LEFT-TO-RIGHT ISOLATE (bidi)
const RLM = String.fromCharCode(0x200f); // RIGHT-TO-LEFT MARK (bidi)
const ALM = String.fromCharCode(0x061c); // ARABIC LETTER MARK (bidi)

const NL = String.fromCharCode(10); // LINE FEED
const CR = String.fromCharCode(13); // CARRIAGE RETURN
const ESC = String.fromCharCode(27); // ESCAPE

/** The set `JSON.stringify` does NOT escape. */
const JSON_BLIND = [DEL, CSI8, NEL, PU1, LSEP, PSEP, RLO, LRI, RLM, ALM];
/** JSON_BLIND plus the C0 members that only reach un-JSON'd interpolations. */
const RAW_ALL = JSON_BLIND.concat([NL, CR, ESC]);

const hex = (c) =>
  `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`;

/** A payload string carrying every member of `set`, wrapped in readable text. */
const laced = (set) => `head${set.join("")}FORGED-SECOND-LINE`;

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/** Typed refusal: ok:false AND a string reason (never a crash read as refusal). */
function typedRefusal(res, where) {
  if (!res || typeof res !== "object") return `${where}: no result object`;
  if (res.ok !== false) return `${where}: expected ok:false, got ok:${res.ok}`;
  if (typeof res.reason !== "string") {
    return `${where}: reason must be a string; got ${typeof res.reason}`;
  }
  return null;
}

/** No member of `set` survives anywhere in `reason`. */
function noneSurvive(reason, set, where) {
  for (const c of set) {
    if (reason.includes(c)) {
      return `${where}: ${hex(c)} survived verbatim in reason: ${JSON.stringify(
        reason.slice(0, 240),
      )}`;
    }
  }
  return null;
}

const REASON_CEILING = 1500; // fixed prose + at most a couple of bounded operands

function bounded(reason, where) {
  return reason.length <= REASON_CEILING
    ? null
    : `${where}: reason is ${reason.length} chars (ceiling ${REASON_CEILING}) — operand not bounded`;
}

/** Drive a refusal and assert BOTH neutralization and boundedness. */
function neutralized(res, set, where) {
  return (
    typedRefusal(res, where) ||
    noneSurvive(res.reason, set, where) ||
    bounded(res.reason, where)
  );
}

// ---------------------------------------------------------------------------
// Transport doubles — the network seam
// ---------------------------------------------------------------------------

/** Never reached (the case refuses at a shape guard first). */
const unreachable = () => {
  throw new Error("transport must not be reached on a shape-guard refusal");
};
/** Throws with a caller-chosen message (the `err.message` class). */
const throwing = (message) => () => {
  throw new Error(message);
};
/** Returns a non-ok response with a caller-chosen body (the remote-body class). */
const failing =
  (body, status = 500) =>
  () => ({ ok: false, status, body });
/** Returns an ok response with a caller-chosen body (the malformed-body class). */
const malformed = (body) => () => ({ ok: true, status: 200, body });
/** Returns an ok, well-shaped response (the happy path). */
const succeeding = (body) => () => ({ ok: true, status: 201, body });

const GH_REPO = { owner: "acme", name: "widget" };
const ADO_REPO = { org: "acme", project: "core", repo: "widget" };

const cases = [];
const t = (name, mutation, fn) => cases.push({ name, mutation, fn });

// ===========================================================================
// A. Caller-supplied descriptor operands — the `JSON.stringify(x)` sites
// ===========================================================================

t(
  "gh/createUpflowPR/head-refusal-neutralizes-json-blind-classes",
  "vcs-github-adapter.js::createUpflowPR — revert the head-invalid reason to `${JSON.stringify(head)}`",
  () =>
    neutralized(
      gh.createUpflowPR(unreachable, {
        repoRef: GH_REPO,
        head: laced(JSON_BLIND),
        title: "t",
      }),
      JSON_BLIND,
      "gh head",
    ),
);

t(
  "gh/createUpflowPR/base-refusal-neutralizes-json-blind-classes",
  "vcs-github-adapter.js::createUpflowPR — revert the base-invalid reason to `${JSON.stringify(base)}`",
  () =>
    neutralized(
      gh.createUpflowPR(unreachable, {
        repoRef: GH_REPO,
        head: "feat/x",
        base: laced(JSON_BLIND),
        title: "t",
      }),
      JSON_BLIND,
      "gh base",
    ),
);

t(
  "gh/createUpflowPR/title-refusal-neutralizes-json-blind-classes",
  "vcs-github-adapter.js::createUpflowPR — revert the title-invalid reason to `${JSON.stringify(title)}`",
  () =>
    // A non-string title is what the guard rejects; an object carrying the
    // payload in a KEY and a VALUE reaches the reason through JSON.stringify.
    neutralized(
      gh.createUpflowPR(unreachable, {
        repoRef: GH_REPO,
        head: "feat/x",
        title: { [laced(JSON_BLIND)]: laced(JSON_BLIND) },
      }),
      JSON_BLIND,
      "gh title",
    ),
);

t(
  "gh/pushImage/workflow-refusal-neutralizes-json-blind-classes",
  "vcs-github-adapter.js::_dispatchWorkflow — revert the workflow-invalid reason to `${JSON.stringify(workflow)}`",
  () =>
    neutralized(
      gh.pushImage(unreachable, {
        repoRef: GH_REPO,
        workflow: laced(JSON_BLIND),
      }),
      JSON_BLIND,
      "gh workflow",
    ),
);

t(
  "gh/applyDeployTarget/ref-and-inputs-refusals-neutralize",
  "vcs-github-adapter.js::_dispatchWorkflow — revert the ref-invalid / inputs-invalid reasons to `${JSON.stringify(...)}`",
  () => {
    const r1 = gh.applyDeployTarget(unreachable, {
      repoRef: GH_REPO,
      workflow: "deploy.yml",
      ref: laced(JSON_BLIND),
    });
    const e1 = neutralized(r1, JSON_BLIND, "gh ref");
    if (e1) return e1;
    const r2 = gh.applyDeployTarget(unreachable, {
      repoRef: GH_REPO,
      workflow: "deploy.yml",
      inputs: [laced(JSON_BLIND)], // array → rejected as not-a-plain-object
    });
    return neutralized(r2, JSON_BLIND, "gh inputs");
  },
);

t(
  "gh/invalidateCache/key-refusal-neutralizes-json-blind-classes",
  "vcs-github-adapter.js::invalidateCache — revert the key-invalid reason to `${JSON.stringify(key)}`",
  () =>
    neutralized(
      gh.invalidateCache(unreachable, {
        repoRef: GH_REPO,
        key: laced(JSON_BLIND),
      }),
      JSON_BLIND,
      "gh cache key",
    ),
);

t(
  "gh/createUpflowIssue/labels-refusal-neutralizes-json-blind-classes",
  "vcs-github-adapter.js::createUpflowIssue — revert the labels-invalid reason to `${JSON.stringify(labels)}`",
  () =>
    neutralized(
      gh.createUpflowIssue(unreachable, {
        repoRef: GH_REPO,
        title: "t",
        labels: [laced(JSON_BLIND), 7], // non-string member → rejected
      }),
      JSON_BLIND,
      "gh labels",
    ),
);

t(
  "gh/fetchCommitVerification/sha-refusal-neutralizes-json-blind-classes",
  "vcs-github-adapter.js::fetchCommitVerification — revert the sha-invalid reason to `${JSON.stringify(sha)}`",
  () =>
    neutralized(
      gh.fetchCommitVerification(unreachable, GH_REPO, laced(JSON_BLIND)),
      JSON_BLIND,
      "gh sha",
    ),
);

t(
  "gh/repoRef-refusal-neutralizes-the-validator-echo",
  "vcs-github-adapter.js::createUpflowPR — interpolate `rv.reason` raw again (github-login.js echoes the raw value via JSON.stringify)",
  () =>
    // The refusal text originates in `github-login.js::validateGithubLogin`,
    // which echoes the rejected value through JSON.stringify. The adapter is the
    // surface that publishes it, so the adapter is where it must be neutralized.
    neutralized(
      gh.createUpflowPR(unreachable, {
        repoRef: { owner: laced(JSON_BLIND), name: "widget" },
        head: "feat/x",
        title: "t",
      }),
      JSON_BLIND,
      "gh repoRef",
    ),
);

t(
  "ado/createUpflowPR/head-and-base-refusals-neutralize",
  "vcs-azure-adapter.js::createUpflowPR — revert the head/base-invalid reasons to `${JSON.stringify(...)}`",
  () => {
    const r1 = ado.createUpflowPR(unreachable, {
      repoRef: ADO_REPO,
      head: laced(JSON_BLIND),
      title: "t",
    });
    const e1 = neutralized(r1, JSON_BLIND, "ado head");
    if (e1) return e1;
    const r2 = ado.createUpflowPR(unreachable, {
      repoRef: ADO_REPO,
      head: "feat/x",
      base: laced(JSON_BLIND),
      title: "t",
    });
    return neutralized(r2, JSON_BLIND, "ado base");
  },
);

t(
  "ado/pushImage/pipeline-ref-inputs-refusals-neutralize",
  "vcs-azure-adapter.js::_runPipeline — revert the pipeline/ref/inputs-invalid reasons to `${JSON.stringify(...)}`",
  () => {
    const r1 = ado.pushImage(unreachable, {
      repoRef: ADO_REPO,
      pipeline: laced(JSON_BLIND),
    });
    const e1 = neutralized(r1, JSON_BLIND, "ado pipeline");
    if (e1) return e1;
    const r2 = ado.applyDeployTarget(unreachable, {
      repoRef: ADO_REPO,
      pipeline: "deploy",
      ref: laced(JSON_BLIND),
    });
    const e2 = neutralized(r2, JSON_BLIND, "ado ref");
    if (e2) return e2;
    const r3 = ado.applyDeployTarget(unreachable, {
      repoRef: ADO_REPO,
      pipeline: "deploy",
      inputs: [laced(JSON_BLIND)],
    });
    return neutralized(r3, JSON_BLIND, "ado inputs");
  },
);

t(
  "ado/createUpflowIssue/workItemType-and-title-refusals-neutralize",
  "vcs-azure-adapter.js::createUpflowIssue — revert the workItemType/title-invalid reasons to `${JSON.stringify(...)}`",
  () => {
    const r1 = ado.createUpflowIssue(unreachable, {
      repoRef: ADO_REPO,
      title: "t",
      workItemType: laced(JSON_BLIND),
    });
    const e1 = neutralized(r1, JSON_BLIND, "ado workItemType");
    if (e1) return e1;
    const r2 = ado.createUpflowIssue(unreachable, {
      repoRef: ADO_REPO,
      title: { [laced(JSON_BLIND)]: 1 },
    });
    return neutralized(r2, JSON_BLIND, "ado title");
  },
);

t(
  "ado/fetchCommitVerification/sha-refusal-neutralizes-json-blind-classes",
  "vcs-azure-adapter.js::fetchCommitVerification — revert the sha-invalid reason to `${JSON.stringify(sha)}`",
  () =>
    neutralized(
      ado.fetchCommitVerification(unreachable, ADO_REPO, laced(JSON_BLIND)),
      JSON_BLIND,
      "ado sha",
    ),
);

t(
  "ado/repoRef-refusal-neutralizes-the-validator-echo",
  "vcs-azure-adapter.js::createUpflowPR — interpolate `rv.reason` raw again (ado-login.js echoes the raw value via JSON.stringify)",
  () =>
    neutralized(
      ado.createUpflowPR(unreachable, {
        repoRef: { org: laced(JSON_BLIND), project: "core", repo: "widget" },
        head: "feat/x",
        title: "t",
      }),
      JSON_BLIND,
      "ado repoRef",
    ),
);

// ===========================================================================
// B. Remote-controlled response bodies — `JSON.stringify(r && r.body)`
// ===========================================================================

t(
  "gh/response-body-refusal-neutralizes-remote-controlled-bytes",
  "vcs-github-adapter.js::fetchRepoOwner — revert the !r.ok reason's body operand to `${JSON.stringify(r && r.body)}`",
  () =>
    // The body is the REMOTE's bytes. Nothing in this repo constrains them, and
    // JSON.stringify escapes none of the classes below.
    neutralized(
      gh.fetchRepoOwner(
        failing({ message: laced(JSON_BLIND), documentation_url: "x" }, 404),
        GH_REPO,
      ),
      JSON_BLIND,
      "gh !ok body",
    ),
);

t(
  "gh/malformed-body-refusal-neutralizes-remote-controlled-bytes",
  "vcs-github-adapter.js::fetchRepoOwner — revert the malformed-response reason's body operand to `${JSON.stringify(r.body)}`",
  () =>
    neutralized(
      gh.fetchRepoOwner(
        malformed({ owner: { name: laced(JSON_BLIND) } }),
        GH_REPO,
      ),
      JSON_BLIND,
      "gh malformed body",
    ),
);

t(
  "gh/collaborators-and-orgadmin-body-refusals-neutralize",
  "vcs-github-adapter.js::listCollaborators / fetchOrgAdmin — revert their body operands to raw `${JSON.stringify(...)}`",
  () => {
    const e1 = neutralized(
      gh.listCollaborators(malformed({ not: laced(JSON_BLIND) }), GH_REPO),
      JSON_BLIND,
      "gh collaborators body",
    );
    if (e1) return e1;
    return neutralized(
      gh.fetchOrgAdmin(
        malformed({ role: 7, note: laced(JSON_BLIND) }),
        GH_REPO,
        "alice",
      ),
      JSON_BLIND,
      "gh orgAdmin body",
    );
  },
);

t(
  "gh/orgadmin-refusal-neutralizes-the-principal-operand",
  "vcs-github-adapter.js::fetchOrgAdmin — interpolate `${principal}` raw into the !r.ok reason again",
  () =>
    // `principal` is interpolated into the reason with NO JSON.stringify at all,
    // so even a bare newline survives here — RAW_ALL, not JSON_BLIND.
    neutralized(
      gh.fetchOrgAdmin(failing({ m: "no" }, 403), GH_REPO, laced(RAW_ALL)),
      RAW_ALL,
      "gh principal",
    ),
);

t(
  "ado/response-body-refusals-neutralize-remote-controlled-bytes",
  "vcs-azure-adapter.js::fetchRepoOwner / listCollaborators — revert their body operands to raw `${JSON.stringify(...)}`",
  () => {
    const e1 = neutralized(
      ado.fetchRepoOwner(
        failing({ message: laced(JSON_BLIND) }, 404),
        ADO_REPO,
      ),
      JSON_BLIND,
      "ado !ok body",
    );
    if (e1) return e1;
    const e2 = neutralized(
      ado.fetchRepoOwner(
        malformed({ name: 7, note: laced(JSON_BLIND) }),
        ADO_REPO,
      ),
      JSON_BLIND,
      "ado malformed body",
    );
    if (e2) return e2;
    return neutralized(
      ado.listCollaborators(malformed({ not: laced(JSON_BLIND) }), ADO_REPO),
      JSON_BLIND,
      "ado members body",
    );
  },
);

t(
  "ado/orgadmin-refusal-neutralizes-the-principal-operand",
  "vcs-azure-adapter.js::fetchOrgAdmin — interpolate `${principal}` raw into the !r.ok reason again",
  () =>
    neutralized(
      ado.fetchOrgAdmin(failing({ m: "no" }, 403), ADO_REPO, laced(RAW_ALL)),
      RAW_ALL,
      "ado principal",
    ),
);

t(
  "gh+ado/response-body-refusals-are-bounded",
  "vcs-github-adapter.js / vcs-azure-adapter.js — drop the length bound from the body operand",
  () => {
    // A remote that returns a megabyte error body produces a megabyte refusal
    // reason, which is then logged and may be embedded in a PR body.
    const huge = { message: "z".repeat(200000) };
    const e1 = typedRefusal(
      gh.fetchRepoOwner(failing(huge, 500), GH_REPO),
      "gh huge body",
    );
    if (e1) return e1;
    const g = gh.fetchRepoOwner(failing(huge, 500), GH_REPO);
    const e2 = bounded(g.reason, "gh huge body");
    if (e2) return e2;
    const a = ado.fetchRepoOwner(failing(huge, 500), ADO_REPO);
    return (
      typedRefusal(a, "ado huge body") || bounded(a.reason, "ado huge body")
    );
  },
);

t(
  "gh/hostile-body-serializer-does-not-crash-the-refusal",
  "vcs-github-adapter.js — drop the try/catch around the body serialization in the reason helper",
  () => {
    // JSON.stringify INVOKES caller/remote-authored `toJSON`, and throws outright
    // on a circular structure or a BigInt. A throw inside the refusal path turns
    // a typed {ok:false, reason} into an uncaught exception — and the sibling
    // fence suite asserts `error === null` precisely because a crash reads as a
    // refusal to any assertion that only checks ok === false.
    const circular = { a: 1 };
    circular.self = circular;
    const e1 = typedRefusal(
      gh.fetchRepoOwner(failing(circular, 500), GH_REPO),
      "gh circular body",
    );
    if (e1) return e1;
    const hostile = {
      toJSON() {
        throw new Error("hostile toJSON");
      },
    };
    const e2 = typedRefusal(
      gh.fetchRepoOwner(failing(hostile, 500), GH_REPO),
      "gh throwing toJSON",
    );
    if (e2) return e2;
    return typedRefusal(
      ado.fetchRepoOwner(failing(circular, 500), ADO_REPO),
      "ado circular body",
    );
  },
);

// ===========================================================================
// C. Transport errors — `err && err.message ? err.message : String(err)`
// ===========================================================================

t(
  "gh/transport-error-refusal-neutralizes-every-raw-class",
  "vcs-github-adapter.js — revert a catch-block reason to `${err && err.message ? err.message : String(err)}`",
  () =>
    // NO JSON.stringify on this path at all: a bare newline forges a log line.
    neutralized(
      gh.fetchRepoOwner(throwing(laced(RAW_ALL)), GH_REPO),
      RAW_ALL,
      "gh transport error",
    ),
);

t(
  "ado/transport-error-refusal-neutralizes-every-raw-class",
  "vcs-azure-adapter.js — revert a catch-block reason to `${err && err.message ? err.message : String(err)}`",
  () =>
    neutralized(
      ado.fetchRepoOwner(throwing(laced(RAW_ALL)), ADO_REPO),
      RAW_ALL,
      "ado transport error",
    ),
);

t(
  "gh/transport-error-refusal-scrubs-url-userinfo",
  "vcs-github-adapter.js — drop the userinfo scrub from the transport-error reason helper",
  () => {
    // security.md § "No secrets in logs". The deriver in upflow-self-repo.js
    // deliberately does NOT echo the raw remote URL because userinfo may hold a
    // PAT, and truncates git's stderr to 200 chars for the same reason. The
    // adapters' catch blocks had neither guard, and a transport built on a
    // PAT-in-URL remote throws an Error embedding it.
    const PAT = "ghp_ZZZZ000011112222333344445555666677";
    const res = gh.fetchRepoOwner(
      throwing(
        `fatal: unable to access 'https://oauth2:${PAT}@github.com/acme/widget.git/': 403`,
      ),
      GH_REPO,
    );
    const e = typedRefusal(res, "gh PAT-in-url");
    if (e) return e;
    if (res.reason.includes(PAT)) {
      return `credential survived in reason: ${JSON.stringify(res.reason.slice(0, 240))}`;
    }
    if (!res.reason.includes("***@")) {
      return `expected the canonical ***@ mask (observability.md 6.2); got ${JSON.stringify(res.reason.slice(0, 240))}`;
    }
    // The HOST must survive — the mask exists to keep the message diagnostic.
    return res.reason.includes("github.com")
      ? null
      : `the scrub ate the host, destroying the diagnostic: ${JSON.stringify(res.reason.slice(0, 240))}`;
  },
);

t(
  "ado/transport-error-refusal-scrubs-url-userinfo",
  "vcs-azure-adapter.js — drop the userinfo scrub from the transport-error reason helper",
  () => {
    // The ADO transport is PAT-authenticated by construction (see the ADO
    // runbook), so this is the likelier of the two to carry a live credential.
    const PAT = "abcdefghij0123456789klmnopqrstuvwxyz0123456789AB";
    const res = ado.createUpflowPR(
      throwing(
        `request failed for https://build:${PAT}@dev.azure.com/acme/core/_git/widget`,
      ),
      { repoRef: ADO_REPO, head: "feat/x", title: "t" },
    );
    const e = typedRefusal(res, "ado PAT-in-url");
    if (e) return e;
    if (res.reason.includes(PAT)) {
      return `credential survived in reason: ${JSON.stringify(res.reason.slice(0, 240))}`;
    }
    return res.reason.includes("***@") && res.reason.includes("dev.azure.com")
      ? null
      : `expected ***@ mask with the host preserved; got ${JSON.stringify(res.reason.slice(0, 240))}`;
  },
);

t(
  "gh+ado/userinfo-scrub-covers-credentials-containing-a-slash",
  "upflow-self-repo.js::_URL_USERINFO_RE — restore the `[^\\s/@]` userinfo class (which cannot cross a `/`) instead of the `:`-anchored class that can",
  () => {
    // THE SCRUB'S FIRST CUT MISSED THE MOST LIKELY CREDENTIAL SHAPE. The class
    // was `[^\s/@]`, chosen so that `https://h/a@b` — an `@` in a PATH, not
    // userinfo — would not match. Correct about the path case, and wrong about
    // credentials: the run cannot cross a `/`, so any secret CONTAINING one
    // never reaches the terminating `@` and the whole match fails, leaving the
    // credential verbatim in a reason that is logged and may be embedded in a
    // PR body.
    //
    // THAT IS NOT AN EXOTIC INPUT. The base64 alphabet is A-Za-z0-9+/= — `+`
    // and `=` passed the old class, `/` did not — so base64-encoded service
    // credentials, Azure storage keys, and any password a user configured
    // un-percent-encoded in a remote URL all landed in the miss. Measured
    // before the fix: `https://user:abc/def@dev.azure.com/o/p` came back
    // verbatim, while the no-slash control `user:abcdef` masked correctly —
    // which is exactly why the original cases could not see it.
    //
    // The fix anchors on the `:` that separates user from password instead of
    // forbidding `/`, so the path case still does not match (no `:` in `h/a`)
    // and the credential case does.
    const SECRET = "abc/def+ghi=";
    for (const [label, res] of [
      [
        "gh",
        gh.fetchRepoOwner(
          throwing(
            `fatal: unable to access 'https://oauth2:${SECRET}@github.com/acme/widget.git/': 403`,
          ),
          GH_REPO,
        ),
      ],
      [
        "ado",
        ado.createUpflowPR(
          throwing(
            `request failed for https://build:${SECRET}@dev.azure.com/acme/core/_git/widget`,
          ),
          { repoRef: ADO_REPO, head: "feat/x", title: "t" },
        ),
      ],
    ]) {
      const e = typedRefusal(res, `${label} slash-bearing credential`);
      if (e) return e;
      if (res.reason.includes(SECRET)) {
        return `${label}: slash-bearing credential survived verbatim: ${JSON.stringify(res.reason.slice(0, 240))}`;
      }
      if (!res.reason.includes("***@")) {
        return `${label}: expected the canonical ***@ mask; got ${JSON.stringify(res.reason.slice(0, 240))}`;
      }
    }
    return null;
  },
);

t(
  "gh+ado/userinfo-scrub-covers-a-bare-token-with-no-colon",
  "upflow-self-repo.js::_URL_USERINFO_RE — make the `:` MANDATORY again (drop the `(?::…)?` optional group), which stops masking a colon-less userinfo",
  () => {
    // THE THIRD POLARITY, AND ITS ABSENCE ALREADY COST A REGRESSION. The fix for
    // the slash-bearing credential anchored the match on the `user:pass` colon
    // and made that colon MANDATORY — which silently stopped masking
    // `https://<TOKEN>@host`, the DOCUMENTED PAT-clone form on BOTH providers
    // this module gates (GitHub `https://<token>@github.com/o/r.git`, Azure
    // DevOps `https://<PAT>@dev.azure.com/org/proj/_git/repo`). The previous
    // regex DID mask it. Measured after that fix and before this case existed:
    //   fatal: unable to access 'https://ghp_16C7…B4a@github.com/acme/widget.git': 403
    // came back verbatim, PAT intact.
    //
    // It was invisible because every case in this suite — including the two the
    // slash fix ADDED — drove a colon-bearing userinfo (`oauth2:`, `build:`).
    // That is the same shape the slash fix's own comment records about the cut
    // before it ("the no-slash control masking correctly is exactly why the
    // original cases could not see the miss"), repeated one polarity over. Three
    // polarities are required because there are three userinfo shapes: bare
    // token, `user:pass`, and `user:pass-containing-a-slash`.
    const TOKEN = "ghp_ZZZZ000011112222333344445555666677";
    for (const [label, res] of [
      [
        "gh",
        gh.fetchRepoOwner(
          throwing(
            `fatal: unable to access 'https://${TOKEN}@github.com/acme/widget.git/': 403`,
          ),
          GH_REPO,
        ),
      ],
      [
        "ado",
        ado.createUpflowPR(
          throwing(
            `request failed for https://${TOKEN}@dev.azure.com/acme/core/_git/widget`,
          ),
          { repoRef: ADO_REPO, head: "feat/x", title: "t" },
        ),
      ],
    ]) {
      const e = typedRefusal(res, `${label} bare-token credential`);
      if (e) return e;
      if (res.reason.includes(TOKEN)) {
        return `${label}: bare-token credential survived verbatim: ${JSON.stringify(res.reason.slice(0, 240))}`;
      }
      if (!res.reason.includes("***@")) {
        return `${label}: expected the canonical ***@ mask; got ${JSON.stringify(res.reason.slice(0, 240))}`;
      }
    }
    return null;
  },
);

t(
  "gh+ado/userinfo-scrub-preserves-the-host-when-a-port-is-present",
  "upflow-self-repo.js::_URL_USERINFO_RE — let the post-colon run cross `/` unrestricted, so a port plus a path `@` swallows the host",
  () => {
    // THE HOST-PRESERVATION INVARIANT, which the scrub states twice as
    // load-bearing ("the HOST is deliberately preserved — the message must stay
    // diagnostic", and `observability.md` § 6.2's `scheme://***@host[:port]/path`
    // form) and which no case pinned when a PORT is present.
    //
    // The two pre-existing host-survival cases drive PORT-LESS URLs, so neither
    // can red on this; a `host:port` URL whose PATH also carries an `@` supplies
    // the colon the userinfo match anchors on, and an unrestricted post-colon
    // run would consume straight through the host to that path `@`, masking
    // `https://host:8443/a/b@c` down to `https://***@c`.
    const res = gh.fetchRepoOwner(
      throwing(
        "fatal: unable to access 'https://github.com:8443/acme/widget/tree@v2': 404",
      ),
      GH_REPO,
    );
    const e = typedRefusal(res, "gh host-with-port");
    if (e) return e;
    return res.reason.includes("github.com")
      ? null
      : `the scrub ate the host on a ported URL, breaking the stated diagnostic invariant: ${JSON.stringify(res.reason.slice(0, 240))}`;
  },
);

t(
  "gh+ado/userinfo-scrub-leaves-a-path-at-sign-alone",
  "upflow-self-repo.js::_URL_USERINFO_RE — widen the userinfo class to `[^\\s@]` (dropping the `:` anchor), so an `@` in a PATH is masked as if it were userinfo",
  () => {
    // THE OVER-SCRUB POLARITY, and the constraint that makes the fix above a
    // fix rather than a trade. Widening the class to simply allow `/` would
    // also swallow `https://host/a/b@c` — an `@` in a path, no credential — and
    // destroy the path in a diagnostic. Requiring a `:` inside the run keeps
    // that case untouched, because a bare path segment has none.
    //
    // Without this case, "allow `/` in userinfo" and "mask everything up to any
    // `@`" are indistinguishable: both make the slash case pass.
    const res = gh.fetchRepoOwner(
      throwing(
        "fatal: unable to access 'https://github.com/acme/widget/tree@v2': 404",
      ),
      GH_REPO,
    );
    const e = typedRefusal(res, "gh path-at-sign");
    if (e) return e;
    if (res.reason.includes("***@")) {
      return `an @ in a PATH was masked as userinfo, destroying the diagnostic: ${JSON.stringify(res.reason.slice(0, 240))}`;
    }
    return res.reason.includes("acme/widget/tree@v2")
      ? null
      : `the path did not survive intact: ${JSON.stringify(res.reason.slice(0, 240))}`;
  },
);

t(
  "gh+ado/transport-error-refusals-are-bounded",
  "vcs-github-adapter.js / vcs-azure-adapter.js — drop the length bound from the transport-error reason helper",
  () => {
    const huge = "e".repeat(200000);
    const g = gh.fetchRepoOwner(throwing(huge), GH_REPO);
    const e1 =
      typedRefusal(g, "gh huge error") || bounded(g.reason, "gh huge error");
    if (e1) return e1;
    const a = ado.listCollaborators(throwing(huge), ADO_REPO);
    return (
      typedRefusal(a, "ado huge error") || bounded(a.reason, "ado huge error")
    );
  },
);

t(
  "gh+ado/non-error-throwables-do-not-crash-the-refusal",
  "vcs-github-adapter.js / vcs-azure-adapter.js — drop the try/catch in the transport-error reason helper",
  () => {
    // A transport may throw a non-Error: a string, a null, or an object whose
    // `toString` throws. `String(err)` on the last one THROWS, converting a typed
    // refusal into an uncaught exception inside the refusal path.
    const hostile = {
      get message() {
        throw new Error("hostile getter");
      },
      toString() {
        throw new Error("hostile toString");
      },
    };
    for (const [label, thrown] of [
      ["string", "plain string failure"],
      ["null", null],
      ["hostile", hostile],
    ]) {
      const g = gh.fetchRepoOwner(() => {
        throw thrown;
      }, GH_REPO);
      const e = typedRefusal(g, `gh throw ${label}`);
      if (e) return e;
      const a = ado.fetchRepoOwner(() => {
        throw thrown;
      }, ADO_REPO);
      const e2 = typedRefusal(a, `ado throw ${label}`);
      if (e2) return e2;
    }
    return null;
  },
);

// ===========================================================================
// D. Preservation polarity — a refuse-everything sanitizer must NOT pass
// ===========================================================================

t(
  "gh/legitimate-non-ascii-operand-survives-readable",
  "vcs-github-adapter.js — replace the shared class with an ASCII-only allowlist in the reason helper",
  () => {
    // The over-tightening polarity, and the reason `sanitizeForReason` is a
    // class-REMOVAL rather than a positive allowlist: an operator must be able to
    // read back the value they typed, accents and all. A suite that only checks
    // "hostile bytes are gone" is passed by a sanitizer that deletes everything —
    // the exact failure recorded at commit 1a25ee1.
    const res = gh.pushImage(unreachable, {
      repoRef: GH_REPO,
      workflow: "déploiement-café.yml",
    });
    const e = typedRefusal(res, "gh non-ascii workflow");
    if (e) return e;
    return res.reason.includes("déploiement-café.yml")
      ? null
      : `legitimate operand was mangled: ${JSON.stringify(res.reason)}`;
  },
);

t(
  "ado/legitimate-non-ascii-operand-survives-readable",
  "vcs-azure-adapter.js — replace the shared class with an ASCII-only allowlist in the reason helper",
  () => {
    const res = ado.pushImage(unreachable, {
      repoRef: ADO_REPO,
      pipeline: "déploiement-café",
    });
    const e = typedRefusal(res, "ado non-ascii pipeline");
    if (e) return e;
    return res.reason.includes("déploiement-café")
      ? null
      : `legitimate operand was mangled: ${JSON.stringify(res.reason)}`;
  },
);

t(
  "gh/ordinary-transport-error-survives-verbatim",
  "vcs-github-adapter.js — over-scrub the transport-error reason (e.g. mask every `@`, or drop non-ASCII)",
  () => {
    // An ordinary network error carries no credential and MUST come through
    // unchanged — a scrub that fires on it destroys the diagnostic the catch
    // block exists to surface.
    const msg =
      "connect ECONNREFUSED 127.0.0.1:443 (git@github.com:acme/widget.git)";
    const res = gh.fetchRepoOwner(throwing(msg), GH_REPO);
    const e = typedRefusal(res, "gh ordinary error");
    if (e) return e;
    return res.reason.includes(msg)
      ? null
      : `ordinary transport error was altered: ${JSON.stringify(res.reason)}`;
  },
);

t(
  "gh/small-error-body-survives-as-readable-json",
  "vcs-github-adapter.js — stop JSON-encoding the body operand (e.g. String(body) → [object Object])",
  () => {
    // The body operand's diagnostic value is its JSON shape. Sanitization must
    // not collapse it to `[object Object]`, which names nothing.
    const res = gh.fetchRepoOwner(
      failing({ message: "Not Found" }, 404),
      GH_REPO,
    );
    const e = typedRefusal(res, "gh small body");
    if (e) return e;
    return res.reason.includes('{"message":"Not Found"}')
      ? null
      : `body lost its JSON shape: ${JSON.stringify(res.reason)}`;
  },
);

t(
  "gh+ado/numeric-status-still-renders-bare",
  "vcs-github-adapter.js / vcs-azure-adapter.js — quote the status operand (JSON-encode a number as a string)",
  () => {
    // Regression guard on readability: `status 404`, never `status "404"`.
    const g = gh.fetchRepoOwner(failing({ m: 1 }, 404), GH_REPO);
    const e = typedRefusal(g, "gh status");
    if (e) return e;
    if (!g.reason.includes("status 404")) {
      return `expected a bare numeric status; got ${JSON.stringify(g.reason)}`;
    }
    const a = ado.fetchRepoOwner(failing({ m: 1 }, 404), ADO_REPO);
    return (
      typedRefusal(a, "ado status") ||
      (a.reason.includes("status 404")
        ? null
        : `expected a bare numeric status; got ${JSON.stringify(a.reason)}`)
    );
  },
);

t(
  "gh+ado/successful-calls-are-unaffected",
  "vcs-github-adapter.js / vcs-azure-adapter.js — route a SUCCESS-path value through the reason helper",
  () => {
    // The sanitization is display-only, on refusal paths. A success must return
    // its real values untouched — a helper accidentally applied to a return value
    // would corrupt data, not just text.
    const g = gh.createUpflowPR(
      succeeding({
        number: 42,
        html_url: "https://github.com/acme/widget/pull/42",
      }),
      { repoRef: GH_REPO, head: "feat/x", title: "café ☕" },
    );
    if (!g.ok || g.number !== 42) {
      return `gh happy path regressed: ${JSON.stringify(g)}`;
    }
    if (g.url !== "https://github.com/acme/widget/pull/42") {
      return `gh success url was altered: ${JSON.stringify(g.url)}`;
    }
    const a = ado.createUpflowPR(
      succeeding({
        pullRequestId: 7,
        url: "https://dev.azure.com/acme/core/_apis/git/pr/7",
      }),
      { repoRef: ADO_REPO, head: "feat/x", title: "café ☕" },
    );
    if (!a.ok || a.number !== 7 || a.unverified !== true) {
      return `ado happy path regressed: ${JSON.stringify(a)}`;
    }
    const o = gh.fetchRepoOwner(
      malformed({ owner: { login: "acme" } }),
      GH_REPO,
    );
    return o.ok && o.ownerPrincipal === "acme"
      ? null
      : `fetchRepoOwner success regressed: ${JSON.stringify(o)}`;
  },
);

// ===========================================================================
// E. Cross-adapter parity — the two adapters must bound identically
// ===========================================================================

t(
  "gh+ado/both-adapters-bound-and-sanitize-identically",
  "vcs-github-adapter.js OR vcs-azure-adapter.js — change one adapter's operand bound (e.g. 256 -> 4096) without the other",
  () => {
    // security.md § Enforcement-Surface Parity. The sanitization CLASS is the one
    // shared `upflow-self-repo.js::sanitizeForReason`, but the bound is applied in
    // each adapter, so the bound is the surface that can drift. This case is the
    // instrument for that drift: it drives the SAME operand through the same
    // shape guard on both adapters and requires the rendered operand to be the
    // same length.
    // The trailing "!" is load-bearing: without it the operand PASSES
    // WORKFLOW_ID_RE / ADO_PIPELINE_ID_RE, no shape-guard refusal fires, and the
    // case measures the transport-throw reason instead — a run of zero `q`s on
    // both adapters, which compares EQUAL and would have scored green vacuously.
    const operand = `${"q".repeat(50000)}!`;
    const g = gh.pushImage(unreachable, {
      repoRef: GH_REPO,
      workflow: operand,
    });
    const a = ado.pushImage(unreachable, {
      repoRef: ADO_REPO,
      pipeline: operand,
    });
    const e = typedRefusal(g, "gh parity") || typedRefusal(a, "ado parity");
    if (e) return e;
    const gq = (g.reason.match(/q+/) || [""])[0].length;
    const aq = (a.reason.match(/q+/) || [""])[0].length;
    if (gq === 0 || aq === 0) {
      return `expected the operand to appear (truncated) in both reasons; gh=${gq} ado=${aq}`;
    }
    if (gq >= 50000 || aq >= 50000) {
      return `operand was not bounded: gh kept ${gq}, ado kept ${aq}`;
    }
    return gq === aq
      ? null
      : `adapters bound differently: gh kept ${gq} chars, ado kept ${aq}`;
  },
);

// ===========================================================================
// F. The EXPORTED validator surface — sanitized at the source, not only at the
//    adapter's own publication sites
// ===========================================================================

t(
  "gh+ado/exported-validateRepoRef-reason-is-sanitized-at-source",
  "vcs-github-adapter.js / vcs-azure-adapter.js::validateRepoRef — revert to `${o.reason}` / `${p.reason}` / `${r.reason}` raw",
  () => {
    // `validateRepoRef` is EXPORTED, and `github-login.js` / `ado-login.js`
    // echo the rejected value through JSON.stringify. Sanitizing only where THIS
    // file publishes the reason would leave every OTHER consumer of the export
    // holding the raw text — the same enforcement-surface asymmetry (a fix
    // applied at one surface and not its sibling) that issue #83 is about.
    const g = gh.validateRepoRef({ owner: laced(JSON_BLIND), name: "widget" });
    if (g.valid !== false) return "gh validateRepoRef unexpectedly accepted";
    const e1 = noneSurvive(g.reason, JSON_BLIND, "gh validateRepoRef");
    if (e1) return e1;
    const a = ado.validateRepoRef({
      org: "acme",
      project: laced(JSON_BLIND),
      repo: "widget",
    });
    if (a.valid !== false) return "ado validateRepoRef unexpectedly accepted";
    const e2 = noneSurvive(a.reason, JSON_BLIND, "ado validateRepoRef");
    if (e2) return e2;
    // Preservation twin: a legitimate-but-rejected value stays readable.
    const ok = gh.validateRepoRef({ owner: "acme corp", name: "widget" });
    return ok.valid === false && ok.reason.includes("acme corp")
      ? null
      : `a legitimate rejected value was mangled: ${JSON.stringify(ok.reason)}`;
  },
);

// ---------------------------------------------------------------------------

let failed = 0;
for (const c of cases) {
  let err = null;
  try {
    err = c.fn();
  } catch (e) {
    err = `threw: ${e && e.message}`;
  }
  if (err) {
    failed += 1;
    console.log(`  ✗ ${c.name}`);
    console.log(`      ${err}`);
  } else {
    console.log(`  ✓ ${c.name}`);
  }
}

const total = cases.length;
if (failed) {
  console.log(
    `\nupflow-refusal-operand-sanitization: ${failed}/${total} FAILED`,
  );
  process.exit(1);
}
console.log(`\nupflow-refusal-operand-sanitization: ${total}/${total} PASS`);
