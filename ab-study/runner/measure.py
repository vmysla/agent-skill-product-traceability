#!/usr/bin/env python3
"""Per-run measurements shared by collect.py. No model calls.

  cost          manifest cost_usd per batch + the v2 child-extraction calls logged in
                arms/<run>/<arm>/.claude/pr/costs.jsonl (that child session's cost is not in
                the main session's result event, so it is added here)
  regressions   a criterion that passed after one batch and failed after a later one
  round trips   distinct assistant message ids; tool calls deduplicated by tool_use block id
                (Claude Code writes one transcript line per content block and repeats usage)
  categories    product edit/read, verify, harness write/read, orient, git, other
  record touches  main-model tool calls that name a record file; must be 0 for v2

`root` is a data folder holding runs/ and arms/: the study folder for your own runs, or
results/2026-09-replication for the published ones.
"""
import json, math, re, shlex
from pathlib import Path

# Native memory topic files are read on demand by design (the control arm did it too), so
# '/memory/' is not part of the invariant. The invariant is about the RECORD the skill keeps.
RECORD_PATHS = ('docs/product-record/', 'docs/product-traceability/', 'requirements.md', 'change.log',
                'decisions.md', 'traceability-matrix.md')


WRITE_SIGNS = re.compile(r"open\([^)]*['\"]w|\.write\(|writeFileSync|cat\s*>|tee\s|sed\s+-i|>\s*index\.html")


def category(name, inp):
    fp = str(inp.get('file_path') or '')
    cmd = str(inp.get('command') or '')
    if fp.endswith('index.html'):
        return 'P_EDIT' if name in ('Edit', 'Write') else 'P_READ'
    if name in ('Edit', 'Write', 'Read') and fp:
        return 'H_WRITE' if name != 'Read' else 'H_READ'
    if name == 'Bash':
        # Some runs edit the product through python/node heredocs instead of the Edit tool
        # (todo-ctrl-03 did this for every edit). Those are product work, not "other".
        if 'index.html' in cmd and WRITE_SIGNS.search(cmd): return 'P_EDIT'
        if re.search(r'\b(cat|sed -n|grep|head|tail|awk)\b[^|;]*index\.html', cmd): return 'P_READ'
        if re.search(r'\bnode\b|playwright|chromium|--headless|http\.server|npx', cmd): return 'VERIFY'
        if re.search(r'\bgit\b', cmd): return 'GIT'
        if re.search(r'\b(ls|pwd|cat|head|sed|wc|find|which|tree)\b', cmd): return 'ORIENT'
        return 'BASH_OTHER'
    if name in ('Grep', 'Glob'):
        return 'ORIENT'
    return 'OTHER'


def touches_record(name, inp):
    fp = str(inp.get('file_path') or '')
    cmd = str(inp.get('command') or '')
    pat = str(inp.get('path') or '') + ' ' + str(inp.get('pattern') or '')
    hay = [fp]
    if cmd:
        try: hay += shlex.split(cmd)
        except ValueError: hay += cmd.split()
    hay.append(pat)
    return any(any(r in h for r in RECORD_PATHS) for h in hay if h)


def scan(arm_dir: Path, run_dir: Path):
    cats, per_batch, record_hits, turns = {}, {}, [], 0
    for f in sorted(run_dir.glob('batch-*.jsonl')):
        b = int(f.name.split('-')[-1][:2])
        blocks, seen_msgs = {}, set()
        for line in f.read_text().splitlines():
            try: d = json.loads(line)
            except json.JSONDecodeError: continue
            if d.get('type') != 'assistant': continue
            m = d.get('message') or {}
            if m.get('id'): seen_msgs.add(m['id'])
            for c in m.get('content') or []:
                if c.get('type') == 'tool_use' and c.get('id') not in blocks:
                    blocks[c['id']] = c
        turns += len(seen_msgs)
        for c in blocks.values():
            inp = c.get('input') or {}
            k = category(c['name'], inp)
            cats[k] = cats.get(k, 0) + 1
            per_batch.setdefault(b, {}).setdefault(k, 0)
            per_batch[b][k] += 1
            if touches_record(c['name'], inp):
                record_hits.append((b, c['name'], (inp.get('file_path') or inp.get('command') or '')[:90]))
    return cats, per_batch, record_hits, turns


def run_totals(root: Path, run: str, arm: str):
    run_dir = root / 'runs' / run / arm
    man = json.loads((run_dir / 'manifest.json').read_text())
    # math.fsum: exact on every Python version (the built-in sum of floats changed in 3.12)
    main_cost = math.fsum(r['cost_usd'] or 0 for r in man)
    turns = sum(r['num_turns'] or 0 for r in man)
    final = f"{man[-1].get('passed')}/{man[-1].get('total')}"
    # regressions: a criterion that passed then failed later without being superseded
    grades = {}
    for g in sorted(run_dir.glob('grade-*.json')):
        gd = json.loads(g.read_text())
        grades[gd['batch']] = {r['id']: r['pass'] for r in gd['results']}
    best, regs = {}, 0
    for b in sorted(grades):
        for cid, ok in grades[b].items():
            if ok: best.setdefault(cid, b)
            elif cid in best: regs += 1; del best[cid]
    arm_dir = root / 'arms' / run / arm
    extra = 0.0; extra_calls = 0
    costs = arm_dir / '.claude' / 'pr' / 'costs.jsonl'
    if costs.exists():
        for line in costs.read_text().splitlines():
            try:
                extra += float(json.loads(line).get('total_cost_usd') or 0); extra_calls += 1
            except (json.JSONDecodeError, TypeError, ValueError): pass
    return dict(run=run, arm=arm, main_cost=main_cost, extra_cost=extra, extra_calls=extra_calls,
                total=main_cost + extra, turns=turns, final=final, regressions=regs,
                arm_dir=arm_dir, run_dir=run_dir)
