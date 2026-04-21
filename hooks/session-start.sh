#!/usr/bin/env bash
# Product Traceability — SessionStart hook
#
# Runs when a Claude Code session starts. Ensures the four traceability
# files exist in the project root (seeded from templates if missing) and
# records a session-start marker in the per-project trace log.

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
SESSION_ID="$(read_json session_id)"
SESSION_ID="${SESSION_ID:-unknown}"

SKILL_DIR="${HOME}/.claude/skills/product-traceability"
TEMPLATES="${SKILL_DIR}/templates"

seed() {
  local dest="$1"; local template="$2"
  if [[ ! -e "${dest}" && -r "${TEMPLATES}/${template}" ]]; then
    cp "${TEMPLATES}/${template}" "${dest}" 2>/dev/null || true
  fi
}

seed "${PROJECT_DIR}/requirements.md"         requirements.md
seed "${PROJECT_DIR}/change.log"              change.log
seed "${PROJECT_DIR}/decisions.md"            decisions.md
seed "${PROJECT_DIR}/traceability-matrix.md"  traceability-matrix.md

TRACE_DIR="${PROJECT_DIR}/.product-traceability"
if mkdir -p "${TRACE_DIR}/sessions" 2>/dev/null; then
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '\n# Session %s started %s\n' "${SESSION_ID}" "${TS}" \
    >> "${TRACE_DIR}/sessions/$(date -u +%Y-%m-%d).md" 2>/dev/null || true
fi

# Emit a short reminder to Claude at session start.
cat <<'EOF'
<!-- injected by product-traceability SessionStart hook -->
# Product Traceability active

This project is tracked by the Product Traceability skill.
Four files in the project root are kept in sync by you:
- `requirements.md`, `change.log`, `decisions.md`, `traceability-matrix.md`

Update them whenever code, configuration, or structure changes.
EOF

exit 0
