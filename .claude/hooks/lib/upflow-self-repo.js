/**
 * upflow-self-repo.js — derive THIS repo's own identity for the
 * `upstream-issue-hygiene.md` MUST-4 ("Open, Never Complete") fence.
 *
 * WHY THIS MODULE EXISTS. The first cut of the MUST-4 fence took `selfRepoRef`
 * as a DESCRIPTOR FIELD and compared it against `repoRef` — but both operands
 * then came off the same caller-authored object, so `{repoRef: X, selfRepoRef: X}`
 * cleared it trivially. The rule's load-bearing sentence ("its own repo identity
 * can never equal its upstream's") is true ONLY if the identity is DERIVED from
 * the environment rather than ASSERTED by the caller. A Tier-1 redteam found the
 * sentence false as written and the derivation enforced nowhere (zero producers
 * of `selfRepoRef` repo-wide). This module is the derivation, so the claim and
 * the code agree.
 *
 * `instrument-discipline.md` MUST-1 framing: a comparison is only evidence when
 * an operand is a fact the caller cannot author. `git remote get-url origin` and
 * `.claude/VERSION::repo` are such facts; a descriptor field is not.
 *
 * ONE SHARED HELPER, NOT PER-CALL-SITE (`security.md` § Credential-Decode-Helpers):
 * both VCS adapters route through this, so the two providers cannot normalize
 * differently — the drift shape `security.md` § Enforcement-Surface Parity blocks.
 */

const path = require("path");

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
  const s = String(v)
    .trim()
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
  return s && s !== "_git" ? s : null;
}

/**
 * Derive this repo's OWN identity from the environment.
 *
 * Reads `.claude/VERSION::repo` and the live git remote, and requires them to
 * AGREE — the same `classifyTemplateDeclaration` identity the MUST-4 docstring
 * names. Disagreement is NOT resolved in either direction here: it means the
 * repo cannot prove who it is, so the fence must refuse (fail closed).
 *
 * @param {string} cwd repo directory
 * @param {object} [opts] injection seam for tests ONLY — production passes none
 * @returns {{ok:true, self:{owner:string,name:string}}
 *          |{ok:false, reason:string}}
 */
function deriveSelfRepoRef(cwd, opts) {
  const o = opts || {};
  let vu;
  try {
    vu = o._versionUtils || require(path.join(__dirname, "version-utils.js"));
  } catch (err) {
    return {
      ok: false,
      reason: `version-utils unavailable, cannot derive self-identity: ${err && err.message ? err.message : String(err)}`,
    };
  }

  // (a) the DECLARED identity — `.claude/VERSION::repo`
  let declared = null;
  try {
    const local = o._localVersion || _readLocalVersion(cwd);
    declared = vu.declaredSelfRepo(local);
  } catch {
    declared = null;
  }

  // (b) the ACTUAL identity — the live git remote
  let actual = null;
  try {
    actual = o._repoIdentity || vu.readRepoIdentity(cwd);
  } catch {
    actual = null;
  }

  const dSlug =
    declared && declared.slug ? normalizeComponent(declared.slug) : null;
  const aSlug = actual && actual.slug ? normalizeComponent(actual.slug) : null;

  if (!dSlug && !aSlug) {
    return {
      ok: false,
      reason:
        "neither .claude/VERSION::repo nor the git remote yields an owner/name slug; " +
        "this repo cannot prove its own identity, so a completion cannot be authorized",
    };
  }
  // Require agreement when BOTH are readable. A mismatch is the "byte-copy of a
  // template" case — precisely when we must NOT let a completion through.
  if (dSlug && aSlug && dSlug !== aSlug) {
    return {
      ok: false,
      reason:
        `.claude/VERSION::repo (${dSlug}) disagrees with the git remote (${aSlug}); ` +
        "self-identity is unprovable, refusing to authorize a completion",
    };
  }
  const slug = aSlug || dSlug; // prefer the live remote when both agree
  const parts = slug.split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return {
      ok: false,
      reason: `derived self-identity is not owner/name shaped: ${slug}`,
    };
  }
  return { ok: true, self: { owner: parts[0], name: parts[1] } };
}

function _readLocalVersion(cwd) {
  const fs = require("fs");
  const p = path.join(cwd || process.cwd(), ".claude", "VERSION");
  return JSON.parse(fs.readFileSync(p, "utf8"));
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

/** ADO shape: {org, project, repo} — compared component-wise, all three. */
function isSelfRepoAdo(repoRef, self) {
  if (!repoRef || !self) return false;
  const parts = ["org", "project", "repo"];
  for (const k of parts) {
    const l = normalizeComponent(repoRef[k]);
    const r = normalizeComponent(self[k]);
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
