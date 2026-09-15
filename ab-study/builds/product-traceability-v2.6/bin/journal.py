#!/usr/bin/env python3
"""Product Record - the journal writer.

Every hook that observes something appends one line to .claude/pr/journal.jsonl.
The journal is the only input the projections (compile.py, memory.py) and the
extraction (extract.sh) read, so a hook never needs to know what the others do.

Subcommands (hook JSON on stdin):
  prompt     assign the next REQ id, journal the prompt, seed the requirement,
             print the one line the model sees
  edit         journal one Edit/Write call (silent)
  bash_change  journal files a Bash call changed, found by diffing a tree
               snapshot (git status + mtimes) against the last one; exit 0
               when something changed, 1 when nothing did
  turn_end     journal the end of a turn with the assistant's message and diffstat
  has-edits    exit 0 if this session journaled an edit or bash_change, or the
               working tree is dirty (an async hook may have been killed), else 1
"""

import json
import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of bin/
import prlib


def cmd_prompt(project, data):
    prompt = data.get("prompt") or ""
    if not prompt.strip():
        return  # nothing to require, nothing to say
    state = prlib.load_state(project)
    reqs = prlib.latest_by_id(prlib.read_jsonl(prlib.requirements_path(project)))
    req = prlib.next_id("REQ", reqs.keys())
    ts = prlib.now_iso()
    prlib.append_jsonl(prlib.journal_path(project), {
        "t": "prompt", "ts": ts, "session_id": data.get("session_id", ""),
        "req": req, "prompt": prlib.truncate(prompt, 4000),
    })
    # Seed the requirement from the prompt so the record has every REQ even
    # when the Haiku extraction never runs (no edits) or fails.
    first_line = prompt.strip().splitlines()[0]
    prlib.append_jsonl(prlib.requirements_path(project), {
        "id": req, "title": prlib.truncate(first_line, 80),
        "statement": prlib.truncate(prompt.strip(), 600), "status": "open",
        "acceptance": [], "sub_requirements": [], "ts": ts,
        "session_id": data.get("session_id", ""),
    })
    state["current_req"] = req
    state["current_session"] = data.get("session_id", "")
    prlib.save_state(project, state)
    print(f"Requirement ID for this prompt: {req}.")


def cmd_edit(project, data):
    tool = data.get("tool_name", "")
    inp = data.get("tool_input") or {}
    path = inp.get("file_path") or ""
    if not path or prlib.is_record_path(project, path):
        return
    if tool == "Edit":
        old, new = inp.get("old_string") or "", inp.get("new_string") or ""
        added, removed = len(new.splitlines()), len(old.splitlines())
    else:
        new = inp.get("content") or ""
        added, removed = len(new.splitlines()), None  # Write replaces the file
    markers = sorted(set(prlib.REQ_RE.findall(new)) | set(prlib.VERIFIES_RE.findall(new)))
    state = prlib.load_state(project)
    prlib.append_jsonl(prlib.journal_path(project), {
        "t": "edit", "ts": prlib.now_iso(), "session_id": data.get("session_id", ""),
        "req": state.get("current_req", ""), "file": prlib.relpath(project, path),
        "tool": tool, "added": added, "removed": removed, "markers": markers,
        "tool_use_id": data.get("tool_use_id", ""),
    })
    save_snapshot(project, tree_snapshot(project))  # a later Bash must not re-report this


def tree_snapshot(project):
    """[mtime_ns, size, git XY] per work file: the tree as the hooks last saw it."""
    status = prlib.git_status(project)
    snap = {}
    for f in prlib.work_files(project):
        try:
            st = (project / f).stat()
            snap[f] = [st.st_mtime_ns, st.st_size, status.get(f, "")]
        except OSError:
            snap[f] = [None, 0, status.get(f, "")]  # tracked but deleted
    return snap


def snapshot_path(project):
    return prlib.state_dir(project) / "tree-snapshot.json"


def save_snapshot(project, snap):
    prlib.atomic_write(snapshot_path(project), json.dumps({"ts": prlib.now_iso(), "files": snap}) + "\n")


def cmd_bash_change(project, data):
    try:
        before = json.loads(snapshot_path(project).read_text()).get("files")
    except Exception:
        before = None
    after = tree_snapshot(project)
    if before is None:
        changed = [f for f, v in after.items() if v[2]]  # first look: git's dirty set
    else:
        # Compare content (mtime, size) only. Git's XY flips on every harness commit without
        # the file changing, and would otherwise journal a phantom edit for every committed file.
        changed = [f for f, v in after.items() if before.get(f, [None, None])[:2] != v[:2]]
        changed += [f for f in before if f not in after]  # deleted
    save_snapshot(project, after)
    if not changed:
        return 1
    state = prlib.load_state(project)
    prlib.append_jsonl(prlib.journal_path(project), {
        "t": "bash_change", "ts": prlib.now_iso(), "session_id": data.get("session_id", ""),
        "req": state.get("current_req", ""), "files": changed,
        "tool_use_id": data.get("tool_use_id", ""),
    })


def cmd_turn_end(project, data):
    state = prlib.load_state(project)
    prlib.append_jsonl(prlib.journal_path(project), {
        "t": "turn_end", "ts": prlib.now_iso(), "session_id": data.get("session_id", ""),
        "req": state.get("current_req", ""),
        "message": prlib.truncate((data.get("last_assistant_message") or "").strip(), 400),
        "diffstat": prlib.diffstat(project),
    })


def cmd_has_edits(project, data):
    sid = data.get("session_id", "")
    for row in prlib.read_jsonl(prlib.journal_path(project)):
        if row.get("t") in ("edit", "bash_change") and row.get("session_id") == sid:
            return 0
    return 0 if prlib.git_status(project) else 1


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    data = prlib.read_hook_input()
    project = prlib.project_dir(data)
    prlib.ensure_dirs(project)
    handlers = {"prompt": cmd_prompt, "edit": cmd_edit, "bash_change": cmd_bash_change,
                "turn_end": cmd_turn_end, "has-edits": cmd_has_edits}
    if cmd not in handlers:
        return 0
    with prlib.Lock(prlib.state_dir(project) / "journal.lock"):
        return handlers[cmd](project, data) or 0


if __name__ == "__main__":
    sys.exit(main())
