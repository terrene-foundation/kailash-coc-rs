#!/usr/bin/env python3
"""CI job-budget audit — the authority for what may run on a pull request.

Censuses every PR-reachable job, resolves each to a pool, and checks it against the
declaration at `.github/job-budget.json`. A job that runs on every PR while gating
nothing, and is not budgeted, is a FREELOADER and fails the audit.

WHY THIS EXISTS. CI jobs accrete one unremarkable job at a time and nothing says
anything at the moment each is added. Adapted from loom#1877, whose measured instance
was 33 PR-reachable jobs against a pool of 24 with only 12 gating anything. This repo
was at 0 freeloaders when the audit was written; the audit is what keeps it there.

DESIGN PROPERTIES CARRIED OVER DELIBERATELY (loom#1877 names each as hard-won):

  * No case count is restated in prose. Every revision that pinned a number went stale
    within a commit. The counts are printed by the run itself.
  * An anti-vacuity floor over the control set: `every-check-has-a-negative-control`
    fails loudly when a check is added with no control, which is what an inert gate
    looks like from the outside.
  * The audit fails CLOSED on a non-finite capacity. A mutation showed that a loose
    numeric test admits Infinity, which silently deletes the ceiling comparison.
  * Capacity that was never measured reports UNKNOWN, never a pass. A green rendered
    from a guessed number is an instrument that cannot discriminate.

Exit: 0 = clean · 1 = findings · 2 = UNRUNNABLE (refused; no verdict rendered).

Usage:
  job-budget-audit.py [--repo <dir>] [--json]
  job-budget-audit.py --selftest      # proves the audit returns DIFFERENT answers
                                      # for inputs whose correct verdicts differ
"""
from __future__ import annotations

import argparse
import json
import os
import sys

try:
    import yaml
except ImportError:  # pragma: no cover - environment guard
    print(
        "UNRUNNABLE — PyYAML is not importable, so no workflow could be parsed.\n"
        "This is exit 2. It is NOT a pass: no job was censused and no verdict was rendered.\n"
        "Install it (`pip install pyyaml`) and re-run.",
        file=sys.stderr,
    )
    raise SystemExit(2)


class Unrunnable(Exception):
    """Refusal. Emits exit 2 and renders no verdict."""


# --------------------------------------------------------------------------- census


def load_workflows(repo):
    wf_dir = os.path.join(repo, ".github", "workflows")
    if not os.path.isdir(wf_dir):
        raise Unrunnable(f"no workflow directory at {wf_dir}")
    out = {}
    for fname in sorted(os.listdir(wf_dir)):
        if not fname.endswith((".yml", ".yaml")):
            continue
        path = os.path.join(wf_dir, fname)
        try:
            doc = yaml.safe_load(open(path))
        except yaml.YAMLError as e:
            raise Unrunnable(f"{fname} did not parse: {e}")
        if isinstance(doc, dict):
            out[fname] = doc
    if not out:
        raise Unrunnable(f"no parseable workflows under {wf_dir}")
    return out


def pr_arm(doc):
    """The workflow's pull_request trigger config, or None when it has none.

    `on:` parses to the boolean True under YAML 1.1, so both spellings are checked.
    """
    on = doc.get("on", doc.get(True))
    if on is None:
        return None
    if isinstance(on, list):
        return {} if "pull_request" in on else None
    if isinstance(on, dict):
        if "pull_request" not in on:
            return None
        return on["pull_request"] or {}
    return None


def census(workflows):
    """Every PR-reachable job, with the facts each check needs."""
    rows = []
    for fname, doc in workflows.items():
        arm = pr_arm(doc)
        if arm is None:
            continue
        arm_filtered = bool(
            isinstance(arm, dict) and (arm.get("paths") or arm.get("paths-ignore"))
        )
        for job_id, job in (doc.get("jobs") or {}).items():
            job = job or {}
            rows.append(
                {
                    "workflow": fname,
                    "job_id": job_id,
                    "name": job.get("name") or job_id,
                    "runs_on": job.get("runs-on"),
                    "job_if": bool(job.get("if")),
                    "arm_filtered": arm_filtered,
                }
            )
    return rows


def resolve_pool(runs_on, pools):
    """Which declared pool this job draws from, or None when undeclared."""
    labels = runs_on if isinstance(runs_on, list) else [runs_on]
    labels = [l for l in labels if isinstance(l, str)]
    for pool_name, pool in pools.items():
        declared = pool.get("runs_on") or []
        if any(l in declared for l in labels):
            return pool_name
    return None


