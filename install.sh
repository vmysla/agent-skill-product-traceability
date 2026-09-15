#!/usr/bin/env bash
# Product Traceability v2 - installer for Claude Code.
#
#   ./install.sh              Product Traceability: skill, hooks and helpers, registered
#                             in ~/.claude/settings.json
#   ./install.sh --light      Product Traceability Light: six working rules in
#                             ~/.claude/CLAUDE.md, no hooks, no record
#   ./install.sh --uninstall  remove both
#
# The two modes are exclusive: installing one removes the other. Every mode also removes
# Product Traceability v1 (its three hooks and its skill files). Re-running is safe.
# Records in your projects (docs/product-traceability/) and native memory are never touched.

set -euo pipefail

MODE=full
case "${1:-}" in
  ""|--full)   MODE=full ;;
  --light)     MODE=light ;;
  --uninstall) MODE=uninstall ;;
  -h|--help)   sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *)           echo "unknown option: $1 (use --light, --uninstall, or no option)" >&2; exit 2 ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_HOME:-${CLAUDE_CONFIG_DIR:-${HOME}/.claude}}"
SKILL_DST="${CLAUDE_HOME}/skills/product-traceability"
HOOK_DST="${CLAUDE_HOME}/hooks/product-traceability"
BIN_DST="${HOOK_DST}/bin"
SETTINGS="${CLAUDE_HOME}/settings.json"
CLAUDE_MD="${CLAUDE_HOME}/CLAUDE.md"
LIGHT_START="<!-- product-traceability-light:start -->"
LIGHT_END="<!-- product-traceability-light:end -->"

say() { printf '\033[1;36m[product-traceability]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[product-traceability]\033[0m %s\n' "$*" >&2; exit 1; }

command -v python3 >/dev/null 2>&1 || die "python3 is required"

# One helper for every edit to settings.json and CLAUDE.md, so install and uninstall agree.
helper() {
  python3 - "$@" <<'PY'
import json, sys
from pathlib import Path

op, args = sys.argv[1], sys.argv[2:]

def load(path):
    try:
        return json.loads(Path(path).read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def save(path, data):
    Path(path).write_text(json.dumps(data, indent=2) + "\n")

if op == "remove-hooks":
    # Drop every hook command that runs a script from our hooks directory: v1 and v2 alike.
    settings, hook_dst = args
    data = load(settings)
    hooks = data.get("hooks", {})
    for event, bucket in list(hooks.items()):
        kept_entries = []
        for entry in bucket:
            kept = [h for h in entry.get("hooks", []) if hook_dst + "/" not in str(h.get("command", ""))]
            if kept:
                entry["hooks"] = kept
                kept_entries.append(entry)
        if kept_entries:
            hooks[event] = kept_entries
        else:
            hooks.pop(event, None)
    if "hooks" in data and not hooks:
        data.pop("hooks")
    save(settings, data)

elif op == "add-hooks":
    # The template is the single source of truth for events, matchers and timeouts;
    # the A/B study runner writes the same file into each project.
    settings, template, hook_dst, bin_dst, skill_dst = args
    data = load(settings)
    text = Path(template).read_text()
    text = text.replace("{HOOKS_DIR}", hook_dst).replace("{BIN_DIR}", bin_dst).replace("{SKILL_DIR}", skill_dst)
    hooks = data.setdefault("hooks", {})
    for event, entries in json.loads(text)["hooks"].items():
        bucket = hooks.setdefault(event, [])
        for entry in entries:
            matcher = entry.get("matcher", "")
            target = next((e for e in bucket if e.get("matcher", "") == matcher), None)
            if target is None:
                target = {"matcher": matcher} if matcher else {}
                target["hooks"] = []
                bucket.append(target)
            target.setdefault("hooks", []).extend(entry["hooks"])
    save(settings, data)

elif op == "remove-block":
    path, start, end = args
    p = Path(path)
    if p.exists():
        text = p.read_text()
        if start in text and end in text:
            head, rest = text.split(start, 1)
            _, tail = rest.split(end, 1)
            head, tail = head.rstrip("\n"), tail.lstrip("\n")
            p.write_text(head + ("\n\n" if head and tail else "\n" if head else "") + tail)

elif op == "write-block":
    path, start, end, source = args
    p = Path(path)
    text = p.read_text() if p.exists() else ""
    block = f"{start}\n{Path(source).read_text().rstrip()}\n{end}\n"
    p.write_text((text.rstrip("\n") + "\n\n" if text.strip() else "") + block)

else:
    raise SystemExit(f"unknown helper op {op}")
PY
}

mkdir -p "${CLAUDE_HOME}"

# 1. Start clean: remove v1, v2 and Light, whatever is installed.
if [[ -f "${SETTINGS}" ]]; then
  helper remove-hooks "${SETTINGS}" "${HOOK_DST}"
fi
if [[ -d "${SKILL_DST}" || -d "${HOOK_DST}" ]]; then
  say "removing the previous install (${SKILL_DST}, ${HOOK_DST})"
  rm -rf "${SKILL_DST}" "${HOOK_DST}"
fi
helper remove-block "${CLAUDE_MD}" "${LIGHT_START}" "${LIGHT_END}"

case "${MODE}" in
  full)
    command -v claude >/dev/null 2>&1 || say "warning: claude CLI not on PATH; decision extraction will be skipped"
    say "installing skill -> ${SKILL_DST}"
    mkdir -p "${SKILL_DST}" "${BIN_DST}"
    cp -R "${REPO_ROOT}/skill/product-traceability/." "${SKILL_DST}/"
    say "installing hooks -> ${HOOK_DST}"
    cp "${REPO_ROOT}/hooks/"*.sh "${HOOK_DST}/"
    cp -R "${REPO_ROOT}/bin/." "${BIN_DST}/"
    chmod +x "${HOOK_DST}/"*.sh "${BIN_DST}/"*.py "${BIN_DST}/"*.sh
    say "registering hooks in ${SETTINGS}"
    helper add-hooks "${SETTINGS}" "${REPO_ROOT}/project-settings.json" "${HOOK_DST}" "${BIN_DST}" "${SKILL_DST}"
    cat <<EOF

Product Traceability is installed.
  skill     ${SKILL_DST}
  hooks     ${HOOK_DST}
  settings  ${SETTINGS}

Open any git project in Claude Code. After the first turn that changes code, the record
appears in docs/product-traceability/ and a 30-line summary in the project's native memory.
EOF
    ;;
  light)
    say "adding the working rules to ${CLAUDE_MD}"
    helper write-block "${CLAUDE_MD}" "${LIGHT_START}" "${LIGHT_END}" "${REPO_ROOT}/light/CLAUDE.md"
    cat <<EOF

Product Traceability Light is installed: six working rules in ${CLAUDE_MD},
between the product-traceability-light markers. No hooks, no record.
EOF
    ;;
  uninstall)
    say "done. Project records and native memory were left in place."
    ;;
esac
