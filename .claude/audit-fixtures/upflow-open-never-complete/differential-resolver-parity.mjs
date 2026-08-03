/**
 * Differential oracle for `_splitRemoteUrl` host derivation.
 *
 * The fence's whole correctness property is: THE HOST THIS MODULE DERIVES MUST
 * EQUAL THE HOST GIT ACTUALLY CONNECTS TO. Three defects in this PR were all
 * violations of exactly that, found one at a time by reading. This asks the
 * real resolvers instead.
 *
 * ORACLES (each is the thing git actually delegates to):
 *   scp-style  -> `ssh -G <dest>` reports the host ssh would use.
 *   scheme URL -> WHATWG `new URL()` .hostname (what curl resolves; git uses
 *                 curl for http/https).
 *
 * A DISAGREEMENT is a finding. Agreement is not proof of security — it is
 * proof of check/use parity on the corpus driven, which is the property the
 * three fixed defects each broke.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const REPO = "/Users/esperie/repos/kailash/use/kailash-coc-rs";
const mod = require(`${REPO}/.claude/hooks/lib/upflow-self-repo.js`);

// _splitRemoteUrl is private; drive it the way production does — through a real
// git repo whose origin is the candidate, so we measure the shipped path.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function derivedHost(url) {
  const d = mkdtempSync(join(tmpdir(), "diffhost-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: d });
    execFileSync("git", ["remote", "add", "origin", url], { cwd: d });
    const r = mod.deriveSelfRepoRef(d);
    return r.ok ? r.self.host : null; // null = refused (fail-closed)
  } catch {
    return null;
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}

function sshHost(dest) {
  try {
    const out = execFileSync("ssh", ["-G", dest], { encoding: "utf8", timeout: 5000 });
    const m = out.match(/^hostname (.+)$/m);
    return m ? m[1].trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

function urlHost(u) {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const SCHEME = [
  "https://github.com/o/r.git",
  "http://github.com/o/r",
  "https://user@github.com/o/r",
  "https://user:tok@github.com/o/r",
  "https://evil.com#@github.com/o/r",
  "https://evil.com?@github.com/o/r",
  "https://user@evil.com@github.com/o/r",
  "https://github.com:443/o/r",
  "HTTPS://github.com/o/r",
  "https://github.com./o/r",
  "https://dev.azure.com/org/proj/_git/repo",
  "https://org.visualstudio.com/proj/_git/repo",
  "https://[::1]/o/r",
  "https://github.com/o/r?x=1",
  "https://github.com/o/r#frag",
];

const SCP = [
  "git@github.com:o/r.git",
  "git@github.com#@evil.com:o/r",
  "git@github.com?@evil.com:o/r",
  "git@evil.com:mirror/https://github.com/o/r",
  "evil.com:x/https://github.com/o/r",
  "git#foo@github.com:o/r",
  "user@host@github.com:o/r",
  "git@ssh.dev.azure.com:v3/org/proj/repo",
  "github.com:o/r",
  "git@github.com:o/r",
];

let findings = 0;
console.log("=== SCHEME FORMS (oracle: WHATWG URL / curl) ===");
for (const u of SCHEME) {
  const got = derivedHost(u);
  const want = urlHost(u);
  const ok = got === null || want === null || got === want;
  if (!ok) findings++;
  console.log(
    `${ok ? "  ok  " : "DIVERGE"}  derived=${String(got).padEnd(16)} oracle=${String(want).padEnd(16)} ${u}`,
  );
}

console.log("\n=== SCP FORMS (oracle: ssh -G) ===");
for (const u of SCP) {
  const got = derivedHost(u);
  const dest = u.slice(0, u.indexOf(":")); // scp destination = before first colon
  const want = sshHost(dest);
  const ok = got === null || want === null || got === want;
  if (!ok) findings++;
  console.log(
    `${ok ? "  ok  " : "DIVERGE"}  derived=${String(got).padEnd(16)} ssh=${String(want).padEnd(16)} ${u}`,
  );
}

console.log(`\nDIVERGENCES: ${findings}`);
console.log(
  "NOTE: `derived=null` is a REFUSAL (fail-closed) and is never counted a divergence —\n" +
    "this measures check/use PARITY when the fence answers, not whether it answers.",
);
process.exit(findings ? 1 : 0);
