#!/usr/bin/env bash
# Product Traceability — installer for Claude Code.
#
# Installs the skill and registers three hooks (SessionStart,
# UserPromptSubmit, Stop) in ~/.claude/settings.json so the skill is
# triggered on every Claude Code interaction.
#
# Idempotent: re-running upgrades files in place and leaves the hook
# configuration in a valid, deduplicated state.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_HOME:-${HOME}/.claude}"
SKILL_SRC="${REPO_ROOT}/skill/product-traceability"
SKILL_DST="${CLAUDE_HOME}/skills/product-traceability"
HOOK_SRC="${REPO_ROOT}/hooks"
HOOK_DST="${CLAUDE_HOME}/hooks/product-traceability"
SETTINGS="${CLAUDE_HOME}/settings.json"

say() { printf '\033[1;36m[product-traceability]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[product-traceability]\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m[product-traceability]\033[0m %s\n' "$*" >&2; exit 1; }

command -v python3 >/dev/null 2>&1 || die "python3 is required to merge settings.json"

say "installing skill → ${SKILL_DST}"
mkdir -p "${SKILL_DST}"
cp -R "${SKILL_SRC}/." "${SKILL_DST}/"

say "installing hook scripts → ${HOOK_DST}"
mkdir -p "${HOOK_DST}"
cp "${HOOK_SRC}/"*.sh "${HOOK_DST}/"
chmod +x "${HOOK_DST}/"*.sh

say "registering hooks in ${SETTINGS}"
mkdir -p "${CLAUDE_HOME}"
[[ -f "${SETTINGS}" ]] || printf '{}\n' > "${SETTINGS}"

TMP="$(mktemp)"
python3 - "${SETTINGS}" "${HOOK_DST}" > "${TMP}" <<'PY'
import json, sys, os

settings_path, hook_dst = sys.argv[1], sys.argv[2]

with open(settings_path) as f:
    try:
        data = json.load(f)
    except json.JSONDecodeError:
        data = {}

hooks = data.setdefault("hooks", {})

# (event, script filename, matcher) — matcher "" means no matcher (all events).
registrations = [
    ("SessionStart",      "session-start.sh",       ""),
    ("UserPromptSubmit",  "user-prompt-submit.sh",  ""),
    ("Stop",              "stop.sh",                ""),
]

def ensure(event, script, matcher):
    cmd = f"{hook_dst}/{script}"
    bucket = hooks.setdefault(event, [])
    # Find existing entry with the same matcher, or create one.
    target = None
    for entry in bucket:
        if entry.get("matcher", "") == matcher:
            target = entry
            break
    if target is None:
        target = {"hooks": []}
        if matcher:
            target["matcher"] = matcher
        bucket.append(target)
    # Dedupe by command.
    target_hooks = target.setdefault("hooks", [])
    if not any(h.get("command") == cmd for h in target_hooks):
        target_hooks.append({"type": "command", "command": cmd})

for event, script, matcher in registrations:
    ensure(event, script, matcher)

json.dump(data, sys.stdout, indent=2)
sys.stdout.write("\n")
PY

mv "${TMP}" "${SETTINGS}"

say "done."
cat <<EOF

Installed:
  • skill      ${SKILL_DST}
  • hooks      ${HOOK_DST}
  • settings   ${SETTINGS}

Hooks registered:
  • SessionStart      → seeds requirements.md / change.log / decisions.md /
                        traceability-matrix.md in each project
  • UserPromptSubmit  → injects the always-active Product Traceability rule
                        and logs the prompt to .product-traceability/sessions/
  • Stop              → blocks the turn if code changed but trace files did not

To verify: open any project in Claude Code. On first user prompt, the four
files should appear in the project root (unless they already exist).

To uninstall: run ./uninstall.sh from this repo.
EOF
