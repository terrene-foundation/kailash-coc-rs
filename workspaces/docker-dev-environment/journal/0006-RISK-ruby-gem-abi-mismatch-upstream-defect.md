# 0006 — RISK — `kailash` gem 4.2.0 is unloadable: gemspec/binary ABI contradiction (UPSTREAM)

**Date:** 2026-05-27 · **Phase:** /implement (M1, smoke walk) · **Severity:** HIGH (blocks Goal #3 Ruby half)
**Class:** upstream SDK defect (NOT a template bug)

## What the smoke walk found

`ruby -e 'require "kailash"'` inside the built container fails:

```
libruby-3.1.so.3.1: cannot open shared object file: No such file or directory
  - /opt/gems/gems/kailash-4.2.0-aarch64-linux/lib/kailash/kailash.so (LoadError)
```

## Root cause — a self-contradictory gem package

| Fact                                                                       | Source                                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Gemspec declares `required_ruby_version >= 3.2.0`                          | rubygems API: `kailash` 4.2.0 `aarch64-linux` / `x86_64-linux` / `arm64-darwin` all say `ruby >= 3.2.0` |
| The precompiled native ext links `libruby-3.1.so.3.1`                      | the LoadError above — built against Ruby **3.1**                                                        |
| Container Ruby = 3.2.3 (Ubuntu 24.04 default; satisfies the gemspec floor) | `ruby --version` in-container                                                                           |
| No `ruby`-platform (source) gem exists to rebuild against 3.2              | rubygems API: only the three precompiled `*-linux`/`*-darwin` platforms                                 |

The gem is therefore unloadable on EVERY standard environment:

- **Ruby 3.2** (gemspec-compatible): binary won't load — needs the 3.1 ABI.
- **Ruby 3.1** (binary-compatible): `gem install` refuses — gemspec floor is `>= 3.2.0`.
- **Source build**: no `ruby`-platform gem published → `gem install --platform=ruby` finds nothing (and would need the Rust/Magnus toolchain, which the slim base excludes by design).

There is NO consumer-side fix. The template correctly installs Ruby 3.2 (the gemspec-declared floor) and the gem (which installs cleanly); the gem's binary is mis-built. This is an upstream packaging defect in `esperie/kailash-rs`.

## Disposition

1. **Python binding works fully** (`kailash-enterprise 4.2.2`, `import kailash` OK, Rust-path build-assertion green) — the env is fully functional for Python consumers.
2. **Ruby binding** is blocked on the upstream gem fix. Per `zero-tolerance.md` Rule 1 exception (upstream third-party defect unresolvable in-session → documented reason + upstream issue link) + CLAUDE.md directive #4 (SDK bugs → GitHub issue on `esperie/kailash-rs`, not workarounds).
3. **Upstream issue drafted** (scrubbed, minimal repro) — filing is **human-gated** per `upstream-issue-hygiene.md` MUST-1 + `repo-scope-discipline.md` (no self-authorized cross-repo filing). Draft in `04-validate/upstream-issue-draft-ruby-gem-abi.md`.
4. **No build-time `require "kailash"` gate baked** — that would hard-fail the whole image over an upstream Ruby bug, blocking the working Python half. The Ruby load check stays in the runtime smoke test, reporting the known limitation.

## Why this is NOT a "fake it" violation

Per `zero-tolerance.md`: we do NOT stub or fake the Ruby binding. We install the real gem; it genuinely doesn't load due to an upstream mis-build; we document it precisely and route the fix to the SDK. The alternative (silently dropping Ruby, or a fake shim) is what's BLOCKED.
