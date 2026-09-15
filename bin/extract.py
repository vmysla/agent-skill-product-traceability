#!/usr/bin/env python3
"""Product Traceability - build the extraction prompt and ingest the Haiku answer.

  extract.py build  <stop-input.json>   -> prompt text on stdout
  extract.py ingest <stop-input.json>   <- `claude -p --output-format json` on stdin

The evidence guard lives in `ingest`: a decision or non-decision is kept only
when its evidence string is a verbatim (whitespace-normalised) substring of
the assistant message or the diff. A model cannot be trusted to invent
rationale; it can be trusted to quote.
"""

import hashlib
import json
import re
import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of bin/
import prlib

MAX_DECISIONS_PER_TURN = 2   # rules first; a later session needs few, not many

MODEL_KEY = "model"


def norm(s):
    return " ".join(str(s or "").split())


def squash(s):
    """Letters and digits only, lowercased. The evidence guard compares on this so a genuine
    quote that spans bullet markers, backticks or line breaks still matches; the word sequence
    must still be exact, so it is no looser on substance."""
    return "".join(ch for ch in str(s or "").lower() if ch.isalnum())


def load(path):
    try:
        return json.loads(open(path, encoding="utf-8").read())
    except Exception:
        return {}


def fingerprint(message, diff):
    return hashlib.sha1((norm(message) + "\n" + diff).encode("utf-8")).hexdigest()[:16]


def already_extracted(project, sid, fp):
    """True when the last extraction for this session saw this exact turn.

    A red-gate retry that changed nothing would otherwise re-record the same
    decisions under new ids."""
    for row in reversed(prlib.read_jsonl(prlib.journal_path(project))):
        if row.get("t") == "extract" and row.get("session_id") == sid:
            return row.get("fp") == fp
    return False


def this_turn(project, data):
    """The prompt row and diff that belong to the turn being extracted."""
    sid = data.get("session_id", "")
    state = prlib.load_state(project)
    req = state.get("current_req", "")
    prompt = ""
    for row in reversed(prlib.read_jsonl(prlib.journal_path(project))):
        if row.get("t") == "prompt" and row.get("session_id") == sid:
            prompt, req = row.get("prompt", ""), row.get("req", req)
            break
    # A resumed stop-input carries the diff it was captured with; the live tree has moved on.
    diff = data["diff"] if isinstance(data.get("diff"), str) else prlib.diff_text(project, 12000)
    message = data.get("last_assistant_message") or ""
    return req, prompt, message, diff


def cmd_snapshot(project, data, path):
    """Write the hook input plus this turn's diff to `path` for later (or resumed) extraction."""
    data = dict(data)
    data["diff"] = prlib.diff_text(project, 12000)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh)
    return 0