# --------------------------------------------------------------------------- checks

CHECKS = [
    "denominator-is-non-degenerate",
    "no-unbudgeted-freeloader",
    "every-job-resolves-to-a-declared-pool",
    "no-stale-budgeted-exemption",
    "every-budgeted-exemption-has-a-revisit-date",
    "required-contexts-name-real-jobs",
    "capacity-within-pool-ceiling",
]


def audit(repo):
    decl_path = os.path.join(repo, ".github", "job-budget.json")
    if not os.path.isfile(decl_path):
        raise Unrunnable(f"no declaration at {decl_path}")
    try:
        decl = json.load(open(decl_path))
    except json.JSONDecodeError as e:
        raise Unrunnable(f"declaration did not parse: {e}")

    pools = decl.get("pools") or {}
    if not pools:
        raise Unrunnable("declaration names no pools; nothing could be resolved")
    required = set(decl.get("required_contexts") or [])
    budgeted = decl.get("budgeted") or []
    budget_keys = {(b.get("workflow"), b.get("job")) for b in budgeted}

    workflows = load_workflows(repo)
    rows = census(workflows)

    findings = []
    results = {}

    def record(check, ok, detail=""):
        results[check] = {"ok": ok, "detail": detail}
        if not ok:
            findings.append((check, detail))

    # A zero-job run would pass every check below while measuring nothing.
    record(
        "denominator-is-non-degenerate",
        len(rows) > 0,
        f"censused {len(rows)} PR-reachable job(s) across {len(workflows)} workflow(s)",
    )

    free = [
        r
        for r in rows
        if r["name"] not in required
        and r["job_id"] not in required
        and not r["job_if"]
        and not r["arm_filtered"]
        and (r["workflow"], r["name"]) not in budget_keys
    ]
    record(
        "no-unbudgeted-freeloader",
        not free,
        "; ".join(f"{r['workflow']}::{r['name']}" for r in free)
        or "every PR-reachable job is required, relevance-gated, or budgeted",
    )

    unresolved = [r for r in rows if resolve_pool(r["runs_on"], pools) is None]
    record(
        "every-job-resolves-to-a-declared-pool",
        not unresolved,
        "; ".join(
            f"{r['workflow']}::{r['name']} runs-on={r['runs_on']!r}" for r in unresolved
        )
        or f"all {len(rows)} job(s) resolve",
    )

    live = {(r["workflow"], r["name"]) for r in rows}
    stale = [b for b in budgeted if (b.get("workflow"), b.get("job")) not in live]
    record(
        "no-stale-budgeted-exemption",
        not stale,
        "; ".join(f"{b.get('workflow')}::{b.get('job')}" for b in stale)
        or f"{len(budgeted)} exemption(s), none stale",
    )

    undated = [b for b in budgeted if not b.get("revisit")]
    record(
        "every-budgeted-exemption-has-a-revisit-date",
        not undated,
        "; ".join(f"{b.get('workflow')}::{b.get('job')}" for b in undated)
        or "every exemption carries a revisit date",
    )

    job_names = {r["name"] for r in rows} | {r["job_id"] for r in rows}
    phantom = sorted(required - job_names)
    record(
        "required-contexts-name-real-jobs",
        not phantom,
        "; ".join(phantom)
        or f"all {len(required)} required context(s) resolve to a job",
    )

    # Capacity. Fails CLOSED on a non-finite value: a loose numeric test admits
    # Infinity, which silently deletes the ceiling comparison for every pool.
    cap_details = []
    cap_ok = True
    for pool_name, pool in pools.items():
        cap = pool.get("capacity")
        demand = sum(1 for r in rows if resolve_pool(r["runs_on"], pools) == pool_name)
        if cap is None:
            cap_details.append(
                f"{pool_name}: demand={demand} capacity=UNKNOWN "
                f"(source={pool.get('capacity_source')!r}) — NOT a pass, not a failure"
            )
            continue
        if not isinstance(cap, int) or isinstance(cap, bool) or cap != cap or cap <= 0:
            cap_ok = False
            cap_details.append(
                f"{pool_name}: capacity {cap!r} is not a positive finite integer — refusing "
                "to render a ceiling comparison against it"
            )
            continue
        if demand > cap:
            cap_ok = False
            cap_details.append(f"{pool_name}: demand={demand} EXCEEDS capacity={cap}")
        else:
            cap_details.append(f"{pool_name}: demand={demand} within capacity={cap}")
    record("capacity-within-pool-ceiling", cap_ok, "; ".join(cap_details))

    # Anti-vacuity floor over the control set itself: a check added with no result
    # is what an inert gate looks like from the outside.
    missing = [c for c in CHECKS if c not in results]
    if missing:
        findings.append(
            (
                "every-check-has-a-negative-control",
                "no result recorded for: " + ", ".join(missing),
            )
        )

    return {
        "rows": rows,
        "results": results,
        "findings": findings,
        "workflows": len(workflows),
    }


