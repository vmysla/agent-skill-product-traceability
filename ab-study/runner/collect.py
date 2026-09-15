#!/usr/bin/env python3
"""Per-run and per-arm results for the replication.

  python3 runner/collect.py                                        # your runs: runs/ + arms/
  python3 runner/collect.py --data results/2026-09-replication     # the published runs

Writes runs.csv and summary.md: to results/local/ for your runs, next to the data for a
results folder. Every number is measured from run artifacts:

  cost          manifest cost_usd per batch + v2 child-extraction calls (.claude/pr/costs.jsonl)
  pass          final grade after batch 10; regressions as in measure.run_totals
  round trips   distinct assistant message ids; tool calls deduplicated by block id
  tokens        result-event usage summed over the ten batches (main model)
  api_min       result-event duration_api_ms, summed (time waiting on the API)
  session_min   result-event duration_ms, summed (includes tools and hooks)
  wall_min      manifest elapsed_s, summed; valid because replicate.py runs one run at a time
  lines         every app file (*.html, *.js, *.css) in the arm root, check/ excluded

Only complete runs (10 batches) named <app>-rep-<arm>-<k> are counted.
"""
import argparse, csv, json, statistics as st, sys
from pathlib import Path

STUDY = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from measure import run_totals, scan  # noqa: E402

APPS = ('todo', 'calculator', 'tetris')
ARMS = ('control', 'v2', 'rules-only')
ARM_DIR = {'control': 'control', 'v2': 'treatment-v2', 'rules-only': 'treatment-v2'}
ARM_LABEL = {'control': 'control', 'v2': 'v2 (Product Traceability)', 'rules-only': 'rules-only (Light)'}


def runs_in(root):
    out = []
    for d in sorted((root / 'runs').glob('*-rep-*')):
        if not d.is_dir():
            continue
        app, _, rest = d.name.partition('-rep-')
        arm = rest.rsplit('-', 1)[0]
        if app in APPS and arm in ARM_DIR:
            out.append((app, arm, d.name))
    return out


def measure(root, app, arm, run):
    arm_name = ARM_DIR[arm]
    run_dir = root / 'runs' / run / arm_name
    manifest = run_dir / 'manifest.json'
    if not manifest.exists():
        return None
    man = json.loads(manifest.read_text())
    if len(man) != 10:
        return None
    t = run_totals(root, run, arm_name)
    cats, _, hits, trips = scan(t['arm_dir'], t['run_dir'])
    usage = lambda k: sum((m.get('usage') or {}).get(k) or 0 for m in man)
    api_ms = dur_ms = 0
    for f in sorted(run_dir.glob('batch-*.jsonl')):
        for line in f.read_text().splitlines():
            if '"type":"result"' not in line:
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            api_ms += d.get('duration_api_ms') or 0
            dur_ms += d.get('duration_ms') or 0
    app_files = [f for ext in ('*.html', '*.js', '*.css') for f in t['arm_dir'].glob(ext)]
    passed, total = t['final'].split('/')
    return dict(
        app=app, arm=arm, run=run,
        cost=round(t['total'], 4), haiku=round(t['extra_cost'], 4),
        passed=int(passed), total=int(total), regressions=t['regressions'],
        questions=sum(m.get('questions_asked') or 0 for m in man),
        timeouts=sum(1 for m in man if m.get('timed_out') or m.get('is_error')),
        round_trips=trips, tool_calls=sum(cats.values()),
        output_tokens=usage('output_tokens'), cache_write_tokens=usage('cache_creation_input_tokens'),
        api_min=round(api_ms / 60000, 2), session_min=round(dur_ms / 60000, 2),
        wall_min=round(sum(m.get('elapsed_s') or 0 for m in man) / 60, 2),
        record_touches=len(hits) if arm != 'control' else '',
        lines=sum(len(f.read_text().splitlines()) for f in app_files) if app_files else '',
    )


