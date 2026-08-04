# upflow-self-repo-helpers

Instruments for MODULE-LEVEL guards, three of which the subprocess fence suite
(`../upflow-open-never-complete/`) structurally cannot reach:
`sanitizeForReason`, `getProvider`, and the `_lastGitStderr` reset.

**`displayPrId` is NOT in that set, and an earlier revision of this sentence
wrongly said the whole file was.** The fence suite DOES reach it — its
`gh/control-byte-pr-id-neutralized-in-refusal` case supplies a control-byte
`prId` directly on `prRef`, and the same `displayPrId → String(value)` mutation
reds in BOTH suites (measured: `1/45 FAILED` there, `1/8 FAILED` here). The
overlap is deliberate — the fence suite proves the sanitizer holds on the path an
adapter actually builds, this suite proves it against payload classes no adapter
happens to produce — but "structurally cannot reach" was false for that row, and
two READMEs landing in the same commit contradicted each other about it.

Run: `node .claude/audit-fixtures/upflow-self-repo-helpers/run.mjs`
(exit 0 = pass). No CI runner invokes it — like its siblings, this tier is
**committed-fixtures-manually-driven**, not a live gate. Stated plainly rather
than described as blocking.

## Why a second suite

The fence suite drives the ADAPTERS through a real git repo in a child process.
That is right for the fence and wrong for these:

| Guard                  | Why the fence suite cannot instrument it                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `displayPrId`          | **NOT unreachable — deliberate overlap.** The fence suite reaches it and reds on the same mutation; this suite adds payload classes no adapter produces |
| `sanitizeForReason`    | same, plus it must PRESERVE readable non-ASCII, which no adapter case exercises                                                                         |
| `_lastGitStderr` reset | needs two derivations in ONE process; the fence suite spawns one call per case                                                                          |
| `getProvider`          | lives in `vcs-provider.js`, which the fence suite never loads — and which had NO fixture anywhere under `audit-fixtures/`                               |

Every one of these shipped **without** an instrument and was caught by an
adversarial round measuring that its removal left the fence suite fully green.

## Mutation results — measured in `cp -R` sandboxes

| Mutation                                                                         | Cases redded                                              |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `displayPrId` → `String(value)` (drop the `[^0-9]` allowlist)                    | 1 — `displayPrId/strips-every-injection-class`            |
| `displayPrId` → drop the `try/catch` around `String(value)`                      | 1 — `displayPrId/does-not-throw-on-hostile-toString`      |
| `sanitizeForReason` → return input unchanged                                     | 1 — `sanitizeForReason/strips-structure-forging-classes`  |
| `sanitizeForReason` → ASCII-only class (over-tighten)                            | 1 — `sanitizeForReason/preserves-readable-non-ascii`      |
| `getProvider` → `PROVIDERS[id]` (plain index)                                    | 1 — `getProvider/inherited-keys-are-not-providers`        |
| `sanitizeForReason` → narrow the class back (drop U+061C / U+200B-200F / U+FEFF) | 1 — `sanitizeForReason/strips-structure-forging-classes`  |
| `getProvider` → interpolate `id` raw into the refusal reason                     | 1 — `getProvider/refusal-reason-is-sanitized-and-bounded` |
| `_readOriginRemote` → delete `_lastGitStderr = null;`                            | **0 — see below**                                         |

Each suite is **bipolar**: alongside every strip/refuse case there is a
preserve/allow case, because a refusal-only suite cannot detect over-tightening.
`sanitizeForReason` mangling a legitimate non-ASCII path, or `getProvider`
refusing `"github"`, would each be a real regression that a one-sided suite
would pass.

## The one guard with no reddening mutation, and why that is recorded not hidden

Deleting the `_lastGitStderr = null;` reset leaves this suite **green**.

Resolved as an **INERT mutation, not a vacuous test** — the two hypotheses
`instrument-discipline.md` MUST-2(b) requires collapsing. The deleted line sits
at function entry and executes on every call, so the mutation is reached. It
changes nothing because every null-return path a fixture can drive goes through
the `catch`, which always assigns. Measured:

```
call 1 (real repo, no origin) -> THREW; stderr "error: No such remote 'origin'"
                                 -> catch assigns a string
call 2 (nonexistent directory) -> THREW; stderr empty
                                 -> catch assigns null
```

The only branches returning null **without** assigning are `!gitBin` (git absent
from `PATH`) and an empty-stdout success. Neither is reachable from an in-process
fixture without stubbing the module under test — which would instrument the stub,
not the code.

So the reset stays as **defensive** code: correct, one line, and it closes the
latent path if either branch ever becomes reachable. The case
`deriveSelfRepoRef/git-stderr-does-not-leak-across-calls` pins the no-cross-call-
leak PROPERTY, which is worth holding on its own — but it is **not** an instrument
for the reset line and must not be cited as one.

## Source-literal discipline

Payload characters are built with `String.fromCharCode`, never written as source
literals. A bidi override or raw control byte written literally into this file
would be invisible to a reviewer — precisely the property these guards exist to
remove from output.
