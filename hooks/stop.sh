#!/usr/bin/env bash
# Product Traceability — Stop hook
#
# Runs when Claude Code finishes responding. Checks whether the turn
# produced code changes (edited/created files, git diff, etc.). If so,
# and the four traceability files have not been touched, returns a
# non-zero exit with a JSON decision that asks Claude to continue
# updating documentation before finishing.

set -euo pipefail

INPUT_JSON="$(cat || true)"
export INPUT_JSON

read_json() {
  local key="$1"
  INPUT_JSON="${INPUT_JSON}" python3 -c '
import json, os, sys
try:
    data = json.loads(os.environ.get("INPUT_JSON", "") or "{}")
    v = data.get(sys.argv[1], "")
    sys.stdout.write(v if isinstance(v, str) else json.dumps(v))
except Exception:
    pass
' "$key" 2>/dev/null || true
}

PROJECT_DIR="$(read_json cwd)"
PROJECT_DIR="${PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$PWD}}"
STOP_HOOK_ACTIVE="$(read_json stop_hook_active)"

# Avoid infinite loops: only nudge once per stop cycle.
if [[ "${STOP_HOOK_ACTIVE}" == "true" || "${STOP_HOOK_ACTIVE}" == "True" ]]; then
  exit 0
fi

cd "${PROJECT_DIR}" 2>/dev/null || exit 0

# Heuristic: did anything change in this session that should be traced?
HAS_CHANGES=0
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --quiet HEAD -- 2>/dev/null; then HAS_CHANGES=1; fi
  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then HAS_CHANGES=1; fi
fi

# Did the user edit any of the trace files this turn?
RECENT_MIN=10
TOUCHED=0
for f in requirements.md change.log decisions.md traceability-matrix.md; do
  if [[ -f "${f}" ]]; then
    if find "${f}" -mmin -${RECENT_MIN} -print 2>/dev/null | grep -q .; then
      TOUCHED=1
    fi
  fi
done

if [[ "${HAS_CHANGES}" == "1" && "${TOUCHED}" == "0" ]]; then
  cat <<'EOF'
{
  "decision": "block",
  "reason": "Product Traceability: code or config changed this turn but requirements.md / change.log / decisions.md / traceability-matrix.md were not updated. Update whichever of the four are relevant, then stop."
}
EOF
  exit 2
fi

exit 0