def cmd_build(project, data):
    req, prompt, message, diff = this_turn(project, data)
    if already_extracted(project, data.get("session_id", ""), fingerprint(message, diff)):
        return 0  # empty prompt: extract.sh stops here
    reqs = prlib.latest_by_id(prlib.read_jsonl(prlib.requirements_path(project)))
    req_lines = "\n".join(f"{r}: [{q.get('status')}] {prlib.truncate(q.get('title', ''), 80)}"
                          for r, q in sorted(reqs.items()))
    decs = [d for d in prlib.read_jsonl(prlib.decisions_jsonl_path(project))
            if d.get("kind", "decision") == "decision"]
    dec_lines = "\n".join(f"{d['id']}: {prlib.truncate(d.get('title', ''), 80)}" for d in decs)
    sys.stdout.write(f"""You maintain the product record of a codebase. From the material below, extract what this turn established. Answer only through the structured output; you have everything you need here, do not read files.

Rules:
- requirement: the requirement this turn worked on (normally {req}). status: done | partial | blocked | not_applicable. acceptance: checkable behaviours it delivered. sub_requirements: distinct sub-goals if the prompt asked for several.
- decisions: AT MOST TWO, and usually zero or one. Record a decision only if a later session working on a different feature would need it: kind "rule" for a convention, format, invariant or comparison that every later change must honour (a date format, an ordering rule, a storage shape, "never do X"); kind "choice" only for a rejected alternative that a later session would plausibly re-propose. Each needs the rejected alternative(s) and their drawback. Routine implementation choices (which event to listen on, where a helper lives, naming, a local refactor) are NOT decisions and must be left out. Prefer a rule over a choice when both exist.
- THE MOST IMPORTANT RULES COME FROM THE USER. If the prompt itself lays down how something must always work ("from now on", "for the rest of the project", "always", "never", "this is the rule", a stated format or comparison), record it as kind "rule" with source "user", quoting the prompt as evidence, even if the assistant made no choice. A later session cannot see this prompt; the record is the only place it survives. If the prompt states such a rule, it MUST be the first decision recorded; an implementation detail never takes its place.
- non_decisions: options the assistant explicitly considered and did not do, and why.
- evidence: copy a VERBATIM passage (10-200 characters, exact characters) from the PROMPT, the ASSISTANT MESSAGE or the DIFF that states the rule or choice. Entries whose evidence is not a verbatim quote are discarded.
- supersedes: ids of earlier requirements this one replaces, only if the prompt says so.
- Do not repeat a decision already listed under "Existing decisions". If a new rule refines or replaces an existing one on the same subject (a new ordering rule that narrows an earlier ordering rule, a format that replaces an earlier format), state the new rule in its FULL current form, merging what still holds from the old one, and list the old id in supersedes_decisions.
- nothing_to_record: true only if no requirement work happened (for example a question was answered).

## Prompt ({req})
{prlib.truncate(prompt, 2000)}

## Assistant message
{prlib.truncate(message, 4000)}

## Diff (git diff HEAD)
{diff or '(no diff)'}

## Requirements so far
{prlib.truncate(req_lines, 4000) or '(none)'}

## Existing decisions
{prlib.truncate(dec_lines, 2000) or '(none)'}
""")


