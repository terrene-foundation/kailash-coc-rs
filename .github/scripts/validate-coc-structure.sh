#!/usr/bin/env bash
# COC structure validation for this USE template.
#
# WHY THIS FILE EXISTS.  `validate.yml` declares TWO jobs that run this identical
# body — one for push-to-main and PRs onto the default branch, one for PRs onto
# any other base (stacked PRs). The split is explained in that workflow's header;
# the short version is that check runs are scoped to the head SHA rather than to
# the PR, and this validation's tree comes from `refs/pull/N/merge`, so its
# verdict depends on the base.
#
# The body lives here, once, so the two jobs cannot drift apart. A validation
# that disagrees with its own copy is worse than one that does not run.
#
# Exit: 0 = all checks passed; 1 = a check failed (or could not run).

set -euo pipefail

echo "Checking COC structure..."

# Verify critical directories exist
test -d .claude/agents && echo "✓ agents/"
test -d .claude/skills && echo "✓ skills/"
test -d .claude/rules && echo "✓ rules/"
test -d .claude/commands && echo "✓ commands/"

# Multi-CLI USE template MUST emit one baseline per CLI at root
# (claude → CLAUDE.md, codex → AGENTS.md, gemini → GEMINI.md).
# Per cross-cli-parity.md MUST Rule 3 the three baselines are the
# always-on surface for each CLI; missing one means that CLI's
# users get a silently weaker rule surface.
test -f CLAUDE.md && echo "✓ CLAUDE.md (claude baseline)"
test -f AGENTS.md && echo "✓ AGENTS.md (codex baseline)"
test -f GEMINI.md && echo "✓ GEMINI.md (gemini baseline)"

# This template serves Python/Ruby developers who consume kailash-rs
# through bindings. src/kailash/ (kailash-py SDK source) paths should
# NOT leak in, EXCEPT for allowlisted files (provenance, compliance,
# cross-SDK navigation).
#
# See .github/coc-sdk-refs-allowlist.txt to add exemptions.
# The allowlist is auto-extended by loom's coc-sync agent on every
# /sync Gate 2 distribute (see loom/.claude/agents/management/
# coc-sync.md § "Step 7.5: Refresh SDK-Refs Allowlist").
ALLOWLIST=.github/coc-sdk-refs-allowlist.txt
if [ ! -f "$ALLOWLIST" ]; then
  echo "ERROR: missing $ALLOWLIST"
  exit 1
fi

# Strip comments/blanks from allowlist, sort for comm
grep -vE '^\s*(#|$)' "$ALLOWLIST" | sort > /tmp/allowed.txt

# Find all .claude/ files containing src/kailash/ (py SDK contamination)
grep -rl "src/kailash/" .claude/ 2>/dev/null | sort > /tmp/found.txt || true

# Compute: found \ allowed (files with contamination not on allowlist)
contamination=$(comm -23 /tmp/found.txt /tmp/allowed.txt)

if [ -n "$contamination" ]; then
  echo ""
  echo "ERROR: src/kailash/ (kailash-py SDK paths) found in files not on allowlist:"
  echo "$contamination" | sed 's/^/  /'
  echo ""
  echo "This template is for Python/Ruby developers consuming kailash-rs."
  echo "Fix options:"
  echo "  1. Remove the src/kailash/ reference (if accidental py SDK leak), OR"
  echo "  2. Add the file path to $ALLOWLIST (if legitimately needs cross-SDK"
  echo "     reference — e.g., provenance, compliance, sync-flow navigation)"
  echo ""
  echo "If this fired during a downstream /sync of a fresh loom release,"
  echo "the upstream coc-sync allowlist auto-refresh did not run. Re-run"
  echo "/sync at loom/ — Step 7.5 will append the new entries."
  exit 1
fi

echo "✓ No kailash-py SDK contamination ($(wc -l < /tmp/allowed.txt) allowlisted)"

# Count agents and skills
echo "Agents: $(find .claude/agents -name '*.md' | wc -l)"
echo "Skills: $(find .claude/skills -name '*.md' | wc -l)"
echo "Rules: $(find .claude/rules -name '*.md' | wc -l)"
echo "Commands: $(find .claude/commands -name '*.md' | wc -l)"
echo "All checks passed!"
