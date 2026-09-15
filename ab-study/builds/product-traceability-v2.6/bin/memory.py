#!/usr/bin/env python3
"""Product Record - project the record into the NATIVE auto-memory.

MEMORY.md is injected into every session inside the cached prefix, so a
30-line block there is the cheapest possible way to hand the model what it
needs: the file list, check status, a source map, requirement statuses,
recent changes and decisions with their rule inline. The model never opens
a record file, and nothing here names where the record lives.

  memory.py has-block   exit 0 if MEMORY.md already carries the block
  memory.py write       rewrite the block (between the markers, everything
                        else preserved) and one topic file per decision
"""

import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # keep __pycache__ out of bin/
import prlib

MAX_LINES = 30
MAX_FILES = 12
MAX_CHANGES = 3
MAX_DECISIONS = 16          # rules in force; with <=2 per session this holds a normal project
MAX_CHOICES = 2             # one-off choices, newest only
MAX_DECISION_CHARS = 110
MAX_REQ_SHOWN = 15
MAX_REQ_TITLED = 3


def slug(text, limit=40):
    s = re.sub(r"[^a-z0-9]+", "-", str(text or "").lower()).strip("-")
    return s[:limit].rstrip("-") or "decision"


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return {}


def block_lines(project):
    sdir, bin_dir = prlib.state_dir(project), Path(__file__).resolve().parent
    proj = read_json(sdir / "projection.json")
    check = read_json(sdir / "check-status.json")
    journal = prlib.read_jsonl(prlib.journal_path(project))
    rows = prlib.read_jsonl(prlib.decisions_jsonl_path(project))
    superseded = {r.get("old") for r in rows if r.get("kind") == "supersede"}
    decisions = [d for d in rows
                 if d.get("kind", "decision") == "decision" and d.get("id") not in superseded]
    cdir = prlib.check_dir(project)
    n_checks = len([p for p in cdir.iterdir() if p.is_file()]) if cdir.is_dir() else 0

    lines = ["# Product record (maintained by hooks)"]
    main = [s["file"] for s in proj.get("source_map") or []]
    files = main + [f for f in prlib.work_files(project) if f not in main]
    more = f" (+{len(files) - MAX_FILES} more)" if len(files) > MAX_FILES else ""
    lines.append(f"- Files: {', '.join(files[:MAX_FILES]) or 'none'}{more}. This list is current; "
                 "do not list the directory. Read a file once with the Read tool when you need it.")
    lines.append(f"- Standing checks: check/ ({n_checks} files; last run {check.get('status', 'none')} "
                 f"{check.get('ts', '-')}). Optional, small, pure-function only. They run "
                 "automatically after every edit and a red result is reported to you before you "
                 "finish - do not run them yourself.")
    for s in proj.get("source_map") or []:
        funcs = ", ".join(s.get("functions") or []) or "none"
        tids = ", ".join(s.get("testids") or []) or "none"
        lines.append(prlib.truncate(f"- Source map: {s['file']} ({s['lines']} lines) - functions: "
                                    f"{funcs} ; testids: {tids}", 600))
    reqs = proj.get("requirements") or []
    shown = reqs[-MAX_REQ_SHOWN:]
    prefix = f"({len(reqs) - len(shown)} earlier omitted) " if len(reqs) > len(shown) else ""
    titled = {r["id"] for r in reqs[-MAX_REQ_TITLED:]}  # what was built lately, by name
    lines.append("- Requirements: " + prefix
                 + (" | ".join(f"{r['id']} {r['status']}"
                               + (f" ({prlib.truncate(r['title'], 40)})"
                                  if r["id"] in titled and r.get("title") else "")
                               for r in shown) or "none yet")
                 + " ; unverified: " + (", ".join(proj.get("unverified") or []) or "none"))

    lines.append("- Recent changes (newest first):")
    turns = [r for r in journal if r.get("t") == "turn_end"][-MAX_CHANGES:]
    for r in reversed(turns):
        msg = " ".join((r.get("message") or "").split())
        lines.append(f"  - {str(r.get('ts', ''))[:10]} {r.get('req') or '-'}: {prlib.truncate(msg, 140)}")
    if not turns:
        lines.append("  - none yet")

    # Rules never scroll out: attempt 2 buried the batch-3 date rule under thirty later
    # implementation choices and the model re-derived it at 24 tool calls. Rules are shown
    # oldest first, all of them (capped), each inline so the model can act without a Read;
    # one-off choices get only a short recent window. The topic file holds the why.
    def dline(d):
        rej = "; ".join(f"{x.get('option')} - {x.get('drawback')}" for x in d.get("rejected") or [])
        body = prlib.truncate(f"{d['id']} {d.get('title')}: {d.get('chose')} "
                              f"(rejected: {rej or 'none stated'})", MAX_DECISION_CHARS)
        return f"  - {body} [why]({topic_name(d)})"

    # Rules the USER laid down are pinned: they are few, they are the ones later sessions
    # are tested against, and being the earliest they were the first to scroll out under a
    # plain "last N" cap (attempt 13 captured the batch-2 rule and then lost it from the
    # block by batch 10). Assistant-derived rules fill the remaining slots, newest first.
    rules_ = [d for d in decisions if d.get("dkind") == "rule"]
    choices = [d for d in decisions if d.get("dkind") != "rule"]
    user_rules = [d for d in rules_ if d.get("source") == "user"]
    other_rules = [d for d in rules_ if d.get("source") != "user"]
    room = max(0, MAX_DECISIONS - len(user_rules))
    shown_rules = user_rules + list(reversed(other_rules[-room:]))
    lines.append("- Rules in force (every change must honour these):")
    for d in shown_rules:
        lines.append(dline(d))
    if not rules_:
        lines.append("  - none yet")
    lines.append("- Recent choices (newest first):")
    for d in reversed(choices[-MAX_CHOICES:]):
        lines.append(dline(d))
    if not choices:
        lines.append("  - none yet")

    rules = (bin_dir / "working-rules.md").read_text(encoding="utf-8").rstrip().splitlines()
    lines.extend(rules)

    # Hard cap: drop the oldest decisions, then changes, before the rules.
    while len(lines) > MAX_LINES:
        for marker in ("  - DEC-", "  - 20"):
            idx = [i for i, l in enumerate(lines) if l.startswith(marker)]
            if idx:
                del lines[idx[-1]]
                break
        else:
            break
    return lines


