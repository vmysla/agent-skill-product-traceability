# Contributing to Product Traceability

Thanks for helping. Bug reports, ideas, study reruns and pull requests are all welcome.

## Ways to contribute

- **Report a bug.** Open an issue with the bug template. Include your Claude Code version,
  your OS, and whether you installed the full version or Light.
- **Suggest a feature.** Open an issue with the feature template and describe the problem
  before the solution.
- **Rerun the study.** Results from other machines, models or Claude Code versions are
  valuable, including results that disagree with ours. Follow
  [`ab-study/README.md`](ab-study/README.md) and open an issue with your `summary.md`.
- **Send a pull request.** For anything larger than a small fix, open an issue first so we
  can agree on the approach.

## Development setup

You need `bash`, `python3`, `git` and, to try the plugin for real, the `claude` CLI.
The plugin has no dependencies beyond the Python standard library. Please keep it that way.

```bash
git clone https://github.com/vmysla/agent-skill-product-traceability.git
cd agent-skill-product-traceability
./tests/check.sh     # fast checks, no Claude usage; CI runs the same script
```

To try your changes in Claude Code, run `./install.sh` from your clone, then open any git
project. `./uninstall.sh` restores your setup.

## What to check before opening a pull request

1. `./tests/check.sh` passes.
2. The README and the help text in `install.sh` match what the code does.
3. If you changed anything the agent reads (`skill/`, `bin/working-rules.md`,
   `light/CLAUDE.md`, the memory summary in `bin/memory.py`, or the hook output), say so in
   the pull request. Small wording changes can move cost and speed. Run at least a small
   slice of the study against the released plugin and share the numbers:

   ```bash
   cd ab-study && npm install && npx playwright install chromium
   python3 runner/run_arm.py --app todo --arm treatment-v2 --run todo-rep-v2-dev01 --skill ..
   python3 runner/collect.py
   ```

   A single todo run costs about $3. Please read the safety note in the study README first.
4. If you changed how results are measured or reported, `ab-study/results/` must still
   recompute exactly; `tests/check.sh` checks this.

## Style

- Shell scripts run under bash 3.2 (the macOS default) and `set -euo pipefail` where they
  are not hooks. Hooks must never fail loudly: an error in a hook shows up in the user's
  session on every turn.
- Python uses the standard library only and runs on Python 3.9 and later.
- Keep `ab-study/builds/` untouched. Those folders are the exact builds that produced the
  published results.
- Plain, short documentation. Numbers in the README must come from `ab-study/results/`.

## Project records

This project is built with Product Traceability, but its own records (requirements,
decisions, the traceability matrix, the change log and session logs) are kept in a private
repository, `product-tracebility-ab-testing`, owned by Vlad Mysla. They are ignored by git
here, so the plugin can run while you work without publishing them. If you need access to
those records to contribute, write to Vlad at
[vlad.mysla@gmail.com](mailto:vlad.mysla@gmail.com).

## Code of conduct

Everyone taking part is expected to follow the [code of conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
