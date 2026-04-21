#!/usr/bin/env bash
# Product Traceability — UserPromptSubmit hook
#
# Runs on every user prompt in Claude Code. Injects the always-active
# Product Traceability rule into the conversation as additional context,
# and appends the raw prompt to a per-project session log so nothing
# is lost across sessions, models, or tools.
#
# Hook input arrives on stdin as JSON (see Claude Code hooks docs):
#   { "session_id": "...", "cwd": "...", "prompt": "...", ... }
#
# We emit plain text on stdout; Claude Code injects it as additional
# context for the current turn when the hook exits 0.

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
PROMPT="$(read_json prompt)"
SESSION_ID="$(read_json session_id)"
SESSION_ID="${SESSION_ID:-unknown}"

SKILL_DIR="${HOME}/.claude/skills/product-traceability"
RULE_FILE="${SKILL_DIR}/rules/product-traceability.md"

# 1. Append raw prompt to the project's session log (trace history).
TRACE_DIR="${PROJECT_DIR}/.product-traceability"
if mkdir -p "${TRACE_DIR}/sessions" 2>/dev/null; then
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  LOG_FILE="${TRACE_DIR}/sessions/$(date -u +%Y-%m-%d).md"
  {
    printf '\n## %s  session=%s\n\n' "${TS}" "${SESSION_ID}"
    printf '### Prompt\n\n```\n%s\n```\n' "${PROMPT}"
  } >> "${LOG_FILE}" 2>/dev/null || true
fi

# 2. Emit the always-active rule as additional context.
if [[ -r "${RULE_FILE}" ]]; then
  printf '<!-- injected by product-traceability UserPromptSubmit hook -->\n'
  cat "${RULE_FILE}"
else
  cat <<'EOF'
# Product Traceability (Always Active)

After every task that modifies code, configuration, or project structure,
update these files in the project root:

1. `requirements.md` — living PRD (current state, not history)
2. `change.log` — append-only, dated history (newest at top)
3. `decisions.md` — rationale for non-obvious choices
4. `traceability-matrix.md` — requirement ↔ prompt ↔ artifact map

Create any of these files that do not yet exist.
EOF
fi

exit 0