def topic_name(d):
    return f"dec-{d['id'].split('-')[-1]}-{slug(d.get('title'))}.md"


def write_topics(mem, decisions):
    for d in decisions:
        rej = "\n".join(f"  - {x.get('option')} - {x.get('drawback')}" for x in d.get("rejected") or []) \
              or "  - none stated"
        desc = prlib.truncate(f"Chose {d.get('chose')}. Why: {d.get('why')} ({d.get('req')})", 200)
        text = f"""---
name: {d['id']} {d.get('title')}
description: {desc}
metadata:
  type: project
---

# {d['id']} - {d.get('title')}

- Date: {d.get('date')}
- REQ: {d.get('req')}
- Chose: {d.get('chose')}
- Why: {d.get('why')}
- Rejected:
{rej}
- Evidence: "{d.get('evidence')}"
"""
        path = mem / topic_name(d)
        if not path.exists() or path.read_text(encoding="utf-8") != text:
            prlib.atomic_write(path, text)


def has_block(mem):
    try:
        return prlib.START_MARK in (mem / "MEMORY.md").read_text(encoding="utf-8")
    except FileNotFoundError:
        return False


def write(project):
    mem = prlib.memory_dir(project)
    mem.mkdir(parents=True, exist_ok=True)
    block = "\n".join([prlib.START_MARK, *block_lines(project), prlib.END_MARK]) + "\n"
    with prlib.Lock(mem / ".product-record.lock"):
        path = mem / "MEMORY.md"
        try:
            text = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            text = ""
        if prlib.START_MARK in text and prlib.END_MARK in text:
            head, rest = text.split(prlib.START_MARK, 1)
            _old, tail = rest.split(prlib.END_MARK, 1)
            text = head + block + tail.lstrip("\n")
        else:
            text = (text.rstrip("\n") + "\n\n" if text.strip() else "") + block
        prlib.atomic_write(path, text)
        write_topics(mem, [d for d in prlib.read_jsonl(prlib.decisions_jsonl_path(project))
                           if d.get("kind", "decision") == "decision"])


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "write"
    project = prlib.project_dir()
    prlib.ensure_dirs(project)
    if cmd == "has-block":
        return 0 if has_block(prlib.memory_dir(project)) else 1
    write(project)
    return 0


if __name__ == "__main__":
    sys.exit(main())