def fmt(xs, money=False, digits=1):
    if not xs:
        return '-'
    m = st.mean(xs)
    f = (lambda v: f'${v:.2f}') if money else (lambda v: f'{v:.{digits}f}')
    return f(m) + (f' ± {f(st.stdev(xs)).lstrip("$")}' if len(xs) > 1 else '')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--data', default=str(STUDY), help='folder with runs/ and arms/ (default: the study folder)')
    ap.add_argument('--out', default=None, help='where to write runs.csv and summary.md')
    a = ap.parse_args()
    root = Path(a.data).resolve()
    out = Path(a.out).resolve() if a.out else (STUDY / 'results' / 'local' if root == STUDY else root)

    rows = [r for r in (measure(root, *c) for c in runs_in(root)) if r]
    if not rows:
        sys.exit(f'no complete runs under {root}/runs')
    out.mkdir(parents=True, exist_ok=True)
    with open(out / 'runs.csv', 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    cell = lambda app, arm: [r for r in rows if (r['app'], r['arm']) == (app, arm)]
    lines = ['# Replication results', '',
             f'Generated by `runner/collect.py` from {len(rows)} complete runs. Mean ± sample sd. '
             'Cost includes the v2 child-extraction calls.', '']
    head = ('| app | arm | n | cost | criteria passed | regressions | questions | timeouts | round trips '
            '| tool calls | output tokens, main model (k) | API wait (min) | build time (min) | lines | record touches |')
    lines += [head, '|' + '---|' * (head.count('|') - 1)]
    for app in APPS:
        for arm in ARMS:
            g = cell(app, arm)
            if not g:
                continue
            costs = [r['cost'] for r in g]
            sizes = [r['lines'] for r in g if r['lines'] != '']
            lines.append('| ' + ' | '.join([
                app, ARM_LABEL[arm], str(len(g)),
                fmt(costs, money=True) + f" ({', '.join(f'${c:.2f}' for c in costs)})",
                f"{sum(r['passed'] for r in g)}/{sum(r['total'] for r in g)}",
                str(sum(r['regressions'] for r in g)), str(sum(r['questions'] for r in g)),
                str(sum(r['timeouts'] for r in g)),
                fmt([r['round_trips'] for r in g]), fmt([r['tool_calls'] for r in g]),
                fmt([r['output_tokens'] / 1000 for r in g]), fmt([r['api_min'] for r in g]),
                fmt([r['wall_min'] for r in g]),
                f"{min(sizes)}–{max(sizes)}" if sizes else '-',
                '' if arm == 'control' else str(sum(r['record_touches'] for r in g)),
            ]) + ' |')

    # Change vs control, per app and as the plain mean of the apps that have all three cells.
    metrics = (('cost', 'cost'), ('wall_min', 'build time'), ('round_trips', 'round trips'),
               ('output_tokens', 'output tokens (main model)'))
    lines += ['', '## Change vs control', '',
              'Mean of the arm divided by the mean of the same app\'s control, minus one. '
              'Negative is lower: cheaper, faster, fewer round trips, fewer tokens.', '']
    head = '| arm | metric | ' + ' | '.join(APPS) + ' | average |'
    lines += [head, '|' + '---|' * (head.count('|') - 1)]
    for arm in ('v2', 'rules-only'):
        for key, label in metrics:
            per_app = {}
            for app in APPS:
                c, t = cell(app, 'control'), cell(app, arm)
                if c and t:
                    per_app[app] = 100 * (st.mean(r[key] for r in t) / st.mean(r[key] for r in c) - 1)
            vals = [f'{per_app[a]:+.1f}%' if a in per_app else '-' for a in APPS]
            avg = f'{st.mean(per_app.values()):+.1f}%' if per_app else '-'
            lines.append(f'| {ARM_LABEL[arm]} | {label} | ' + ' | '.join(vals) + f' | {avg} |')

    (out / 'summary.md').write_text('\n'.join(lines) + '\n')
    print('\n'.join(lines))
    print(f'\nwrote {out / "runs.csv"} and {out / "summary.md"}')


if __name__ == '__main__':
    main()
