#!/usr/bin/env python3
"""Product Record - run the standing checks and record the result.

Convention: check/run.sh, if present, is the whole check. Otherwise every
*.mjs / *.js directly under check/ runs with node, each one a separate
result. The outcome goes to .claude/pr/check-status.json; nothing is printed,
because PostToolUse stdout never reaches the model anyway.

Runtime is capped at 100 s in total (no `timeout` binary on macOS). A run
that started less than 3 s ago is not repeated: a burst of edits in one
message would otherwise queue one run per edit.

`check.py --if-stale` is the Stop hook's synchronous variant: it waits for an
in-flight run, skips the debounce, and runs only when the recorded result is
older than this session's last journaled edit or bash_change. A dirty working
tree with nothing journaled (the async hook was killed) always re-runs. The
async runs are best effort; this one is what the red gate trusts.
"""

import json
import os
import subprocess
import sys
import time

sys.dont_write_bytecode = True  # keep __pycache__ out of bin/
import prlib

DEBOUNCE_S = 3.0
BUDGET_S = 100.0


def tail(text, n=8):
    lines = (text or "").strip().splitlines()
    return "\n".join(lines[-n:])


def run_one(cmd, cwd, budget):
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=budget,
                           env={**os.environ, "PR_HOOK_CHILD": "1"})
        return p.returncode, tail(p.stdout + "\n" + p.stderr)
    except subprocess.TimeoutExpired:
        return 124, f"timed out after {int(budget)} s"
    except Exception as exc:  # node missing, permission denied, ...
        return 127, str(exc)


def main():
    if_stale = "--if-stale" in sys.argv[1:]
    data = prlib.read_hook_input()
    project = prlib.project_dir(data)
    prlib.ensure_dirs(project)
    sdir, cdir = prlib.state_dir(project), prlib.check_dir(project)
    stamp = sdir / "check-started"
    sid = data.get("session_id", "")

    if if_stale:
        last_edit = max((r.get("ts", "") for r in prlib.read_jsonl(prlib.journal_path(project))
                         if r.get("t") in ("edit", "bash_change") and r.get("session_id") == sid),
                        default="")
        if not last_edit and not prlib.git_status(project):
            return 0  # nothing changed this session: nothing to re-check
        # Let an in-flight async run finish first; its result may already be current.
        with prlib.Lock(sdir / "check.lock", wait=BUDGET_S + 10):
            pass
        try:
            st = json.loads((sdir / "check-status.json").read_text())
            if last_edit and st.get("session_id") == sid and st.get("ts", "") >= last_edit:
                return 0
        except Exception:
            pass

    run_sh = cdir / "run.sh"
    scripts = sorted(p for p in cdir.iterdir() if p.suffix in (".mjs", ".js") and p.is_file())
    if run_sh.is_file():
        jobs = [("check/run.sh", ["bash", str(run_sh)])]
    else:
        jobs = [(prlib.relpath(project, p), ["node", str(p)]) for p in scripts]

    status = {"status": "none", "summary": "no standing checks in check/", "failing": [],
              "ts": prlib.now_iso(), "session_id": sid}
    if not jobs:
        prlib.atomic_write(sdir / "check-status.json", json.dumps(status, indent=1) + "\n")
        return 0

    if not if_stale:
        try:
            if time.time() - stamp.stat().st_mtime < DEBOUNCE_S:
                return 0
        except FileNotFoundError:
            pass
    stamp.touch()

    # One run at a time; an async run that finds the lock held just leaves.
    lock = prlib.Lock(sdir / "check.lock", wait=(BUDGET_S + 10 if if_stale else 0),
                      stale=BUDGET_S + 30)
    with lock:
        if not lock.held:
            return 0
        started = time.time()
        failing = []
        ran = 0
        for name, cmd in jobs:
            left = BUDGET_S - (time.time() - started)
            if left <= 0:
                failing.append({"file": name, "output": "skipped: check budget exhausted"})
                continue
            code, out = run_one(cmd, project, left)
            ran += 1
            if code != 0:
                failing.append({"file": name, "exit": code, "output": out})
        status["status"] = "red" if failing else "green"
        status["summary"] = (f"{len(failing)} of {len(jobs)} check file(s) failing"
                             if failing else f"{ran} check file(s) passed")
        status["failing"] = failing
        status["ts"] = prlib.now_iso()
        prlib.atomic_write(sdir / "check-status.json", json.dumps(status, indent=1) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
