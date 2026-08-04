#!/usr/bin/env bash
# Gate A — local-fix discard detection.
#
# WHY THIS EXISTS.  An inbound sync PR merged and silently reverted three fixes
# that had landed on main hours earlier. No conflict, no warning, no failing
# check. The mechanism was not a stale branch: the sync branch was cut from a
# main that ALREADY CONTAINED the fixes, and the sync engine then regenerated
# each shared artifact from the upstream template's canonical copy — which does
# not carry them. The revert is therefore a CONTENT fact, visible only in the
# diff, and every ancestry-shaped check passes cleanly on it. Measured:
#
#   $ git merge-base --is-ancestor <fix-commit> <sync-commit>  ->  0 (ancestor)
#
# That measurement is why this gate compares CONTENT, not history reachability.
# A check built on "does the PR's history contain main's commits?" would have
# returned a clean PASS on the exact PR that motivated it.
#
# WHAT IT CHECKS.  For every file under `.claude/` the PR modifies:
#
#   1. Enumerate the non-merge commits touching that file that are reachable
#      from the MERGE BASE (the tree git will actually 3-way merge against).
#   2. Keep the ones authored HERE — classified by commit SUBJECT, not content.
#      The pattern is NOT restated here: it is read out of the shipped
#      `.claude/bin/sync-preflight-local-mods.mjs`, which owns it and documents
#      its derivation, via `.github/scripts/sync-subject-re.mjs`.
#   3. Collect the substantive lines those local commits ADDED.
#   4. Flag any such line PRESENT at the merge base but ABSENT from the PR's
#      version — i.e. the merge would drop work this repo authored.
#
# The merge base is the correct reference precisely because it is what git
# compares against. A local fix that landed on main AFTER the fork point is a
# base-side-only change; git keeps it, so it is not at risk and is not reported.
#
# SUBJECT-CLASSIFICATION, and why it is not "differs".  Keying on "the file
# differs from upstream" flags nearly every shared artifact on a healthy
# consumer — the alert-fatigue failure that makes a gate worthless. Subject
# classification splits stale-from-upstream (replacing it is the sync working
# correctly) from consumer-authored (replacing it is a loss). A convention this
# pattern does not recognize is read as local authorship, so it OVER-reports —
# a false at-risk, never a silent miss. That is the correct direction to fail.
#
# WHAT IT CANNOT DETECT — stated plainly, because a gate that claims more than
# it checks is worse than no gate:
#
#   - A SEMANTIC revert that keeps every line. Wrapping a guard in `if (false)`,
#     inverting a comparison, or deleting the single call site while leaving the
#     function defined all preserve the added lines and pass this check.
#   - Removal of lines below the substantive-length floor (short closers, lone
#     braces). They are dropped as noise because they match everywhere.
#   - A revert to a file NOT under `.claude/`.
#   - A revert of work committed under a SYNC-shaped subject (a fix landed as
#     `chore(sync): …` is read as upstream content and its loss is not flagged).
#   - Anything at all when the history is shallow — see the exit contract.
#
# It also cannot tell a hostile revert from a deliberate local refactor that
# removes its own earlier lines; both are reported. `.claude/.proposals/` is the
# known recurring benign case (the lifecycle archives `latest.yaml` and starts
# fresh, which drops local lines by design). The escape hatch is an explicit
# `ACK-DISCARD: <path>` line in the PR body, which converts a silent discard
# into a recorded, reviewed one. That is the goal: not to make the discard
# impossible, but to make it impossible to do SILENTLY.
#
# EXIT CONTRACT — three-valued, mirroring the tool this gate borrows from.
# Collapsing these is the fail-open this gate exists to prevent
# (`rules/evidence-first-claims.md` MUST-3: an errored command is zero
# evidence, never confirmation):
#
#   0 = nothing at risk
#   2 = a discard was found; a human decides
#   1 = the check DID NOT RUN — MUST NEVER be read as safe
#
# The caller MUST fail on BOTH 1 and 2.

set -uo pipefail

