#!/usr/bin/env python3
"""Product Traceability - compile the record from source and journal. Zero model tokens.

Reads: tracked source files (markers, functions, test ids), the journal,
requirements.jsonl, decisions.jsonl.
Writes: docs/product-traceability/traceability-matrix.md, change.log,
requirements.md, and .claude/pr/projection.json (what memory.py needs, so
it never rescans the tree).
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.dont_write_bytecode = True  # keep __pycache__ out of bin/
import prlib

SOURCE_EXT = {".html", ".htm", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".vue",
              ".svelte", ".py", ".go", ".rs", ".rb", ".sh", ".css", ".java", ".kt",
              ".swift", ".c", ".h", ".cpp", ".cs", ".php", ".sql", ".yaml", ".yml",
              ".toml", ".json", ".md"}
CODE_EXT = SOURCE_EXT - {".css", ".yaml", ".yml", ".toml", ".json", ".md"}
SKIP_PARTS = {"node_modules", ".git", ".claude", "dist", "build", "vendor", "docs"}
MAX_SCAN_BYTES = 2_000_000

FUNC_RES = [
    re.compile(r"^[ \t]{0,4}(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)"),
    re.compile(r"^[ \t]{0,4}(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*"
               r"(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>"),
    re.compile(r"^[ \t]{0,4}(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*"
               r"(?:async\s+)?function\b"),
    re.compile(r"^[ \t]{0,4}(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)"),
    re.compile(r"^(?:async\s+)?def\s+(\w+)"),             # python
    re.compile(r"^func\s+(?:\([^)]*\)\s*)?(\w+)"),          # go
    re.compile(r"^[ \t]*(?:pub(?:\([^)]*\))?\s+)?fn\s+(\w+)"),  # rust
    re.compile(r"^(\w+)\s*\(\)\s*\{"),                      # shell
]
COMMENT_ONLY_RE = re.compile(r"^\s*(?://|#|/\*|\*|<!--|--)")
TESTID_RE = re.compile(r"""data-testid\s*=\s*["']([^"']+)["']""")


def tracked_files(project):
    """Tracked plus untracked-but-not-ignored: a fresh file is real work too."""
    out = prlib.git(project, "ls-files", "--cached", "--others", "--exclude-standard")
    names = out.splitlines() if out else [str(p.relative_to(project)) for p in project.rglob("*")]
    files = []
    for name in sorted(set(names)):
        p = Path(name)
        if p.suffix.lower() not in SOURCE_EXT or set(p.parts) & SKIP_PARTS:
            continue
        full = project / p
        if not full.is_file() or full.stat().st_size > MAX_SCAN_BYTES:
            continue
        if prlib.is_record_path(project, full):
            continue
        files.append(str(p))
    return files


def scan_file(project, rel):
    try:
        text = (project / rel).read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None
    lines = text.splitlines()
    funcs, impl, verifies = [], [], []
    for n, line in enumerate(lines, 1):
        if is_function_start(line):
            funcs.append((function_name(line), n))
        anchor = marker_anchor(lines, n)
        for rid in prlib.REQ_RE.findall(line):
            impl.append((rid, anchor))
        for rid in prlib.VERIFIES_RE.findall(line):
            verifies.append((rid, anchor))
    testids = list(dict.fromkeys(TESTID_RE.findall(text)))
    return {"file": rel, "lines": len(lines), "functions": funcs,
            "impl": impl, "verifies": verifies, "testids": testids}


def function_name(line):
    for rx in FUNC_RES:
        m = rx.match(line)
        if m:
            return m.group(1)
    return None


def is_function_start(line):
    return function_name(line) is not None


def marker_anchor(lines, n):
    """The line a marker on line n belongs to.

    The common placement is a comment on the line ABOVE the function. Read
    literally that line sits inside the previous function, so a comment-only
    marker is attributed to the function that starts on the next non-blank
    line. Any other placement (signature line, first line inside) already
    resolves to the right function through enclosing().
    """
    if not COMMENT_ONLY_RE.match(lines[n - 1]):
        return n
    for m in range(n, len(lines)):
        nxt = lines[m]
        if not nxt.strip():
            continue
        return m + 1 if is_function_start(nxt) else n
    return n


def enclosing(funcs, line):
    best = None
    for name, start in funcs:
        if start <= line and (best is None or start > best[1]):
            best = (name, start)
    return best[0] if best else None


def md_cell(text, limit=200):
    return prlib.truncate(" ".join(str(text or "").split()), limit).replace("|", "\\|")


def main():
    project = prlib.project_dir()
    prlib.ensure_dirs(project)
    rdir, sdir = prlib.record_dir(project), prlib.state_dir(project)
    journal = prlib.read_jsonl(prlib.journal_path(project))
    reqs = prlib.latest_by_id(prlib.read_jsonl(prlib.requirements_path(project)))
    decisions = [d for d in prlib.read_jsonl(prlib.decisions_jsonl_path(project))
                 if d.get("kind", "decision") == "decision"]

    scans = [s for s in (scan_file(project, f) for f in tracked_files(project)) if s]

    # Main source files: what carries markers or was edited, biggest first.
    edits = Counter(r.get("file") for r in journal if r.get("t") == "edit")
    for r in journal:
        if r.get("t") == "bash_change":
            edits.update(r.get("files") or [])
    check_prefix = prlib.CHECK_SUBDIR + "/"
    code = [s for s in scans if Path(s["file"]).suffix.lower() in CODE_EXT
            and not s["file"].startswith(check_prefix)]
    code.sort(key=lambda s: (-(len(s["impl"]) > 0), -edits.get(s["file"], 0), -s["lines"]))
    main_files = code[:5]

    impl_by_req, ver_by_req, orphans = {}, {}, []
    for s in scans:
        for rid, n in s["impl"]:
            fn = enclosing(s["functions"], n)
            impl_by_req.setdefault(rid, set()).add(f"{s['file']}:{fn}" if fn else s["file"])
        for rid, n in s["verifies"]:
            fn = enclosing(s["functions"], n)
            ver_by_req.setdefault(rid, set()).add(f"{s['file']}:{fn}" if fn else f"{s['file']}:L{n}")
    for rid in set(impl_by_req) | set(ver_by_req):
        if rid not in reqs:
            orphans.append(rid)
    dec_by_req = {}
    for d in decisions:
        dec_by_req.setdefault(d.get("req", ""), []).append(d["id"])

    ids = sorted(reqs)
    satisfied = [r for r in ids if impl_by_req.get(r)]
    unsatisfied = [r for r in ids if r not in impl_by_req
                   and reqs[r].get("status") not in ("not_applicable", "superseded")]
    verified = [r for r in ids if ver_by_req.get(r)]
    unverified = [r for r in satisfied if r not in ver_by_req]

    ts = prlib.now_iso()
    head = f"_Generated by product-traceability hooks at {ts}. Do not edit by hand._\n\n"

    # --- traceability-matrix.md ---
    out = ["# Traceability matrix\n", head,
           f"Requirements: {len(ids)} - satisfied {len(satisfied)}, unsatisfied {len(unsatisfied)}, "
           f"verified {len(verified)}, unverified {len(unverified)}, orphan markers {len(orphans)}.\n\n",
           "| REQ | Status | Title | Implementation (file:function) | Verified by | Decisions |\n",
           "|---|---|---|---|---|---|\n"]
    for r in ids:
        out.append(f"| {r} | {reqs[r].get('status', '')} | {md_cell(reqs[r].get('title'), 60)} | "
                   f"{md_cell(', '.join(sorted(impl_by_req.get(r, []))), 300) or '-'} | "
                   f"{md_cell(', '.join(sorted(ver_by_req.get(r, []))), 300) or '-'} | "
                   f"{', '.join(dec_by_req.get(r, [])) or '-'} |\n")
    out.append("\n## Sets\n\n")
    for label, items in (("Satisfied", satisfied), ("Unsatisfied", unsatisfied),
                         ("Verified", verified), ("Unverified", unverified)):
        out.append(f"- {label}: {', '.join(items) or 'none'}\n")
    out.append("- Orphan markers (ids with no requirement): "
               + (", ".join(f"{r} ({', '.join(sorted(impl_by_req.get(r, set()) | ver_by_req.get(r, set())))})"
                            for r in sorted(orphans)) or "none") + "\n")
    out.append("\n## Source map\n\n")
    for s in main_files:
        out.append(f"### {s['file']} ({s['lines']} lines)\n\n")
        out.append("- functions: " + (", ".join(f"{n}@L{l}" for n, l in s["functions"]) or "none") + "\n")
        out.append("- testids: " + (", ".join(s["testids"]) or "none") + "\n\n")
    prlib.atomic_write(rdir / "traceability-matrix.md", "".join(out))

    # --- change.log ---
    log = ["# Change log\n", "_Regenerated from the journal by product-traceability hooks. Newest first._\n\n"]
    for r in reversed([r for r in journal if r.get("t") == "turn_end"]):
        lines = (r.get("diffstat") or "").strip().splitlines()
        new_files = [l[len("new: "):] for l in lines if l.startswith("new: ")]
        stat = [l for l in lines if not l.startswith("new: ")]
        summary = stat[-1].strip() if stat else "no diff"
        files = [l.split("|")[0].strip() for l in stat[:-1] if "|" in l]
        files += [f"{f} (new)" for f in ", ".join(new_files).split(", ") if f]
        msg = " ".join((r.get("message") or "").split())
        log.append(f"{r.get('ts', '')}  {str(r.get('session_id', ''))[:8]}  {r.get('req') or '-'}  | "
                   f"{prlib.truncate(msg, 160)} | {summary}"
                   + (f" [{', '.join(files)}]" if files else "") + "\n")
    prlib.atomic_write(rdir / "change.log", "".join(log))

    # --- requirements.md ---
    req_md = ["# Requirements\n", head,
              "| ID | Status | Title | Statement | Acceptance | Sub-requirements | Decisions |\n",
              "|---|---|---|---|---|---|---|\n"]
    for r in ids:
        q = reqs[r]
        req_md.append(f"| {r} | {q.get('status', '')} | {md_cell(q.get('title'), 80)} | "
                      f"{md_cell(q.get('statement'), 240)} | "
                      f"{md_cell('; '.join(q.get('acceptance') or []), 240) or '-'} | "
                      f"{md_cell('; '.join(q.get('sub_requirements') or []), 240) or '-'} | "
                      f"{', '.join(dec_by_req.get(r, [])) or '-'} |\n")
    prlib.atomic_write(rdir / "requirements.md", "".join(req_md))

    # --- projection for memory.py ---
    prlib.atomic_write(sdir / "projection.json", json.dumps({
        "ts": ts,
        "source_map": [{"file": s["file"], "lines": s["lines"],
                        "functions": [f"{n}@L{l}" for n, l in s["functions"]],
                        "testids": s["testids"]} for s in main_files[:3]],
        "requirements": [{"id": r, "status": reqs[r].get("status", ""),
                          "title": reqs[r].get("title", "")} for r in ids],
        "unverified": unverified, "unsatisfied": unsatisfied,
    }, indent=1) + "\n")

    state = prlib.load_state(project)
    state["projected_lines"] = len(journal)
    prlib.save_state(project, state)
    return 0


if __name__ == "__main__":
    sys.exit(main())