def cmd_ingest(project, data):
    raw = sys.stdin.read()
    try:
        result = json.loads(raw)
    except Exception:
        result = {}
    sid = data.get("session_id", "")
    req, _prompt, message, diff = this_turn(project, data)
    ts = prlib.now_iso()

    # Cost first: even a failed or empty call was billed and belongs in the
    # A/B total. An empty answer gets a row with the error spelled out.
    out = result.get("structured_output")
    usage = result.get("usage") or {}
    model = next(iter(result.get("modelUsage") or {}), "") or result.get(MODEL_KEY, "")
    cost = {"ts": ts, "session_id": sid, "req": req, "model": model,
            "total_cost_usd": result.get("total_cost_usd"), "usage": usage,
            "duration_ms": result.get("duration_ms"), "num_turns": result.get("num_turns"),
            "ok": isinstance(out, dict)}
    if not cost["ok"]:
        cost["error"] = prlib.truncate(norm(result.get("result") or raw) or "empty output", 200)
    prlib.append_jsonl(prlib.state_dir(project) / "costs.jsonl", cost)

    if not isinstance(out, dict):
        prlib.append_jsonl(prlib.journal_path(project), {
            "t": "extract_error", "ts": ts, "session_id": sid, "req": req,
            "error": prlib.truncate(result.get("result") or raw, 300),
        })
        return 0
    fp = fingerprint(message, diff)
    if out.get("nothing_to_record"):
        prlib.append_jsonl(prlib.journal_path(project), {
            "t": "extract", "ts": ts, "session_id": sid, "req": req, "fp": fp,
            "nothing_to_record": True})
        return 0

    reqs = prlib.latest_by_id(prlib.read_jsonl(prlib.requirements_path(project)))
    r = out.get("requirement") or {}
    rid = r.get("id") if r.get("id") in reqs else req
    if rid:
        base = dict(reqs.get(rid, {"id": rid}))
        base.update({
            "id": rid, "title": (norm(r.get("title")) or base.get("title", ""))[:80],
            "statement": norm(r.get("statement")) or base.get("statement", ""),
            "status": r.get("status") or base.get("status", "open"),
            "acceptance": [norm(a) for a in r.get("acceptance") or []][:10],
            "sub_requirements": [norm(a) for a in r.get("sub_requirements") or []][:10],
            "ts": ts, "session_id": sid,
        })
        prlib.append_jsonl(prlib.requirements_path(project), base)
    for old in out.get("supersedes") or []:
        if old in reqs and old != rid:
            row = dict(reqs[old])
            row.update({"status": "superseded", "superseded_by": rid, "ts": ts})
            prlib.append_jsonl(prlib.requirements_path(project), row)

    # A rule laid down by the user can only be evidenced from the prompt, so the prompt text
    # (journaled by pr-prompt.sh) is part of the haystack. Attempt 3 lost the batch-3 date rule
    # here: Haiku quoted the prompt correctly and the guard, which only knew the message and
    # the diff, threw it away.
    prompt_text = ""
    for row in prlib.read_jsonl(prlib.journal_path(project)):
        if row.get("t") == "prompt" and row.get("req") == rid:
            prompt_text = row.get("prompt") or ""
    haystack = norm(message) + " " + norm(diff) + " " + norm(prompt_text)

    hay_sq = squash(haystack)

    def has_evidence(item):
        raw = item.get("evidence") or ""
        whole = squash(raw)
        if len(whole) >= 10 and whole in hay_sq:
            return True
        # The model sometimes stitches a quote from two real passages in the wrong order (a
        # heading after the bullets it introduces). Every word is genuine, the sequence is not.
        # Accept when every segment of the quote is itself verbatim and the segments cover the
        # quote almost entirely; invented text still fails because its segments are not found.
        segs = [squash(s) for s in re.split(r"[\n.;:!?]+", raw)]
        segs = [s for s in segs if len(s) >= 12]
        if not segs:
            return False
        found = [s for s in segs if s in hay_sq]
        return len(found) == len(segs) and sum(map(len, found)) >= 0.8 * len(whole)

    existing = [d for d in prlib.read_jsonl(prlib.decisions_jsonl_path(project))
                if d.get("kind", "decision") == "decision"]
    # A retry turn (red gate) sees the same diff again; the same quote or the
    # same title is the same decision, not a new one.
    seen = {norm(e.get("evidence")) for e in existing} | {norm(e.get("title")).lower() for e in existing}
    accepted, considered = [], []
    # Rules first, then choices; never more than two per turn. Attempt 2 captured 47 decisions
    # across 10 sessions and the one that mattered had scrolled out of the memory block.
    decs_in = sorted(out.get("decisions") or [],
                     key=lambda d: 0 if d.get("kind") == "rule" else 1)[:MAX_DECISIONS_PER_TURN]
    for d in decs_in:
        if norm(d.get("evidence")) in seen or norm(d.get("title")).lower() in seen:
            continue
        if not has_evidence(d):
            prlib.append_jsonl(prlib.journal_path(project), {
                "t": "rejected_evidence", "ts": ts, "session_id": sid, "req": rid,
                "kind": "decision", "title": d.get("title"), "evidence": d.get("evidence")})
            continue
        did = prlib.next_id("DEC", [e["id"] for e in existing] + [a["id"] for a in accepted])
        # Source is decided deterministically: a quote that comes from the prompt is the user's
        # rule whatever the model labelled it. The label alone was wrong in about a third of
        # runs, and the user/assistant distinction gates pinning and supersession.
        src = "user" if squash(d.get("evidence")) and squash(d.get("evidence")) in squash(prompt_text) \
            else (d.get("source") or "assistant")
        d["source"] = src
        accepted.append({"kind": "decision", "dkind": (d.get("kind") or "choice"),
                         "source": src,
                         "id": did, "ts": ts, "date": prlib.today(),
                         "req": rid, "session_id": sid, "title": norm(d.get("title")),
                         "chose": norm(d.get("chose")), "why": norm(d.get("why")),
                         "rejected": [{"option": norm(x.get("option")), "drawback": norm(x.get("drawback"))}
                                      for x in d.get("rejected") or []],
                         "evidence": norm(d.get("evidence"))})
        # A refined rule retires the one it narrows; the old topic file stays for the why.
        by_id = {e.get("id"): e for e in existing}
        for old in d.get("supersedes_decisions") or []:
            if old not in by_id or old == did:
                continue
            # Only a rule the user laid down in a later prompt may retire an earlier rule.
            # Refinements come from prompts; an assistant's implementation choice never
            # outranks anything (the smoke test saw "use slice().sort()" retire the ordering rule).
            if d.get("source") != "user":
                continue
            prlib.append_jsonl(prlib.decisions_jsonl_path(project), {
                "kind": "supersede", "old": old, "new": did, "ts": ts,
                "session_id": sid, "req": rid})
    for nd in out.get("non_decisions") or []:
        if not has_evidence(nd):
            prlib.append_jsonl(prlib.journal_path(project), {
                "t": "rejected_evidence", "ts": ts, "session_id": sid, "req": rid,
                "kind": "non_decision", "option": nd.get("option"), "evidence": nd.get("evidence")})
            continue
        considered.append({"kind": "non_decision", "ts": ts, "date": prlib.today(), "req": rid,
                           "session_id": sid, "option": norm(nd.get("option")),
                           "why_not_done": norm(nd.get("why_not_done")),
                           "evidence": norm(nd.get("evidence"))})

    for row in accepted + considered:
        prlib.append_jsonl(prlib.decisions_jsonl_path(project), row)
    if accepted or considered:
        append_decisions_md(project, accepted, considered, rid)

    prlib.append_jsonl(prlib.journal_path(project), {
        "t": "extract", "ts": ts, "session_id": sid, "req": rid, "fp": fp,
        "status": r.get("status"), "decisions": [a["id"] for a in accepted],
        "non_decisions": len(considered)})
    return 0