E_CLEAN=0
E_DID_NOT_RUN=1
E_AT_RISK=2

BASE_REF="${1:-}"
HEAD_REF="${2:-HEAD}"
PR_BODY="${PR_BODY:-}"

die_not_run() {
  echo "gate-a: $* — CHECK DID NOT RUN (this is NOT a pass)" >&2
  exit "$E_DID_NOT_RUN"
}

[ -n "$BASE_REF" ] || die_not_run "usage: $0 <base-ref> [head-ref]"
git rev-parse --git-dir >/dev/null 2>&1 || die_not_run "not inside a git work tree"
command -v node >/dev/null 2>&1 || die_not_run "node is required to source the sync-subject pattern"

# Shallow history silently truncates `git log`, which would drop the very local
# commits this gate looks for and report a clean PASS. Refuse instead.
if [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = "true" ]; then
  die_not_run "repository is shallow (need full history; use fetch-depth: 0)"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_SUBJECT_RE="$(node "$SCRIPT_DIR/sync-subject-re.mjs")" || \
  die_not_run "could not source the sync-subject pattern"
[ -n "$SYNC_SUBJECT_RE" ] || die_not_run "sync-subject pattern resolved empty"

MERGE_BASE="$(git merge-base "$BASE_REF" "$HEAD_REF" 2>/dev/null)" || MERGE_BASE=""
[ -n "$MERGE_BASE" ] || die_not_run "cannot resolve merge-base of '$BASE_REF' and '$HEAD_REF'"

# Substantive-line floor: a line must carry at least this many non-whitespace
# characters to count as evidence. Below it, lines like `}` or `});` match
# nearly every file and the gate would report noise instead of findings.
MIN_SIGNIFICANT_CHARS=12

# Per-file lookback over local commits. Bounds cost on a broad sync PR without
# changing the verdict: a discard is detected from the commit that introduced
# the line, and shared artifacts do not accumulate hundreds of local commits
# between syncs.
MAX_LOCAL_COMMITS=50

WORK="$(mktemp -d)" || die_not_run "cannot create a temp dir"
trap 'rm -rf "$WORK"' EXIT

cat > "$WORK/discard.awk" <<'AWK'
BEGIN {
  base = ""; head = "";
  while ((getline l < BASEF) > 0) base = base l "\n";
  while ((getline l < HEADF) > 0) head = head l "\n";
  while ((getline l < CANDF) > 0) {
    if (l == "") continue;
    # Present in the tree git merges against, gone from the PR's version.
    if (index(base, l) > 0 && index(head, l) == 0) print l;
  }
}
AWK

changed="$WORK/changed.txt"
git diff --name-only "$MERGE_BASE" "$HEAD_REF" -- '.claude/' > "$changed" 2>/dev/null \
  || die_not_run "git diff failed"

file_total=$(wc -l < "$changed" | tr -d ' ')
echo "gate-a: merge-base $MERGE_BASE"
echo "gate-a: sync-subject pattern sourced from .claude/bin/sync-preflight-local-mods.mjs"
echo "gate-a: $file_total file(s) under .claude/ modified by this PR"

flagged_files=0
acked_files=0
scanned_files=0

