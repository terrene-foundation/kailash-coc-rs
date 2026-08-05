#!/usr/bin/env bash
# Gate B — obsoleted ∩ shipped disjointness.
#
# `.claude/.coc-obsoleted` is the purge manifest a downstream consumer's
# `/sync-from-template` reads and DELETES from its own checkout. Every path it
# lists is therefore an instruction: "delete this, the template no longer ships
# it." If the SAME tree that carries the manifest also SHIPS one of those paths,
# the release is self-contradicting — it hands the consumer a file and, in the
# same breath, tells the consumer to delete it. The consumer obeys the manifest,
# so the file is destroyed on arrival.
#
# This is issue #78's own suggested fix, and the invariant is a one-liner:
#
#     obsoleted ∩ shipped = ∅
#
# Membership is judged by `git ls-files` — what the tree TRACKS, i.e. what a
# consumer actually receives — not by `test -e`, which would also count untracked
# local scratch files that no consumer ever sees.
#
# EXIT CONTRACT — three-valued, matching Gate A and the shipped
# `sync-preflight-local-mods.mjs`. Collapsing these is the fail-open both gates
# exist to prevent (`rules/evidence-first-claims.md` MUST-3: an errored command
# is zero evidence, never confirmation):
#
#   0 = disjoint (or vacuously so: no manifest ⇒ empty ∩ anything = ∅)
#   2 = overlap found; a human decides (each offending path named)
#   1 = the check DID NOT RUN — MUST NEVER be read as safe
#
# The caller MUST fail on BOTH 1 and 2.

set -uo pipefail

E_CLEAN=0
E_DID_NOT_RUN=1
E_OVERLAP=2

MANIFEST="${1:-.claude/.coc-obsoleted}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "gate-b: not inside a git work tree — CHECK DID NOT RUN (this is NOT a pass)" >&2
  exit "$E_DID_NOT_RUN"
fi

if [ ! -f "$MANIFEST" ]; then
  # A consumer that has never synced has no manifest. The intersection is empty
  # because one side is — a genuine pass, not a skipped check.
  echo "gate-b: no $MANIFEST in this tree — intersection vacuously empty."
  exit "$E_CLEAN"
fi

overlap_count=0
entry_count=0

while IFS= read -r raw || [ -n "$raw" ]; do
  # Strip trailing CR so a CRLF-checked-out manifest does not silently
  # stop matching every path (the failure would be a false PASS).
  line="${raw%$'\r'}"
  case "$line" in
    '' | \#*) continue ;;
  esac
  entry_count=$((entry_count + 1))

  # A trailing slash means "directory". `git ls-files -- <dir>` lists every
  # tracked file beneath it, so the same probe serves both entry shapes.
  path="${line%/}"

  tracked="$(git ls-files -- "$path" 2>/dev/null)"
  if [ -n "$tracked" ]; then
    if [ "$overlap_count" -eq 0 ]; then
      echo ""
      echo "ERROR: .coc-obsoleted lists paths this tree still SHIPS."
      echo "A downstream /sync-from-template deletes every path below —"
      echo "including the copy this same release hands it."
      echo ""
    fi
    n="$(printf '%s\n' "$tracked" | wc -l | tr -d ' ')"
    echo "  ✗ $line  (tracked: $n file(s))"
    printf '%s\n' "$tracked" | sed 's/^/        /'
    overlap_count=$((overlap_count + 1))
  fi
done < "$MANIFEST"

if [ "$overlap_count" -gt 0 ]; then
  echo ""
  echo "Overlap: $overlap_count of $entry_count manifest entries."
  echo ""
  echo "Fix options:"
  echo "  1. Remove the path from $MANIFEST (the template DOES still ship it), OR"
  echo "  2. Remove the file from the tree (the template genuinely obsoleted it)."
  echo ""
  echo "Do NOT resolve this by narrowing the check. The two states are"
  echo "contradictory and exactly one of them is the truth."
  exit "$E_OVERLAP"
fi

echo "✓ gate-b: obsoleted ∩ shipped = ∅ ($entry_count manifest entries, 0 shipped)"
exit "$E_CLEAN"