def append_decisions_md(project, accepted, considered, rid):
    path = prlib.record_dir(project) / "decisions.md"
    parts = []
    if not path.exists():
        parts.append("# Decisions\n\n_Appended by product-traceability hooks. Do not edit by hand._\n")
    for d in accepted:
        rejected = "; ".join(f"{x['option']} - {x['drawback']}" for x in d["rejected"]) or "none stated"
        parts.append(f"""
## {d['id']} - {d['title']}

- Date: {d['date']}
- REQ: {d['req']}
- Status: accepted
- Chose: {d['chose']}
- Why: {d['why']}
- Rejected: {rejected}
- Evidence: "{d['evidence']}"
""")
    if considered:
        parts.append(f"\n### Considered, not done ({rid}, {considered[0]['date']})\n\n")
        for c in considered:
            parts.append(f"- {c['option']} - {c['why_not_done']}. Evidence: \"{c['evidence']}\"\n")
    with open(path, "a", encoding="utf-8") as fh:
        fh.write("".join(parts))


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "snapshot":
        # The hook input arrives on stdin; argv[2] is where the snapshot is WRITTEN. Loading
        # argv[2] here (as build/ingest do) produced diff-only snapshots with no session id
        # and no final message for three runs (attempts 19-21, 2026-09-12).
        try:
            data = json.loads(sys.stdin.read() or "{}")
        except Exception:
            data = {}
        project = prlib.project_dir(data)
        prlib.ensure_dirs(project)
        return cmd_snapshot(project, data, sys.argv[2]) or 0
    data = load(sys.argv[2]) if len(sys.argv) > 2 else {}
    project = prlib.project_dir(data)
    prlib.ensure_dirs(project)
    if cmd == "build":
        return cmd_build(project, data) or 0
    if cmd == "ingest":
        with prlib.Lock(prlib.state_dir(project) / "journal.lock"):
            return cmd_ingest(project, data) or 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
