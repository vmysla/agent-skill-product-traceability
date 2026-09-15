#!/usr/bin/env python3
"""Drive one arm through the 10 batches of an app spec.

  python3 runner/run_arm.py --app todo --arm control --run todo-rep-control-01
  python3 runner/run_arm.py --app todo --arm treatment-v2 --run todo-rep-v2-01
  python3 runner/run_arm.py --app todo --arm treatment-v2 --run todo-rep-rules-only-01 \
      --skill builds/product-traceability-light

Outputs: runs/<run>/<arm>/ (transcripts, grades, manifest) and arms/<run>/<arm>/ (the app).

KEY DESIGN DECISION — each batch is a FRESH Claude Code session.

If the whole app were built in one continuous session, the conversation history would itself
be the memory, and the four trace files would have nothing to do. Traceability is a
cross-session mechanism, so the batches must be separated by session boundaries or the study
cannot detect anything. Each batch therefore gets its own `claude -p` invocation with no
--resume and no --continue. The control arm carries over the code it already wrote and
Claude Code's own auto-memory; a treatment arm additionally has whatever its build installs.

Future batches never touch the arm's working tree — they are passed on stdin from specs/,
which lives outside the arm directory.
"""
import argparse, json, os, re, select, shutil, subprocess, sys, time, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL_V2 = ROOT / 'builds' / 'product-traceability-v2.6'   # the exact build the published runs used
MODEL = os.environ.get('AB_MODEL', 'claude-opus-5')           # the published runs used claude-opus-5
BUDGET_PER_BATCH = '6'
BATCH_TIMEOUT_S = 900          # hard cap per batch
GRADE_TIMEOUT_S = 300          # hard cap per grading pass


def sh(cmd, cwd=None, **kw):
    return subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), **kw)


def clear_native_memory(arm_dir: Path):
    """Remove Claude Code's auto-memory for this arm path, if an earlier run left one.

    Claude Code keeps auto-memory per project path, under <config>/projects/<slug>/memory,
    outside the arm directory. Deleting the arm does not delete it, so a rerun under the same
    run id would start with the previous run's notes.
    """
    config = Path(os.environ.get('CLAUDE_CONFIG_DIR') or Path.home() / '.claude')
    slug = re.sub(r'[^A-Za-z0-9]', '-', str(arm_dir.resolve()))
    mem = config / 'projects' / slug / 'memory'
    if mem.is_dir():
        shutil.rmtree(mem)
        print(f'removed auto-memory left by an earlier run: {mem}', flush=True)


def setup_arm(arm_dir: Path, arm: str, skill: Path):
    """Create a fresh arm working tree.

    control      — bare git repo, nothing else.
    treatment    — v1 skill: skill/ copied to .claude/skills, hooks/*.sh to .claude/hooks, and
                   the fixed three-hook settings.json. Byte-identical to the published pilot.
    treatment-v2 — any skill directory that ships `project-settings.json`; that template is
                   written as .claude/settings.json with {HOOKS_DIR} / {SKILL_DIR} / {BIN_DIR}
                   substituted, so a redesigned skill can register whatever hook events it
                   needs without the runner knowing about them. Everything under skill/, hooks/
                   and bin/ is copied.
    """
    if arm_dir.exists():
        shutil.rmtree(arm_dir)
    clear_native_memory(arm_dir)
    arm_dir.mkdir(parents=True)
    sh(['git', 'init', '-q'], cwd=arm_dir, check=True)
    sh(['git', 'config', 'user.email', 'ab-study@local'], cwd=arm_dir)
    sh(['git', 'config', 'user.name', 'AB Study'], cwd=arm_dir)

    if arm != 'control':
        cl = arm_dir / '.claude'
        (cl / 'skills').mkdir(parents=True)
        (cl / 'hooks').mkdir(parents=True)
        skill_src = skill / 'skill'   # absent in the Light build
        for sk in (skill_src.iterdir() if skill_src.is_dir() else []):
            if sk.is_dir():
                shutil.copytree(sk, cl / 'skills' / sk.name)
        for f in (skill / 'hooks').glob('*'):
            if f.is_file():
                dst = cl / 'hooks' / f.name
                shutil.copy(f, dst)
                dst.chmod(0o755)
        bin_dir = None
        if (skill / 'bin').is_dir():
            bin_dir = cl / 'bin'
            shutil.copytree(skill / 'bin', bin_dir)
            for f in bin_dir.glob('*'):
                f.chmod(0o755)
        # A skill may ship a CLAUDE.md for the arm root (the rules-only arm delivers the v2
        # working rules this way, with no hooks and no record).
        if (skill / 'CLAUDE.md').exists():
            shutil.copy(skill / 'CLAUDE.md', arm_dir / 'CLAUDE.md')
        hooks_dir = (cl / 'hooks').resolve()
        template = skill / 'project-settings.json'
        if template.exists():
            text = template.read_text()
            text = text.replace('{HOOKS_DIR}', str(hooks_dir))
            text = text.replace('{SKILL_DIR}', str((cl / 'skills').resolve()))
            text = text.replace('{BIN_DIR}', str(bin_dir.resolve()) if bin_dir else '')
            json.loads(text)                      # fail loudly on a broken template
            (cl / 'settings.json').write_text(text)
        else:
            h = lambda n: {"hooks": [{"type": "command", "command": f"{hooks_dir}/{n}"}]}
            (cl / 'settings.json').write_text(json.dumps({"hooks": {
                "SessionStart":     [h("session-start.sh")],
                "UserPromptSubmit": [h("user-prompt-submit.sh")],
                "Stop":             [h("stop.sh")],
            }}, indent=1))
    sh(['git', 'add', '-A'], cwd=arm_dir)
    sh(['git', 'commit', '-q', '-m', 'arm setup', '--allow-empty'], cwd=arm_dir)


