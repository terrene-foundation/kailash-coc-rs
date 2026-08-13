#!/usr/bin/env python3
"""Gate C — proposal-manifest evidence freshness.

WHY THIS GATE EXISTS
--------------------
`.claude/.proposals/latest.yaml` is this template's Step-7b manifest: the queue
loom's Gate-1 ingests. Every entry states FACTS to justify a change — "X is
absent", "line N says Z", "11 artifacts cite it" — and Gate-1 acts on those
statements.

Those facts are point-in-time snapshots. A sync then lands and moves the very
files an entry asserts things about, and NOTHING marks the entry's evidence as
expired. On 2026-08-09 a clause-level pass over the manifest found:

  * an entry claiming "11 citing artifacts" where the real figure was 27, five
    of them executable enforcement code rather than prose;
  * an entry asking Gate-1 to determine whether a whole depth-extract tree was
    obsoleted, when the tree shipped and exactly one file was missing;
  * an entry whose `dedup_evidence` said "a grep returns ZERO hits" where the
    same grep returned seven, because the clause had since landed;
  * an entry whose `action: create` named a target that must never cascade.

Each cost Gate-1 either a wasted re-investigation or an under-scoped fix. The
root cause is not any individual entry. It is that evidence has no expiry
signal.

WHAT THIS GATE ACTUALLY DETECTS — AND WHAT IT CANNOT
----------------------------------------------------
It compares each entry's `reconciliation.reconciled_at` against the repo's last
sync (`.claude/VERSION::upstream.synced_at`). An entry whose evidence predates
the last sync is reported UNVERIFIED-SINCE-SYNC: the files it reasons about may
have moved underneath it.

It CANNOT:
  * read a prose claim, so it never says a specific claim is false — only that
    the evidence is older than a sync that could have falsified it;
  * catch a claim falsified by anything other than a sync (a manual edit here,
    or a change in a repo this one only references);
  * re-run the evidence. `reconciled_at` is self-reported and taken on trust.

So a PASS means "no entry got staler in this PR", NEVER "every claim holds".
Stating that plainly is the point: a gate that overstates its reach is the
failure mode it was built to catch.

WHY A RATCHET AND NOT AN ABSOLUTE BAR
-------------------------------------
Failing while any entry is unverified would red every PR until all 94 are
reconciled. An enforcement instrument that cannot pass trains readers to treat
red as normal — the exact defect issue #112 records about this repo's fixture
runners. So the gate fails ONLY when a PR makes the number WORSE than its base.
Reconciling is always green; letting the queue rot is red.

WHY IT LIVES IN .github/ AND NOT .claude/
-----------------------------------------
`.claude/**` is Class-A non-durable (`rules/artifact-flow.md`): a local edit to
a synced file is rebuilt away by the next `/sync-to-use`. A check placed there
would be deleted by the mechanism it guards against. `.github/` is repo-owned
here — the same reasoning `sync-invariants.yml` documents for Gates A and B.

Note the asymmetry: this gate READS `.claude/VERSION`, which sync DOES rebuild.
That is deliberate and correct — sync rewrites it with the NEW sync date, which
is exactly the reference point the freshness comparison needs.

WHERE THE SYNC DATE COMES FROM — A BIJECTION, NOT A FALLBACK
------------------------------------------------------------
Reading live `.claude/VERSION` is correct for the LIVE run and WRONG for the
fixture-driven self-test, and conflating the two broke the gate on 2026-08-13.
The self-test drives committed fixtures whose entries are dated 2026-08-09/10.
An inbound sync moved `upstream.synced_at` from 08-02 to 08-13, so every fixture
entry became "evidence predates sync", the fixture that MUST PASS started
failing, and a REQUIRED check went red on every sync PR for a reason that had
nothing to do with the manifest. A test coupled to state it does not own reports
on that state, not on the thing it names.

So the two modes are now disjoint, and each has exactly one source:

  LIVE mode     (no --manifest / --base-manifest) -> reads `.claude/VERSION`.
                 `--sync-date` is REFUSED here: accepting a pin on the live path
                 would be a one-flag bypass of the freshness comparison itself.
  FIXTURE mode  (--manifest and/or --base-manifest) -> REQUIRES `--sync-date`.
                 Reading live VERSION is refused, so the self-test is a pure
                 function of its committed inputs and no sync can move it.

Neither mode can fall back to the other. Exit 2 in both directions, because a
gate that ran against the wrong reference point is not a gate that passed.

Exit 0 = no regression. Exit 1 = this PR raised the unverified count, OR it
introduced a duplicate (file, action) group whose entries do not state the
coupling. A NEW duplicate group that DOES state it passes: the manifest is
append-only, so a second entry against one target is often the correct shape,
and what matters is that Gate-1 is told to read them together. The coupling is
declared by a non-empty `ingest_note` (top level) or `pairing` /
`cross_reference` / `dedup_note` / `note_for_gate_1` inside `reconciliation:`
on at least one entry in the group. The check is structural — it confirms the
note EXISTS, never that it is correct.

Exit 2 = the manifest is structurally broken (or the gate could not run, which
is reported as a failure rather than a pass, since a gate that did not run is
not a gate that passed).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
from collections import Counter

MANIFEST = ".claude/.proposals/latest.yaml"
VERSION = ".claude/VERSION"

try:
    import yaml
except ImportError:  # pragma: no cover - environment problem, not a data problem
    print("FAIL(gate-c): PyYAML is not installed; the gate could not run.")
    print("  A gate that did not run is NOT a gate that passed — failing loudly.")
    sys.exit(2)


def parse_date(value) -> dt.date | None:
    """Coerce a YAML scalar to a date; None if it is not one.

    PyYAML resolves a bare `2026-08-09` to `datetime.date` and a bare timestamp
    to `datetime.datetime` — it does NOT hand back a string. An earlier version
    of this function accepted only `str` and therefore classified all 70
    already-reconciled entries as unreconciled, i.e. it reported the worst
    possible answer with total confidence. Handle the real types first.
    """
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    if isinstance(value, str):
        try:
            return dt.date.fromisoformat(value.strip()[:10])
        except ValueError:
            return None
    return None


def last_sync_date(repo_root: str) -> tuple[dt.date | None, str]:
    """Authoritative last-sync date, with the field it came from.

    `upstream.synced_at` is the canonical stamp. `changelog[0].date` is the
    fallback and is corroborating, not independent.
    """
    try:
        with open(f"{repo_root}/{VERSION}", encoding="utf-8") as handle:
            version = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        return None, f"unreadable ({exc.__class__.__name__})"

    stamp = parse_date((version.get("upstream") or {}).get("synced_at"))
    if stamp:
        return stamp, "upstream.synced_at"

    changelog = version.get("changelog") or []
    if changelog and isinstance(changelog[0], dict):
        stamp = parse_date(changelog[0].get("date"))
        if stamp:
            return stamp, "changelog[0].date"
    return None, "absent"


def load_entries(text: str) -> list[dict]:
    data = yaml.safe_load(text)
    if not isinstance(data, dict):
        raise ValueError("manifest root is not a mapping")
    changes = data.get("changes")
    if not isinstance(changes, list):
        raise ValueError("manifest has no `changes` list")
    return [c for c in changes if isinstance(c, dict)]


def classify(entries: list[dict], sync: dt.date | None) -> dict:
    """Split entries into verified-since-sync vs not, and find duplicate targets.

    With no sync date available every entry carrying ANY reconciliation counts
    as verified — the comparison that would refine it is unavailable, and
    inventing a stricter answer from a missing input would be a fabricated
    measurement.
    """
    unverified: list[tuple[int, str, str]] = []
    verified = 0

    for index, entry in enumerate(entries):
        target = str(entry.get("file", "<no file:>"))
        block = entry.get("reconciliation")
        stamp = (
            parse_date(block.get("reconciled_at")) if isinstance(block, dict) else None
        )

        if stamp is None:
            # Distinguish the two states. Conflating them sent a reader looking
            # for a missing block that was in fact present with an unreadable
            # date — a different fix entirely.
            if isinstance(block, dict):
                reason = f"reconciliation block present but `reconciled_at` unreadable ({block.get('reconciled_at')!r})"
            else:
                reason = "no reconciliation block"
            unverified.append((index, target, reason))
        elif sync is not None and stamp < sync:
            unverified.append((index, target, f"evidence {stamp} predates sync {sync}"))
        else:
            verified += 1

    counts = Counter((str(e.get("file")), str(e.get("action"))) for e in entries)
    duplicates = {pair: n for pair, n in counts.items() if n > 1}

    # A duplicate group is DOCUMENTED when at least one of its entries states
    # the coupling, so Gate-1 reads them together. Before this existed the gate
    # failed on the duplicate COUNT and then told the author to "add an
    # `ingest_note`" — advice it had no code to check, so an author who did
    # exactly as instructed still got red. A gate whose instruction cannot
    # clear it teaches readers that red is normal, which is the alert-fatigue
    # failure this workflow's header sets out to avoid.
    documented: set[tuple[str, str]] = set()
    for entry in entries:
        pair = (str(entry.get("file")), str(entry.get("action")))
        if pair not in duplicates:
            continue
        block = entry.get("reconciliation")
        block = block if isinstance(block, dict) else {}
        if any(
            str(source.get(key, "")).strip()
            for source, key in (
                (entry, "ingest_note"),
                (block, "pairing"),
                (block, "cross_reference"),
                (block, "dedup_note"),
                (block, "note_for_gate_1"),
            )
        ):
            documented.add(pair)

    return {
        "total": len(entries),
        "verified": verified,
        "unverified": unverified,
        "duplicate_groups": duplicates,
        "documented_duplicates": documented,
    }


def read_ref(ref: str, path: str) -> str | None:
    """`git show <ref>:<path>`; None when the file did not exist at that ref."""
    try:
        return subprocess.run(
            ["git", "show", f"{ref}:{path}"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    except subprocess.CalledProcessError:
        return None


def render(stats: dict, sync: dt.date | None, source: str) -> None:
    print(f"  manifest entries      : {stats['total']}")
    print(f"  verified since sync   : {stats['verified']}")
    print(f"  UNVERIFIED since sync : {len(stats['unverified'])}")
    print(f"  duplicate (file,action) groups: {len(stats['duplicate_groups'])}")
    print(f"  last sync             : {sync if sync else 'UNKNOWN'}  (from {source})")

    if stats["unverified"]:
        print("\n  Entries whose evidence has not been checked since the last sync.")
        print("  This is NOT a claim that any of them is wrong — only that a sync")
        print("  landed after the evidence was taken, so it may have expired:")
        for index, target, why in stats["unverified"]:
            print(f"    [{index:>3}] {target}  — {why}")

    if stats["duplicate_groups"]:
        print("\n  Targets carrying more than one entry. For `modify` these may be")
        print("  genuinely different changes — the point is that Gate-1 should read")
        print("  them TOGETHER, not that any is droppable:")
        for (target, action), n in sorted(stats["duplicate_groups"].items()):
            print(f"    x{n}  {action:<9} {target}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Gate C — proposal evidence freshness")
    parser.add_argument("--repo-root", default=".")
    parser.add_argument(
        "--base-ref", help="compare against this ref; omit to report only"
    )
    # File-based overrides exist so the gate can be driven against small
    # fixtures — including a deliberately-regressing one — without cloning a
    # repo tree or reaching for git. A gate only ever demonstrated PASSING has
    # not been shown to discriminate, which is the standard this repo holds
    # every other instrument to (`rules/instrument-discipline.md` MUST-3).
    parser.add_argument("--manifest", help="read the HEAD manifest from this path")
    parser.add_argument("--base-manifest", help="read the BASE manifest from this path")
    # The fixture mode's reference point. REQUIRED with --manifest/--base-manifest
    # and REFUSED without them — see the module docstring's bijection. Pinning it
    # is what makes the self-test a pure function of its committed inputs.
    parser.add_argument(
        "--sync-date",
        help="pin the last-sync date (fixture mode only, e.g. 2026-08-02)",
    )
    args = parser.parse_args()

    fixture_mode = bool(args.manifest or args.base_manifest)

    if fixture_mode and not args.sync_date:
        print("FAIL(gate-c): fixture mode requires an explicit --sync-date.")
        print("  --manifest / --base-manifest drive committed fixtures, whose entry")
        print("  dates are fixed. Resolving the sync date from the live")
        print(f"  {VERSION} instead would couple the result to state the")
        print("  fixtures do not own: the next sync moves `upstream.synced_at`")
        print("  forward, every fixture entry becomes 'predates sync', and the")
        print("  fixture that MUST pass fails for a reason unrelated to it.")
        print("  Pass the date the fixtures were written against, e.g.")
        print("  --sync-date 2026-08-02.")
        return 2

    if args.sync_date and not fixture_mode:
        print("FAIL(gate-c): --sync-date is fixture-mode only.")
        print("  On the live path the reference point MUST be the repo's own")
        print(f"  {VERSION}::upstream.synced_at. Accepting a pinned date here")
        print("  would let any caller clear the ratchet by naming a date, which")
        print("  is the comparison this gate exists to make.")
        return 2

    if args.sync_date:
        pinned = parse_date(args.sync_date)
        if pinned is None:
            print(f"FAIL(gate-c): --sync-date {args.sync_date!r} is not a date.")
            print("  Expected an ISO date such as 2026-08-02. Refusing rather than")
            print("  silently continuing with no reference point.")
            return 2
        sync, source = pinned, "--sync-date (pinned, fixture mode)"
    else:
        sync, source = last_sync_date(args.repo_root)

    head_path = args.manifest or f"{args.repo_root}/{MANIFEST}"
    try:
        with open(head_path, encoding="utf-8") as handle:
            head_entries = load_entries(handle.read())
    except FileNotFoundError:
        print(f"SKIP(gate-c): no {MANIFEST} in this repo — nothing to check.")
        return 0
    except (yaml.YAMLError, ValueError) as exc:
        print(f"FAIL(gate-c): {MANIFEST} does not parse as a proposal manifest.")
        print(f"  {exc.__class__.__name__}: {exc}")
        print("  A manifest Gate-1 cannot read is worse than a stale one.")
        return 2

    head = classify(head_entries, sync)

    print("Gate C — proposal-manifest evidence freshness")
    print("=" * 62)
    print("HEAD:")
    render(head, sync, source)

    if sync is None:
        print(f"\n  NOTE: no last-sync date ({VERSION}::upstream.synced_at {source}).")
        print("  Staleness could not be computed; only missing reconciliation blocks")
        print("  were counted. Reported as a limitation, not smuggled in as a pass.")

    if not args.base_ref and not args.base_manifest:
        print("\nPASS(gate-c): report-only (no baseline given); nothing compared.")
        return 0

    if args.base_manifest:
        try:
            with open(args.base_manifest, encoding="utf-8") as handle:
                base_text = handle.read()
        except OSError as exc:
            print(f"\nFAIL(gate-c): --base-manifest unreadable: {exc}")
            return 2
    else:
        base_text = read_ref(args.base_ref, MANIFEST)
    if base_text is None:
        where = args.base_ref[:12] if args.base_ref else args.base_manifest
        print(f"\nPASS(gate-c): {MANIFEST} does not exist at base {where};")
        print(
            "  the manifest is new in this PR, so there is no baseline to regress from."
        )
        return 0

    try:
        base = classify(load_entries(base_text), sync)
    except (yaml.YAMLError, ValueError) as exc:
        print(
            f"\nPASS(gate-c): base manifest does not parse ({exc.__class__.__name__});"
        )
        print(
            "  cannot compute a ratchet from an unparseable baseline. HEAD parsed fine,"
        )
        print("  which is the property that matters for this PR.")
        return 0

    print("\nBASE:")
    render(base, sync, source)

    d_unverified = len(head["unverified"]) - len(base["unverified"])
    d_duplicates = len(head["duplicate_groups"]) - len(base["duplicate_groups"])

    print("\nRATCHET:")
    print(
        f"  unverified : {len(base['unverified'])} -> {len(head['unverified'])} ({d_unverified:+d})"
    )
    print(
        f"  duplicates : {len(base['duplicate_groups'])} -> {len(head['duplicate_groups'])} ({d_duplicates:+d})"
    )

    # Only groups this PR INTRODUCED are its responsibility, and only the ones
    # that left the coupling undocumented. A new duplicate group is allowed —
    # the manifest is append-only, so a second entry against one target is
    # often the correct shape — provided Gate-1 is told to read them together.
    new_groups = set(head["duplicate_groups"]) - set(base["duplicate_groups"])
    undocumented_new = sorted(new_groups - head["documented_duplicates"])
    if new_groups:
        documented_new = len(new_groups) - len(undocumented_new)
        print(
            f"  new duplicate groups: {len(new_groups)} "
            f"({documented_new} documented, {len(undocumented_new)} not)"
        )

    if d_unverified > 0 or undocumented_new:
        print("\nFAIL(gate-c): this PR leaves the manifest staler than it found it.")
        if d_unverified > 0:
            noun = "entry carries" if d_unverified == 1 else "entries carry"
            print(f"  {d_unverified} more {noun} evidence")
            print("  unchecked since the last sync. A new entry should state evidence")
            print("  taken NOW; an old one should carry a `reconciliation:` block with")
            print("  `reconciled_at`. Gate-1 acts on these statements as fact.")
        if undocumented_new:
            noun = "target" if len(undocumented_new) == 1 else "targets"
            print(f"  {len(undocumented_new)} newly-duplicated {noun} do not state the")
            print("  coupling, so Gate-1 would meet them as unrelated entries:")
            for target, action in undocumented_new:
                print(f"    {action:9s} {target}")
            print("  Pair them by adding ONE of `ingest_note` (top level) or")
            print("  `pairing` / `cross_reference` / `dedup_note` / `note_for_gate_1`")
            print("  (inside `reconciliation:`) to at least one entry in each group.")
        return 1

    if d_unverified < 0 or d_duplicates < 0:
        print("\nPASS(gate-c): the manifest got fresher in this PR.")
    else:
        print(
            "\nPASS(gate-c): no regression. Note this is a ratchet, not a clean bill —"
        )
        print(
            f"  {len(head['unverified'])} entr{'y' if len(head['unverified']) == 1 else 'ies'} remain unverified since the last sync."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
