#!/usr/bin/env python3
"""Replication phase: control, v2 (frozen v2.6) and rules-only on all three apps, n per cell,
run ONE AT A TIME in a seeded random order so wall clock is valid and no arm is always first
after a rate-limit reset.

  python3 runner/replicate.py --n 3 --seed 20260912              # prefix with caffeinate -i on macOS
  python3 runner/replicate.py --n 1 --apps todo --arms control,v2  # a smaller slice

Each run gets its own run id (<app>-rep-<arm>-<k>) so runs never overwrite each other.
Progress is appended to runs/replicate.log; a run that already has a 10-batch manifest is
skipped, so the script can be restarted after an interruption.
"""
import argparse, json, random, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARMS = {
    'control':      ('control',      None),
    'v2':           ('treatment-v2', ROOT / 'builds' / 'product-traceability-v2.6'),
    'rules-only':   ('treatment-v2', ROOT / 'builds' / 'product-traceability-light'),
}
APPS = ['todo', 'calculator', 'tetris']


def done(run_id, arm_name):
    m = ROOT / 'runs' / run_id / arm_name / 'manifest.json'
    try:
        return len(json.loads(m.read_text())) == 10
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=3)
    ap.add_argument('--seed', type=int, default=20260912)
    ap.add_argument('--apps', default=','.join(APPS))
    ap.add_argument('--arms', default=','.join(ARMS))
    ap.add_argument('--skip-apps', default='', help='drop these apps AFTER the seeded shuffle, so the other cells keep their order')
    a = ap.parse_args()

    cells = [(app, arm, k) for app in a.apps.split(',') for arm in a.arms.split(',') for k in range(1, a.n + 1)]
    random.Random(a.seed).shuffle(cells)
    cells = [c for c in cells if c[0] not in a.skip_apps.split(',')]
    log = ROOT / 'runs' / 'replicate.log'
    with open(log, 'a') as fh:
        fh.write(f"\n=== replication start {time.strftime('%Y-%m-%dT%H:%M:%S')} seed={a.seed} n={a.n} cells={len(cells)} order={cells}\n")

    for i, (app, arm, k) in enumerate(cells, 1):
        arm_name, skill = ARMS[arm]
        run_id = f'{app}-rep-{arm}-{k:02d}'
        if done(run_id, arm_name):
            print(f'[{i}/{len(cells)}] {run_id} already complete, skipping', flush=True)
            continue
        cmd = [sys.executable, str(ROOT / 'runner' / 'run_arm.py'), '--app', app, '--arm', arm_name, '--run', run_id]
        if skill:
            cmd += ['--skill', str(skill)]
        t0 = time.time()
        print(f'[{i}/{len(cells)}] {run_id} starting {time.strftime("%H:%M:%S")}', flush=True)
        with open(ROOT / 'runs' / f'{run_id}.log', 'w') as out:
            rc = subprocess.run(cmd, stdout=out, stderr=subprocess.STDOUT).returncode
        line = f'{time.strftime("%Y-%m-%dT%H:%M:%S")} {run_id} rc={rc} {time.time() - t0:.0f}s\n'
        print(line, end='', flush=True)
        with open(log, 'a') as fh:
            fh.write(line)
    with open(log, 'a') as fh:
        fh.write(f"=== replication done {time.strftime('%Y-%m-%dT%H:%M:%S')}\n")
    print('REPLICATION DONE', flush=True)


if __name__ == '__main__':
    main()