# Identical for both arms. Content-free on purpose: if the runner answered questions with
# substance, an arm that asks more would receive more information, and the comparison would
# be confounded. The COUNT of questions is itself a metric — the control arm has no record to
# consult, so if the record is doing work, the control should need to ask more often.
NEUTRAL_REPLY = "Proceed according to the information already provided. Do not ask further questions."
IDLE_NUDGE_S = 180


def _send(proc, text):
    msg = {"type": "user", "message": {"role": "user",
           "content": [{"type": "text", "text": text}]}}
    proc.stdin.write(json.dumps(msg) + "\n")
    proc.stdin.flush()


def run_batch(arm_dir: Path, prompt: str, out_jsonl: Path):
    """One fresh headless session, supervised.

    The runner keeps stdin open as a pipe and watches the output stream. If the agent asks a
    question it is answered with a fixed neutral reply and the question is logged; if the
    stream goes idle it is nudged once; when the result event arrives stdin is closed so the
    process can exit. A hard deadline kills anything still alive.

    Returns (elapsed_s, result_event|None, timed_out, questions).
    """
    cmd = [
        'claude', '-p',
        '--input-format', 'stream-json',
        '--output-format', 'stream-json', '--verbose',
        '--setting-sources', 'project,local',
        '--permission-mode', 'bypassPermissions',
        '--model', MODEL,
        '--session-id', str(uuid.uuid4()),
        '--max-budget-usd', BUDGET_PER_BATCH,
    ]
    t0 = time.time()
    proc = subprocess.Popen(cmd, cwd=arm_dir, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, text=True, bufsize=1)
    result, questions, timed_out, nudged = None, [], False, False
    deadline = t0 + BATCH_TIMEOUT_S
    try:
        _send(proc, prompt)
        with open(out_jsonl, 'w') as fh:
            while True:
                left = deadline - time.time()
                if left <= 0:
                    timed_out = True
                    break
                ready, _, _ = select.select([proc.stdout], [], [], min(IDLE_NUDGE_S, left))
                if not ready:
                    if not nudged:                      # idle: prod once, then give up
                        nudged = True
                        _send(proc, NEUTRAL_REPLY)
                        continue
                    timed_out = True
                    break
                line = proc.stdout.readline()
                if not line:
                    break
                fh.write(line)
                fh.flush()
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                m = d.get('message')
                if d.get('type') == 'assistant' and isinstance(m, dict):
                    for c in (m.get('content') or []):
                        if isinstance(c, dict) and c.get('type') == 'tool_use' \
                                and c.get('name') in ('AskUserQuestion', 'SendUserMessage'):
                            questions.append({'tool': c.get('name'),
                                              'input': json.dumps(c.get('input'))[:500]})
                            _send(proc, NEUTRAL_REPLY)
                if d.get('type') == 'result':
                    result = d
                    break
    finally:
        try:
            proc.stdin.close()
        except Exception:
            pass
        try:
            # Stop/SessionEnd hooks run after the result event. Interactive Claude Code waits
            # for them; a 20 s wait here killed v2's extraction three times when three arms
            # finished batches in the same minute (2026-09-12). Cost is unaffected: it comes
            # from the result event, which has already been read by this point.
            proc.wait(timeout=300)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=10)
    elapsed = time.time() - t0
    if timed_out:
        print(f'    ! batch hit the {BATCH_TIMEOUT_S}s deadline', file=sys.stderr)
    if questions:
        print(f'    ? agent asked {len(questions)} question(s); answered neutrally', file=sys.stderr)
    return elapsed, result, timed_out, questions


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--app', default='todo')
    ap.add_argument('--arm', required=True, choices=['treatment', 'control', 'treatment-v2'])
    ap.add_argument('--run', required=True, help='run id, e.g. pilot-01')
    ap.add_argument('--batches', default='1-10')
    ap.add_argument('--no-grade', action='store_true')
    ap.add_argument('--skill', default=None,
                    help='build directory for a treatment arm (default for treatment-v2: builds/product-traceability-v2.6)')
    a = ap.parse_args()
    skill = Path(a.skill).resolve() if a.skill else (SKILL_V2 if a.arm == 'treatment-v2' else None)
    if a.arm == 'treatment' and skill is None:
        sys.exit('the v1 "treatment" arm needs --skill <path to a v1 checkout>')

    lo, hi = (int(x) for x in (a.batches.split('-') if '-' in a.batches else (a.batches, a.batches)))
    spec = ROOT / 'specs' / a.app / 'batches'
    arm_dir = ROOT / 'arms' / a.run / a.arm
    out_dir = ROOT / 'runs' / a.run / a.arm
    out_dir.mkdir(parents=True, exist_ok=True)

    if lo == 1:
        setup_arm(arm_dir, a.arm, skill)

    manifest = []
    for n in range(lo, hi + 1):
        bfile = spec / f'{n:02d}.md'
        prompt = bfile.read_text()
        print(f'[{a.arm}] batch {n:02d} ...', flush=True)
        elapsed, result, timed_out, questions = run_batch(arm_dir, prompt, out_dir / f'batch-{n:02d}.jsonl')

        sh(['git', 'add', '-A'], cwd=arm_dir)
        sh(['git', 'commit', '-q', '-m', f'batch {n:02d}', '--allow-empty'], cwd=arm_dir)

        rec = {
            'batch': n, 'elapsed_s': round(elapsed, 1),
            'cost_usd': (result or {}).get('total_cost_usd'),
            'num_turns': (result or {}).get('num_turns'),
            'is_error': (result or {}).get('is_error'),
            'timed_out': timed_out,
            'questions_asked': len(questions),
            'questions': questions,
            'usage': (result or {}).get('usage'),
        }
        if not a.no_grade:
            gout = out_dir / f'grade-{n:02d}.json'
            try:
                g = subprocess.run(['node', str(ROOT / 'runner' / 'grade.mjs'), str(arm_dir), str(n), str(gout), a.app],
                                   capture_output=True, text=True, stdin=subprocess.DEVNULL,
                                   timeout=GRADE_TIMEOUT_S)
            except subprocess.TimeoutExpired:
                g = subprocess.CompletedProcess([], -1, '', f'GRADER TIMEOUT after {GRADE_TIMEOUT_S}s')
            print('   ', (g.stdout or g.stderr).strip().replace('\n', '\n    '))
            if gout.exists():
                gd = json.loads(gout.read_text())
                rec['passed'], rec['total'] = gd['passed'], gd['total']
        manifest.append(rec)
        print(f'    {elapsed:.0f}s  ${rec["cost_usd"] or 0:.2f}  turns={rec["num_turns"]}', flush=True)
        (out_dir / 'manifest.json').write_text(json.dumps(manifest, indent=1))

    print(f'\n[{a.arm}] done. outputs in {out_dir}')


if __name__ == '__main__':
    main()
