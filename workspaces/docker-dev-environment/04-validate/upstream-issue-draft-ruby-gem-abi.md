# DRAFT upstream issue — esperie/kailash-rs (NOT FILED — awaiting user approval)

> Per `upstream-issue-hygiene.md` MUST-1 + `repo-scope-discipline.md`: this is a DRAFT
> only. The agent MUST NOT file it against the sibling SDK repo without explicit
> user approval in-session. Body is scrubbed — no consumer/workspace/template
> identifiers, minimal-repro shape only.

**Repo:** `esperie/kailash-rs` · **Title:** `Ruby gem 4.2.0 precompiled native ext links libruby-3.1 but gemspec requires Ruby >= 3.2.0 (unloadable)`

---

## Affected API

The `kailash` Ruby gem, v4.2.0, precompiled platform builds (`aarch64-linux`,
`x86_64-linux`; likely `arm64-darwin`). Entry: `require "kailash"`.

## Minimal repro

```dockerfile
FROM ruby:3.2-slim       # or any standard Ruby 3.2 (e.g. Ubuntu 24.04 ruby-full)
RUN apt-get update && apt-get install -y build-essential && gem install kailash --no-document
RUN ruby -e 'require "kailash"; puts "loaded"'
```

Result:

```
libruby-3.1.so.3.1: cannot open shared object file: No such file or directory
  - .../gems/kailash-4.2.0-aarch64-linux/lib/kailash/kailash.so (LoadError)
```

## Expected vs actual

- **Expected:** the gem declares `required_ruby_version >= 3.2.0`, so `require "kailash"`
  loads on Ruby 3.2.
- **Actual:** the precompiled native extension (`kailash.so`) dynamically links
  `libruby-3.1.so.3.1` — it was built against Ruby **3.1**. It therefore cannot load on
  Ruby 3.2 (the declared floor), AND cannot be installed on Ruby 3.1 (gemspec refuses
  `>= 3.2.0`). No `ruby`-platform (source) gem is published to allow a local rebuild.

## Severity

HIGH — the gem is unloadable on every environment that satisfies its own gemspec; the
Ruby binding is effectively unusable as published.

## Acceptance criteria

- [ ] The precompiled `*-linux` / `*-darwin` gems for the supported Ruby line load via
      `require "kailash"` on a stock interpreter of that line (e.g. build the native ext
      against Ruby 3.2 if the gemspec floor is 3.2.0), OR
- [ ] the gemspec `required_ruby_version` is corrected to match the ABI the binary was
      built against (and a matching interpreter line is documented), OR
- [ ] a `ruby`-platform source gem is published so consumers can rebuild against their
      local Ruby (note: this would require the Magnus/Rust build toolchain at install).
- [ ] A CI smoke step that runs `require "kailash"` on the stock interpreter of each
      supported/published Ruby line.
