#!/usr/bin/env python3
"""Product Traceability - shared helpers for the hook scripts.

Everything the hooks need to agree on lives here: where the working state
sits (.claude/pr/), where the record sits (docs/product-traceability/), where the
native auto-memory directory is, and how to append to / lock / atomically
replace files. Nothing in this module talks to a model.
"""

import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

RECORD_SUBDIR = "docs/product-traceability"
STATE_SUBDIR = ".claude/pr"
CHECK_SUBDIR = "check"
START_MARK = "<!-- product-traceability:start -->"
END_MARK = "<!-- product-traceability:end -->"

REQ_RE = re.compile(r"\[(REQ-\d{3,})\]")
VERIFIES_RE = re.compile(r"@verifies\s+(REQ-\d{3,})")


# --- time ------------------------------------------------------------------

def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# --- paths -----------------------------------------------------------------

def project_dir(hook_input=None):
    """The project root: the hook's cwd, else CLAUDE_PROJECT_DIR, else $PWD."""
    cand = (hook_input or {}).get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    # Claude Code's shell keeps its cwd across Bash calls, so after the model runs `cd check`
    # the hook's cwd is a subdirectory. Resolve to the git toplevel so the record never nests.
    try:
        top = subprocess.run(["git", "-C", cand, "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, timeout=5)
        if top.returncode == 0 and top.stdout.strip():
            cand = top.stdout.strip()
    except Exception:
        pass
    return Path(cand).resolve()


def record_dir(project):
    return project / RECORD_SUBDIR


def state_dir(project):
    return project / STATE_SUBDIR


def check_dir(project):
    return project / CHECK_SUBDIR


def ensure_dirs(project):
    for d in (record_dir(project), state_dir(project), check_dir(project)):
        d.mkdir(parents=True, exist_ok=True)


def git_root(project):
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=project,
                             capture_output=True, text=True, timeout=5)
        if out.returncode == 0 and out.stdout.strip():
            return Path(out.stdout.strip())
    except Exception:
        pass
    return project


def config_dir():
    return Path(os.environ.get("CLAUDE_CONFIG_DIR") or (Path.home() / ".claude"))


def memory_dir(project):
    """The native auto-memory directory Claude Code injects at session start.

    Honour the autoMemoryDirectory setting when a settings file sets it;
    otherwise derive the platform slug: the git repo root with every
    non-alphanumeric character replaced by '-'.
    """
    for settings in (config_dir() / "settings.json",
                     project / ".claude" / "settings.json",
                     project / ".claude" / "settings.local.json"):
        try:
            custom = json.loads(settings.read_text()).get("autoMemoryDirectory")
        except Exception:
            custom = None
        if custom:
            p = Path(os.path.expanduser(str(custom)))
            return p if p.is_absolute() else (project / p)
    slug = re.sub(r"[^A-Za-z0-9]", "-", str(git_root(project)))
    return config_dir() / "projects" / slug / "memory"


def is_record_path(project, path):
    """True for files the hooks own: the record dir, our state dir, native memory."""
    try:
        p = Path(path)
        p = p if p.is_absolute() else (project / p)
        p = p.resolve()
    except Exception:
        return False
    for owned in (record_dir(project), state_dir(project), memory_dir(project)):
        try:
            p.relative_to(owned.resolve())
            return True
        except ValueError:
            continue
    return False


def relpath(project, path):
    try:
        return str(Path(path).resolve().relative_to(project))
    except Exception:
        return str(path)


# --- hook input --------------------------------------------------------------

def read_hook_input():
    """Read the hook's stdin JSON once. Malformed input is an empty dict."""
    try:
        raw = sys.stdin.read()
        return json.loads(raw) if raw.strip() else {}
    except Exception:
        return {}


# --- files -------------------------------------------------------------------

def read_jsonl(path):
    rows = []
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        pass
    return rows


def append_jsonl(path, row):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def atomic_write(path, text):
    """Write via temp + rename so a reader never sees a half-written file."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


class Lock:
    """mkdir-based lock: atomic on every filesystem, no util-linux flock needed.

    A stale lock (older than `stale` seconds) is broken, so a killed async
    hook cannot wedge the pipeline.
    """

    def __init__(self, path, wait=10.0, stale=300.0):
        self.path = Path(path)
        self.wait = wait
        self.stale = stale
        self.held = False

    def __enter__(self):
        deadline = time.time() + self.wait
        while True:
            try:
                self.path.mkdir(parents=True)
                self.held = True
                return self
            except FileExistsError:
                try:
                    if time.time() - self.path.stat().st_mtime > self.stale:
                        self.path.rmdir()
                        continue
                except FileNotFoundError:
                    continue
                if time.time() > deadline:
                    return self
                time.sleep(0.1)

    def __exit__(self, *exc):
        if self.held:
            try:
                self.path.rmdir()
            except OSError:
                pass


# --- state -------------------------------------------------------------------

def load_state(project):
    try:
        return json.loads((state_dir(project) / "state.json").read_text())
    except Exception:
        return {}


def save_state(project, state):
    atomic_write(state_dir(project) / "state.json", json.dumps(state, indent=1) + "\n")


def journal_path(project):
    return state_dir(project) / "journal.jsonl"


def requirements_path(project):
    return record_dir(project) / "requirements.jsonl"


def decisions_jsonl_path(project):
    return record_dir(project) / "decisions.jsonl"


def latest_by_id(rows):
    """requirements.jsonl is upsert-by-append: the last line per id wins."""
    out = {}
    for r in rows:
        rid = r.get("id")
        if rid:
            out[rid] = r
    return out


def next_id(prefix, existing_ids):
    n = 0
    for i in existing_ids:
        m = re.fullmatch(prefix + r"-(\d+)", str(i))
        if m:
            n = max(n, int(m.group(1)))
    return f"{prefix}-{n + 1:03d}"


def truncate(text, limit):
    text = text or ""
    return text if len(text) <= limit else text[:limit] + "..."


def git(project, *args, timeout=20):
    try:
        out = subprocess.run(["git", *args], cwd=project, capture_output=True,
                             text=True, timeout=timeout)
        return out.stdout if out.returncode == 0 else ""
    except Exception:
        return ""


def _work_exclude():
    # .claude/ holds hooks, bin and state: harness, not product.
    return [":(exclude)" + RECORD_SUBDIR, ":(exclude).claude"]


def untracked_files(project):
    """New files not yet committed: git diff HEAD does not show them."""
    out = git(project, "ls-files", "--others", "--exclude-standard", "--", ".", *_work_exclude())
    return [f for f in out.splitlines() if f.strip()]


def work_files(project):
    """Tracked plus untracked-but-not-ignored files, harness excluded."""
    out = git(project, "ls-files", "--cached", "--others", "--exclude-standard", "--", ".", *_work_exclude())
    if out:
        return sorted({f for f in out.splitlines() if f.strip()})
    skip = {".git", ".claude", "node_modules"}
    return sorted(str(p.relative_to(project)) for p in project.rglob("*")
                  if p.is_file() and not set(p.relative_to(project).parts) & skip
                  and not is_record_path(project, p))


def git_status(project):
    """{path: XY} from git status --porcelain, harness excluded. Empty when clean."""
    out = git(project, "status", "--porcelain", "--untracked-files=all", "--", ".", *_work_exclude())
    return {line[3:].strip(): line[:2] for line in out.splitlines() if len(line) > 3}


def diffstat(project):
    """git diff --stat HEAD plus the names of new files, one string."""
    stat = git(project, "diff", "--stat", "HEAD", "--", ".", *_work_exclude()).strip()
    new = untracked_files(project)
    return stat + ("\nnew: " + ", ".join(new) if new else "")


def diff_text(project, limit, per_file=3000):
    """git diff HEAD with new files appended as full content, capped at limit."""
    text = git(project, "diff", "HEAD", "--", ".", *_work_exclude())
    for f in untracked_files(project):
        if len(text) >= limit:
            break
        try:
            body = (project / f).read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        text += f"\n--- new file: {f} ---\n{truncate(body, per_file)}\n"
    return truncate(text, limit)