# ------------------------------------------------------------------------- selftest


def selftest():
    """Prove the audit returns DIFFERENT answers for inputs whose verdicts differ.

    A gate that cannot be shown to fail is not evidence when it passes.
    """
    import shutil
    import tempfile

    passed = failed = 0

    def check(name, ok, detail=""):
        nonlocal passed, failed
        if ok:
            passed += 1
            print(f"  PASS  {name}")
        else:
            failed += 1
            print(f"  FAIL  {name}", file=sys.stderr)
            if detail:
                print(f"        {detail}", file=sys.stderr)

    def scaffold(root, workflows, decl):
        os.makedirs(os.path.join(root, ".github", "workflows"), exist_ok=True)
        for fname, body in workflows.items():
            open(os.path.join(root, ".github", "workflows", fname), "w").write(body)
        json.dump(decl, open(os.path.join(root, ".github", "job-budget.json"), "w"))

    base_decl = {
        "pools": {
            "p": {
                "runs_on": ["ubuntu-latest"],
                "capacity": None,
                "capacity_source": "UNVERIFIED",
            }
        },
        "required_contexts": ["gate"],
        "budgeted": [],
    }
    GATED = (
        "on:\n  pull_request:\n    paths: ['src/**']\njobs:\n"
        "  build:\n    name: build\n    runs-on: ubuntu-latest\n    steps: []\n"
    )
    REQUIRED = (
        "on:\n  pull_request:\njobs:\n"
        "  gate:\n    name: gate\n    runs-on: ubuntu-latest\n    steps: []\n"
    )
    FREELOADER = (
        "on:\n  pull_request:\njobs:\n"
        "  tagalong:\n    name: tagalong\n    runs-on: ubuntu-latest\n    steps: []\n"
    )

    tmp = tempfile.mkdtemp(prefix="jba-")
    try:
        # ACCEPTING pole — required + relevance-gated only.
        a = os.path.join(tmp, "clean")
        scaffold(a, {"g.yml": GATED, "r.yml": REQUIRED}, base_decl)
        ra = audit(a)
        check(
            "accepting-pole-is-clean",
            not ra["findings"],
            "; ".join(f"{c}: {d}" for c, d in ra["findings"]),
        )

        # NEGATIVE pole — the same tree plus one freeloader.
        b = os.path.join(tmp, "freeloader")
        scaffold(b, {"g.yml": GATED, "r.yml": REQUIRED, "f.yml": FREELOADER}, base_decl)
        rb = audit(b)
        check(
            "negative-pole-flags-the-freeloader",
            any(c == "no-unbudgeted-freeloader" for c, _ in rb["findings"]),
            "the freeloader check did not fire on a job that gates nothing",
        )
        check(
            "the-two-poles-differ",
            bool(ra["findings"]) != bool(rb["findings"]),
            "clean and freeloader trees produced the same verdict — the audit cannot discriminate",
        )

        # Budgeting the freeloader clears it — the escape hatch works...
        c = os.path.join(tmp, "budgeted")
        d2 = json.loads(json.dumps(base_decl))
        d2["budgeted"] = [
            {
                "workflow": "f.yml",
                "job": "tagalong",
                "rationale": "x",
                "added": "2026-08-21",
                "revisit": "2026-11-21",
            }
        ]
        scaffold(c, {"g.yml": GATED, "r.yml": REQUIRED, "f.yml": FREELOADER}, d2)
        rc = audit(c)
        check(
            "budgeting-clears-the-freeloader",
            not rc["findings"],
            "; ".join(f"{ch}: {det}" for ch, det in rc["findings"]),
        )

        # ...but an undated exemption does not.
        e = os.path.join(tmp, "undated")
        d3 = json.loads(json.dumps(d2))
        d3["budgeted"][0].pop("revisit")
        scaffold(e, {"g.yml": GATED, "r.yml": REQUIRED, "f.yml": FREELOADER}, d3)
        re_ = audit(e)
        check(
            "undated-exemption-is-flagged",
            any(
                ch == "every-budgeted-exemption-has-a-revisit-date"
                for ch, _ in re_["findings"]
            ),
            "an exemption with no revisit date passed — that is how a temporary allowance becomes permanent",
        )

        # A stale exemption naming a job that no longer exists is flagged.
        f = os.path.join(tmp, "stale")
        scaffold(f, {"g.yml": GATED, "r.yml": REQUIRED}, d2)
        rf = audit(f)
        check(
            "stale-exemption-is-flagged",
            any(ch == "no-stale-budgeted-exemption" for ch, _ in rf["findings"]),
            "an exemption for a deleted job passed — stale declarations accrete silently",
        )

        # Capacity fails CLOSED on a non-finite value rather than skipping the ceiling.
        g = os.path.join(tmp, "infcap")
        d4 = json.loads(json.dumps(base_decl))
        d4["pools"]["p"]["capacity"] = float("inf")
        scaffold(g, {"g.yml": GATED, "r.yml": REQUIRED}, d4)
        rg = audit(g)
        check(
            "non-finite-capacity-fails-closed",
            any(ch == "capacity-within-pool-ceiling" for ch, _ in rg["findings"]),
            "Infinity was accepted as a capacity, which deletes the ceiling comparison",
        )

        # An exceeded capacity is flagged (proves the ceiling arm can fire at all).
        h = os.path.join(tmp, "over")
        d5 = json.loads(json.dumps(base_decl))
        d5["pools"]["p"]["capacity"] = 1
        scaffold(h, {"g.yml": GATED, "r.yml": REQUIRED}, d5)
        rh = audit(h)
        check(
            "exceeded-capacity-is-flagged",
            any(ch == "capacity-within-pool-ceiling" for ch, _ in rh["findings"]),
            "demand of 2 against a capacity of 1 was not flagged",
        )

        # An unresolvable runs-on is flagged rather than silently unpooled.
        i = os.path.join(tmp, "unpooled")
        scaffold(
            i,
            {
                "g.yml": GATED,
                "r.yml": REQUIRED,
                "x.yml": REQUIRED.replace(
                    "ubuntu-latest", "self-hosted-mystery"
                ).replace("gate", "mystery"),
            },
            base_decl,
        )
        ri = audit(i)
        check(
            "undeclared-pool-is-flagged",
            any(
                ch == "every-job-resolves-to-a-declared-pool"
                for ch, _ in ri["findings"]
            ),
            "a job on an undeclared runner label resolved to nothing and passed",
        )

        # The anti-vacuity floor: every declared check produced a result.
        check(
            "every-check-has-a-negative-control",
            all(ch in ra["results"] for ch in CHECKS),
            "a declared check produced no result — an inert gate looks exactly like this",
        )
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print(f"\n{passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


# ----------------------------------------------------------------------------- main


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--repo", default=".")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        return selftest()

    try:
        r = audit(args.repo)
    except Unrunnable as e:
        print(
            f"UNRUNNABLE — {e}\nThis is exit 2. It is NOT a pass: no verdict was rendered.",
            file=sys.stderr,
        )
        return 2

    if args.json:
        print(
            json.dumps(
                {
                    "jobs": r["rows"],
                    "results": r["results"],
                    "findings": [{"check": c, "detail": d} for c, d in r["findings"]],
                },
                indent=2,
            )
        )
        return 1 if r["findings"] else 0

    print(
        f"CI job-budget audit — {len(r['rows'])} PR-reachable job(s), "
        f"{r['workflows']} workflow(s)\n"
    )
    for check in CHECKS:
        res = r["results"].get(check)
        if res is None:
            print(f"  ????  {check}  (no result — anti-vacuity floor fires)")
            continue
        print(f"  {'PASS' if res['ok'] else 'FAIL'}  {check}")
        if res["detail"]:
            print(f"        {res['detail']}")
    if r["findings"]:
        print(
            f"\n{len(r['findings'])} finding(s). Declare the job in .github/job-budget.json "
            "as required, relevance-gated, or budgeted — or remove it."
        )
        return 1
    print("\nclean.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
