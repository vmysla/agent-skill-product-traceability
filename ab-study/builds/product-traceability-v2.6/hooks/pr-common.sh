#!/usr/bin/env bash
# Product Record - shared prologue, sourced by every pr-*.sh hook.
#
# Reads the hook's stdin JSON once into INPUT_JSON, resolves the project
# directory, the session id and the bin/ directory, and leaves early when
# running inside the nested extraction call (PR_HOOK_CHILD=1) so the
# cheap-model child can never re-enter the pipeline.
#
# Hooks must never exit non-zero by accident: exit 1 prints a visible error
# into the model's context on every firing. Callers wrap risky steps in
# "|| true"; this prologue itself only fails soft.

[[ "${PR_HOOK_CHILD:-}" == "1" ]] && exit 0

INPUT_JSON="$(cat 2>/dev/null || true)"
export INPUT_JSON
export PYTHONDONTWRITEBYTECODE=1   # keep __pycache__ out of .claude/bin

pr_field() {
  # Print one string field of the hook input; empty on any failure.
  INPUT_JSON="${INPUT_JSON}" python3 -c '
import json, os, sys
try:
    v = json.loads(os.environ.get("INPUT_JSON", "") or "{}").get(sys.argv[1], "")
    sys.stdout.write(v if isinstance(v, str) else json.dumps(v))
except Exception:
    pass
' "$1" 2>/dev/null || true
}

PROJECT_DIR="$(pr_field cwd)"
PROJECT_DIR="${PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$PWD}}"
# The session shell keeps its cwd across Bash calls (`cd check` sticks), so anchor on the
# git toplevel; otherwise .claude/pr/ gets created inside whatever directory the model is in.
PROJECT_DIR="$(git -C "${PROJECT_DIR}" rev-parse --show-toplevel 2>/dev/null || echo "${PROJECT_DIR}")"
SESSION_ID="$(pr_field session_id)"
SESSION_ID="${SESSION_ID:-unknown}"
export CLAUDE_PROJECT_DIR="${PROJECT_DIR}"

# bin/: PR_BIN_DIR (set by the settings entry), else next to the hooks
# (global install), else the sibling of the hooks dir (project install).
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${PR_BIN_DIR:-}"
[[ -n "${BIN_DIR}" && -d "${BIN_DIR}" ]] || BIN_DIR="${HOOK_DIR}/bin"
[[ -d "${BIN_DIR}" ]] || BIN_DIR="${HOOK_DIR}/../bin"
BIN_DIR="$(cd "${BIN_DIR}" 2>/dev/null && pwd || echo "${BIN_DIR}")"
PR_DIR="${PROJECT_DIR}/.claude/pr"

pr_py() {
  # Run a bin/ script with the hook input on stdin, from the project dir.
  local script="$1"; shift
  ( cd "${PROJECT_DIR}" 2>/dev/null && printf '%s' "${INPUT_JSON}" | python3 "${BIN_DIR}/${script}" "$@" )
}
