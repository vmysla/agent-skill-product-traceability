#!/usr/bin/env bash
# Product Traceability — uninstaller.
#
# Removes the skill, the hook scripts, and the registered hook commands
# from ~/.claude/settings.json. Leaves trace files in individual projects
# alone (they are user data).

set -euo pipefail

CLAUDE_HOME="${CLAUDE_HOME:-${HOME}/.claude}"
SKILL_DST="${CLAUDE_HOME}/skills/product-traceability"
HOOK_DST="${CLAUDE_HOME}/hooks/product-traceability"
SETTINGS="${CLAUDE_HOME}/settings.json"

say() { printf '\033[1;36m[product-traceability]\033[0m %s\n' "$*"; }

command -v python3 >/dev/null 2>&1 || { echo "python3 required" >&2; exit 1; }

if [[ -d "${SKILL_DST}" ]]; then
  say "removing skill ${SKILL_DST}"
  rm -rf "${SKILL_DST}"
fi

if [[ -d "${HOOK_DST}" ]]; then
  say "removing hooks ${HOOK_DST}"
  rm -rf "${HOOK_DST}"
fi

if [[ -f "${SETTINGS}" ]]; then
  say "deregistering hooks in ${SETTINGS}"
  TMP="$(mktemp)"
  python3 - "${SETTINGS}" "${HOOK_DST}" > "${TMP}" <<'PY'
import json, sys

settings_path, hook_dst = sys.argv[1], sys.argv[2]
prefix = hook_dst.rstrip("/") + "/"

with open(settings_path) as f:
    try:
        data = json.load(f)
    except json.JSONDecodeError:
        data = {}

hooks = data.get("hooks", {})
for event, bucket in list(hooks.items()):
    cleaned = []
    for entry in bucket:
        kept = [h for h in entry.get("hooks", [])
                if not str(h.get("command", "")).startswith(prefix)]
        if kept:
            entry["hooks"] = kept
            cleaned.append(entry)
    if cleaned:
        hooks[event] = cleaned
    else:
        hooks.pop(event, None)

if not hooks:
    data.pop("hooks", None)

json.dump(data, sys.stdout, indent=2)
sys.stdout.write("\n")
PY
  mv "${TMP}" "${SETTINGS}"
fi

say "done. Project trace files were left in place."