while IFS= read -r f; do
  [ -n "$f" ] || continue
  scanned_files=$((scanned_files + 1))

  # The merge base must have the file for a discard to be possible at all.
  git cat-file -e "$MERGE_BASE:$f" 2>/dev/null || continue
  git show "$MERGE_BASE:$f" > "$WORK/base.txt" 2>/dev/null || continue

  # A deletion in the PR is the maximal discard; an empty head side makes every
  # base line absent, which is the correct reading.
  : > "$WORK/head.txt"
  git show "$HEAD_REF:$f" > "$WORK/head.txt" 2>/dev/null || : > "$WORK/head.txt"

  : > "$WORK/cand.txt"
  : > "$WORK/localcommits.txt"
  had_local=0

  while IFS=$'\x1f' read -r sha subject; do
    [ -n "$sha" ] || continue
    if printf '%s' "$subject" | grep -Eq "$SYNC_SUBJECT_RE"; then
      continue   # upstream sync — replacing its content is the sync working
    fi
    had_local=1
    # `git show` handles root commits; --unified=0 keeps context out of the
    # added-line set so we never credit an unchanged line to this commit.
    git show --format= --unified=0 "$sha" -- "$f" 2>/dev/null \
      | awk -v min="$MIN_SIGNIFICANT_CHARS" '
          /^\+/ && !/^\+\+\+/ {
            line = substr($0, 2);
            probe = line; gsub(/[ \t]/, "", probe);
            if (length(probe) >= min) print line;
          }' >> "$WORK/cand.txt"
    printf '%s\x1f%s\n' "$sha" "$subject" >> "$WORK/localcommits.txt"
  done < <(git log --no-merges --format='%H%x1f%s' --max-count="$MAX_LOCAL_COMMITS" "$MERGE_BASE" -- "$f" 2>/dev/null)

  [ "$had_local" -eq 1 ] || continue
  [ -s "$WORK/cand.txt" ] || continue

  sort -u "$WORK/cand.txt" > "$WORK/cand.uniq" && mv "$WORK/cand.uniq" "$WORK/cand.txt"

  discarded="$(awk -v BASEF="$WORK/base.txt" -v HEADF="$WORK/head.txt" \
                   -v CANDF="$WORK/cand.txt" -f "$WORK/discard.awk")"

  [ -n "$discarded" ] || continue

  if [ -n "$PR_BODY" ] && printf '%s' "$PR_BODY" | grep -Fq "ACK-DISCARD: $f"; then
    echo "  ~ $f — discard ACKNOWLEDGED in PR body (ACK-DISCARD)"
    acked_files=$((acked_files + 1))
    continue
  fi

  if [ "$flagged_files" -eq 0 ]; then
    echo ""
    echo "ERROR: this PR discards locally-authored work in shared COC artifacts."
    echo "Each line below is present in the tree this PR merges against and is"
    echo "absent from the PR's version of the file."
    echo ""
  fi
  flagged_files=$((flagged_files + 1))

  n_lost="$(printf '%s\n' "$discarded" | wc -l | tr -d ' ')"
  echo "  ✗ $f  ($n_lost locally-authored line(s) dropped)"
  echo "      local commits that authored them:"
  while IFS=$'\x1f' read -r sha subject; do
    [ -n "$sha" ] || continue
    echo "        ${sha:0:12}  $subject"
  done < <(sort -u "$WORK/localcommits.txt" 2>/dev/null | head -5)
  echo "      sample of what would be lost:"
  printf '%s\n' "$discarded" | head -5 | sed 's/^/        - /'
  if [ "$n_lost" -gt 5 ]; then
    echo "        … and $((n_lost - 5)) more"
  fi
  echo ""
done < "$changed"

echo "gate-a: scanned $scanned_files file(s); $flagged_files flagged, $acked_files acknowledged"

if [ "$flagged_files" -gt 0 ]; then
  cat <<'EOF'

This is the failure mode the gate exists for: an inbound sync regenerating a
shared artifact from the upstream canonical copy, which does not carry a fix
that landed here. Merging would revert it with no conflict and no warning.

Resolve by ONE of:

  1. Re-apply the local fix on top of the incoming version, in this PR.
  2. Route the fix upstream so the canonical copy carries it, then re-sync.
     (.claude/ artifacts are Class-A non-durable per rules/artifact-flow.md —
      a local edit alone is rebuilt away by the next /sync-to-use, so the
      durable surface is the upstream proposal, not the file.)
  3. If the removal is deliberate, add a line to the PR body for each path:
         ACK-DISCARD: <path>
     The discard then proceeds — recorded, reviewed, and no longer silent.

EOF
  exit "$E_AT_RISK"
fi

echo "✓ gate-a: no locally-authored line in a shared .claude/ artifact is discarded"
exit "$E_CLEAN"
