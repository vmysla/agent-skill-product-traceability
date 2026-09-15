# Changelog

Release notes for Product Traceability. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [2.0.0] - Unreleased

A rebuild around one finding: when the agent maintains its own records, it spends its turns
on bookkeeping. In version 2, hooks keep the record and the agent does the work.

### Added

- Hooks for `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop` and `SessionEnd` that
  build the product record from prompts, edits and final messages.
- One Haiku extraction call per turn that changes code, with an evidence guard that keeps
  only decisions quoted from the final message or the diff.
- A deterministic compiler for `docs/product-traceability/requirements.md`, `decisions.md`,
  `traceability-matrix.md` and `change.log`.
- A memory summary of up to 30 lines in Claude Code's memory, with one topic file per
  decision, so each new session starts with the files, a source map, requirement statuses,
  recent changes and the rules in force.
- Standing checks in `check/`, run after edits, with a failing check reported once.
- **Product Traceability Light**: the six working rules on their own, installed with
  `./install.sh --light`.
- `ab-study/`: the controlled study (three apps, three setups, three runs each), with specs,
  graders, the tested builds, the runner and the raw sessions of all 27 runs.
- `tests/check.sh` and CI, contributing guide, code of conduct, security policy, issue and
  pull request templates, citation file.

### Changed

- `install.sh` now has full, `--light` and `--uninstall` modes. Every mode removes version 1
  and the other mode first.
- The agent no longer reads or edits record files.
- Records live in `docs/product-traceability/` instead of the project root.

### Removed

- The version 1 hooks, rules and templates, and the requirement that the agent update four
  files at the end of every task.

### Measured

Compared with plain Claude Code, averaged over three apps: Product Traceability was 38%
cheaper and 38% faster; Product Traceability Light was 41% cheaper and 50% faster. See the
[README](README.md#results).

## [1.0.0] - 2026-04-21

- First release: a skill and three hooks that asked the agent to keep `requirements.md`,
  `change.log`, `decisions.md` and `traceability-matrix.md` in the project root up to date.
- Its early impact estimates were withdrawn in September 2026. A controlled test measured
  version 1 at 2 to 2.9 times the cost of plain Claude Code, with the same results.

[2.0.0]: https://github.com/vmysla/agent-skill-product-traceability/compare/7bbdd82...HEAD
[1.0.0]: https://github.com/vmysla/agent-skill-product-traceability/tree/7bbdd82
