#!/usr/bin/env bash
# Runs both sync-invariant gates and maps their three-valued exit contracts onto
# a single pass/fail for the caller.
#
# WHY THIS FILE EXISTS.  `sync-invariants.yml` declares TWO jobs that run the
# identical gate body — one whose `name:` is the registered required-status-check
# context (default-base PRs only), one for every other base. They are two jobs
# rather than one because a check run is scoped to the HEAD SHA, not to the PR,
# and branch protection matches purely on {app_id, context} with no base
# awareness. A single job running on all bases would let a verdict computed
# against a DIFFERENT merge base occupy the required context on a shared SHA.
#
# Two jobs invite drift, and a gate that drifts between its own copies is worse
# than one that does not run. So the body lives here, once, and each job is a
# single line. Do not inline this back into either job.
#
# A reusable workflow (`workflow_call`) would be the more idiomatic factoring and
# is deliberately NOT used: with `workflow_call` the reported context becomes
# "<caller-job> / <called-job>", which silently changes the context string and
# would un-protect `main` until someone re-registered it.
#
# Usage:  run-sync-invariant-gates.sh <base-sha> <head-sha>
# Env:    PR_BODY  — forwarded to Gate A for its ACK-DISCARD escape hatch.
#
# Exit: 0 = both gates clean; 1 = at least one gate failed OR did not run.
# There is deliberately NO exit code meaning "partially checked".

set -uo pipefail

BASE_SHA="${1:-}"
HEAD_SHA="${2:-}"

if [ -z "$BASE_SHA" ] || [ -z "$HEAD_SHA" ]; then
  echo "::error title=Gate runner did not run::Missing base/head SHA (base='$BASE_SHA' head='$HEAD_SHA'). Failing closed."
  exit 1
fi

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
overall=0

# Gate A — would this PR discard consumer-authored work?
#
# Exit contract is THREE-VALUED and deliberately not collapsed:
#   0 = nothing at risk
#   2 = a discard was found; a human decides
#   1 = the check DID NOT RUN — never read as safe
# Both 1 and 2 fail. Treating "did not run" as "nothing at risk" is the exact
# fail-open this workflow exists to close (`rules/evidence-first-claims.md`
# MUST-3: an errored command is zero evidence, never confirmation).
echo "── Gate A — local-fix discard detection"
bash "$here/check-local-fix-discard.sh" "$BASE_SHA" "$HEAD_SHA"
rc=$?
case "$rc" in
  0) echo "Gate A: clean." ;;
  2)
    echo "::error title=Gate A::This PR discards locally-authored work in shared .claude/ artifacts. See the step log for the exact files, the local commits that authored the lines, and the resolution options (including ACK-DISCARD)."
    overall=1
    ;;
  *)
    echo "::error title=Gate A did not run::The check exited $rc, which means it could not run — NOT that the PR is clean. Failing closed."
    overall=1
    ;;
esac

# Gate B — does .coc-obsoleted list a path this same tree ships?
#
# Runs against the checked-out tree. For a `pull_request` event actions/checkout
# materializes the MERGE result, which is precisely the tree a downstream
# consumer would receive.
echo "── Gate B — obsoleted ∩ shipped disjointness"
bash "$here/check-obsoleted-disjoint.sh"
rc=$?
case "$rc" in
  0) echo "Gate B: disjoint." ;;
  2)
    echo "::error title=Gate B::.coc-obsoleted lists paths this tree still ships. A downstream /sync-from-template deletes every listed path — including the copy this release hands it. See the step log for the offending paths."
    overall=1
    ;;
  *)
    echo "::error title=Gate B did not run::The check exited $rc, which means it could not run — NOT that the tree is disjoint. Failing closed."
    overall=1
    ;;
esac

# Both gates always run. Gate A failing does not skip Gate B — a single PR can
# trip both, and reporting only the first would hide the second until the next
# push.
exit "$overall"
