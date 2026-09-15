# A/B study: Product Traceability vs plain Claude Code

This folder holds everything needed to check or rerun the study behind the numbers in the
main README: the task specs, the graders, the runner, the exact plugin builds that were
tested, and the raw sessions of all 27 published runs. Nothing here is installed by
`install.sh`.

## What it measures

Claude Code builds three small web apps (a todo list, a calculator and a tetris game) from
ten batches of requirements each. Every batch runs in a fresh headless session, so anything
the agent knows about earlier batches has to come from the code, from Claude Code's own
auto-memory, or from the plugin. The batches change like real projects do: requirements
grow, one conflicts with an earlier decision, one reverses an earlier feature, one reports
a bug, and one refers back to an earlier choice without restating it.

After each batch a Playwright grader checks every acceptance criterion introduced so far.

Three arms build each app:

| arm | build | what the agent gets |
|---|---|---|
| `control` | none | plain Claude Code, auto-memory on |
| `v2` | [`builds/product-traceability-v2.6`](builds/product-traceability-v2.6) | Product Traceability: hooks, the product record, a 30-line memory block, working rules |
| `rules-only` | [`builds/product-traceability-light`](builds/product-traceability-light) | Product Traceability Light: the six working rules in `CLAUDE.md`, no hooks, no record |

`builds/product-traceability-v2.6` is byte-for-byte the build that was tested. It predates
the rename, so it calls itself `product-record` and writes `docs/product-record/`. The
plugin at the repository root differs only in those names.

## Published results

27 runs: 3 apps x 3 arms x 3 runs, run one at a time in a seeded random order (seed
20260912), Claude Code 2.1.269, model `claude-opus-5`. Calculator and tetris ran on
2026-09-12, todo on 2026-09-13. Together they cost $111 and took 5.1 hours.

Average across the three apps, compared with control:

| arm | cost | build time | API round trips | criteria passed |
|---|---|---|---|---|
| control | | | | 258/258 |
| Product Traceability (`v2`) | 38.5% lower | 38.3% faster | 54.6% fewer | 256/258 |
| Product Traceability Light (`rules-only`) | 40.7% lower | 49.6% faster | 50.5% fewer | 257/258 |

No run had a regression (a criterion that passed and later failed), a timeout or an error.
The three missed criteria were all introduced in the last batch. Per-app numbers, spreads
and every metric are in
[`results/2026-09-replication/summary.md`](results/2026-09-replication/summary.md); one row
per run is in [`runs.csv`](results/2026-09-replication/runs.csv).

Recompute both files from the raw sessions (Python 3, no packages):

```bash
python3 runner/collect.py --data results/2026-09-replication
```

## Rerun the study

### What you need

- macOS or Linux, `git`, Python 3.9+, Node.js 18+
- [Claude Code](https://claude.com/claude-code), logged in, with access to `claude-opus-5`
- About $110 of usage and 5 hours for all 27 runs. Cost is charged to the account the
  `claude` CLI is logged in to.

**Run it somewhere disposable.** The runner starts Claude Code with
`--permission-mode bypassPermissions`, so the agent can run any command without asking.
It works inside `arms/`, but nothing stops it from leaving that folder. Use a virtual
machine, a container or a separate user account.

### Set up

```bash
cd ab-study
npm install
npx playwright install chromium

# Optional: check the graders against the reference apps (expect 33/33 and 29/29)
node runner/grade.mjs reference/calculator 10 /tmp/grade-calculator.json calculator
node runner/grade.mjs reference/tetris 10 /tmp/grade-tetris.json tetris
```

Remove any global Product Traceability or Light install first (`../uninstall.sh`), so your
own setup does not leak into the arms.

### Run

All 27 runs, in the published order (restartable; complete runs are skipped):

```bash
python3 runner/replicate.py --n 3 --seed 20260912     # on macOS: caffeinate -i python3 ...
```

A smaller slice, or a single run:

```bash
python3 runner/replicate.py --n 1 --apps todo --arms control,v2
python3 runner/run_arm.py --app calculator --arm control --run calculator-rep-control-01
python3 runner/run_arm.py --app calculator --arm treatment-v2 --run calculator-rep-v2-01
python3 runner/run_arm.py --app calculator --arm treatment-v2 --run calculator-rep-rules-only-01 \
    --skill builds/product-traceability-light
```

To test the plugin as released rather than the frozen build, pass `--skill ..`. To try
another model, set `AB_MODEL`.

### Read your results

```bash
python3 runner/collect.py        # writes results/local/runs.csv and results/local/summary.md
```

Compare them with `results/2026-09-replication/summary.md`. Expect run-to-run spread: the
published cost standard deviations range from $0.04 to $0.58 per app and arm.

## How a run works

- Each batch is one `claude -p` session in `arms/<run>/<arm>/` with
  `--setting-sources project,local` (your user settings, hooks and plugins are not loaded),
  a $6 budget and a 15-minute cap.
- If the agent asks a question, it gets the same reply every time: "Proceed according to
  the information already provided. Do not ask further questions." Questions are counted.
- After each batch the runner commits the arm and grades it. Claude Code's auto-memory for
  the arm is cleared when a run starts, so reusing a run id starts clean.

## What can move your numbers

- **Model and CLI versions.** Results were measured on Claude Code 2.1.269 and
  `claude-opus-5`. Set `DISABLE_AUTOUPDATER=1` to keep the CLI from updating mid-study.
- **Account connectors.** If your claude.ai account has connectors (Gmail, Drive and so
  on), their tool names add about 1,000 tokens to a session's prompt when they load. They
  load in most sessions but not all. In the published todo runs they loaded in the `v2`
  sessions but not in the `control` or `rules-only` sessions, which makes those two arms up
  to $0.14 cheaper per build than they would otherwise be.
- **The grader.** It checks listed criteria only. Its single-file check blocks remote
  scripts but not a second local file; two published Light runs on todo split their code
  into a second file and still passed.

## Files

```
ab-study/
├── specs/<app>/full-prd.md              the whole spec, for reference
├── specs/<app>/batches/01.md ... 10.md  what each session is asked to build
├── reference/<app>/index.html           correct apps, used to validate the graders
├── builds/                              the tested plugin builds (see above)
├── runner/
│   ├── replicate.py                     all runs, one at a time, seeded order
│   ├── run_arm.py                       one run: ten sessions, commit and grade after each
│   ├── grade.mjs, acceptance.<app>.mjs  Playwright grader and the criteria per batch
│   ├── measure.py                       cost, regressions, round trips, record touches
│   └── collect.py                       runs.csv and summary.md
└── results/2026-09-replication/
    ├── runs/<run>/<arm>/                batch-NN.jsonl (raw session), grade-NN.json, manifest.json
    ├── arms/<run>/<arm>/                the finished app and, for v2, its record
    ├── runs.csv
    └── summary.md
```

In `results/2026-09-replication/arms/`, each arm's git history and the plugin files copied
in at setup (identical to `builds/`) are left out. Transcripts contain the author's local
paths.
