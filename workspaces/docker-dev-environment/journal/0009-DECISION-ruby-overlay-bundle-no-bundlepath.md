---
type: DECISION
date: 2026-05-28
created_at: 2026-05-28T00:55:00Z
author: co-authored
session_id: m2-extensibility-secrets
session_turn: implement
project: docker-dev-environment
topic: Ruby overlay mechanism — drop BUNDLE_PATH, install bundler into GEM_HOME, run bundle install system-wide
phase: implement
tags:
  [m2, ruby, bundler, nfr-12, shared-env, peer-validated-trap, verified-live]
---

# 0009 — DECISION — Ruby overlay installs via `bundle install` WITHOUT `BUNDLE_PATH`

## What was decided

The Ruby no-rebuild overlay path (`bin/dev setup` running `bundle install
--gemfile=Gemfile.user`) MUST run with `BUNDLE_PATH` **unset** (`env -u
BUNDLE_PATH ...`), and the base image MUST NOT export `BUNDLE_PATH`. The
container also installs `bundler` into `/opt/gems` so the `bundle` wrapper
lands on PATH (the default-gem bundler under the system ruby tree is NOT on
PATH because `GEM_HOME` is overridden to `/opt/gems`).

## Why — empirical (live container, 2026-05-28)

The peer red-team's NFR-12 trap ("installed where the running shell can't
see it") was directly reproduced and then resolved:

| Mechanism                              | `paint 2.0.3` landed at                           | Plain-shell `require "paint"` |
| -------------------------------------- | ------------------------------------------------- | ----------------------------- |
| `BUNDLE_PATH=/opt/gems bundle install` | `/opt/gems/ruby/3.2.0/gems/paint-2.0.3/` (nested) | **LoadError**                 |
| `gem install paint`                    | `/opt/gems/gems/paint-2.0.3/` (flat)              | **OK**                        |
| `env -u BUNDLE_PATH bundle install`    | `/opt/gems/gems/paint-2.0.3/` (flat, no `ruby/`)  | **OK**                        |

Bundler's documented behavior: when `BUNDLE_PATH` is set, gems go into the
isolated `<path>/ruby/<ver>/gems/` layout — requireable only via `bundle exec`
or `Bundler.setup`. When `BUNDLE_PATH` is unset, bundler defaults to a
"system" install at `Gem.dir` (= `GEM_HOME` = `/opt/gems` here), producing the
SAME flat `/opt/gems/gems/<name>-<ver>/` layout as a plain `gem install`. The
flat layout is on the default `Gem.path`, so `ruby -e 'require "x"'` resolves
without any bundler context.

## What also surfaced (Ruby spec corrections)

- The pre-implementation spec (`specs/extensibility.md` § Concrete env-pinning
  contract) hypothesised the devcontainer `ruby` Feature + rvm-managed
  gemsets. Reality: M1 installs Ruby via apt `ruby-full` (3.2.3); there is no
  rvm and no per-project gemset. `Gem.path` resolves to a single entry
  (`["/opt/gems"]`) — the gemset-switching concern does not arise. Spec
  updated to describe what ships.
- `bundle` was missing from PATH because the default-gem bundler lives under
  `/usr/lib/ruby/gems/3.2.0/gems/bundler-2.4.19/libexec/`, not on PATH.
  Dockerfile now `gem install bundler` into `/opt/gems`, putting
  `/opt/gems/bin/bundle` on PATH.

## Alternatives considered

1. **Keep `BUNDLE_PATH=/opt/gems`, run overlay via `bundle exec`.** Rejected:
   Flow-2 acceptance is "package importable in the SAME shell" — requiring
   `bundle exec` breaks every plain `ruby -e 'require "..."'` invocation, and
   silently re-creates the trap for any third-party tooling that does not run
   under `bundle exec`.
2. **Replace bundler with plain `gem install` lines parsed from a custom
   format.** Rejected: bundler is the idiomatic Ruby dependency manager;
   parsing custom syntax is fragile and forfeits dependency-resolution.
   System-install bundler gives us the spec's Gemfile shape AND the flat
   layout requireability.
3. **Set `BUNDLE_PATH=/opt/gems` AND `bundle config set --local path.system
true`.** Rejected: bundler 2.4's `path.system` interplay with an explicit
   `BUNDLE_PATH` is opaque; the cleanest contract is to NOT set `BUNDLE_PATH`
   at all so bundler's documented system-install default applies. Verified
   empirically (table above).

## Consequences + follow-ups

- The Dockerfile change rebuilds the image (one-time, ~minutes). The running
  container needs `docker compose build && ./bin/dev` once.
- `Gemfile.user.lock` is generated on first `bin/dev setup` with non-empty
  `Gemfile.user`. Default `.gitignore` leaves it COMMENTED-out (project
  decides whether to commit for reproducibility — application-shape projects
  typically commit; library-shape gitignore).
- The upstream Ruby ABI defect (journal/0006 — `kailash-4.2.0-aarch64-linux`
  links `libruby-3.1.so.3.1` against Ruby 3.2.3) is UNCHANGED by this
  decision; the base `gem install kailash` still succeeds, the runtime
  `require "kailash"` still fails with the documented LoadError. The overlay
  mechanism is now correct for every OTHER gem.
- Spec `extensibility.md` § Concrete env-pinning contract MUST be rewritten
  to describe what ships (this decision); the `UNVERIFIED — /implement MUST
verify` block MUST be removed (spec-accuracy MUST-2 — no "UNVERIFIED" in
  spec content).

## Receipts

- Live verification commands + output: this session's transcript, 2026-05-28.
- Dockerfile diff: drops `BUNDLE_PATH=/opt/gems` ENV; adds `gem install
bundler --no-document` ahead of the kailash gem install.
- `bin/dev` diff: `INSTALL_OVERLAYS_SH` heredoc adds the
  `env -u BUNDLE_PATH BUNDLE_GEMFILE=/workspace/Gemfile.user bundle install`
  invocation, gated on `has_content Gemfile.user`.

## For Discussion

1. **Counterfactual:** if a future bundler release changed the system-install
   default (e.g., made `<gemset>/ruby/<ver>/` the default even without
   `BUNDLE_PATH`), the Flow-2 walk would silently regress to LoadError. What
   test catches that — a Tier-2 regression that runs `bin/dev setup` against a
   real `Gemfile.user` and asserts `ruby -e 'require ...'` works in a plain
   shell? Should we add it to `tests/regression/` (none exists yet for the
   Docker artifacts — the workspace itself is the "test" today)?
2. **Data check:** the empirical comparison used `paint 2.0.3` (pure Ruby).
   A NATIVE-extension overlay gem might involve `bundler` invoking the same
   compile path as `gem install`. Is there any plausible gem class where
   bundler-system-install would diverge from `gem install`'s layout? (We
   already saw that the kailash gem itself loads its `.so` from the flat
   layout — so the layout is symmetric. The remaining risk is gem-specific
   `gemspec` post-install hooks, which are rare.)
3. **Reproducibility:** projects that DON'T commit `Gemfile.user.lock` get
   floating gem versions across teammates. Is the template's "lock-gitignored
   by default" stance right, given the rs template's typical user is a Python
   developer using one or two Ruby gems opportunistically? The comment in
   `.gitignore` explains the choice; should the default flip to
   lock-committed-by-default for application-shape consistency with bundler
   convention?
