#!/usr/bin/env bash
# Product Record - ONE cheap-model call per turn that changed code.
#
# Builds a prompt from this turn (prompt, final message, diff, record so
# far), asks Haiku for a structured answer, and hands the answer to
# extract.py which applies the evidence guard and updates the record.
#
# Usage: extract.sh <stop-input.json>   (the Stop hook's stdin, saved to a file)
#
# The child is fenced twice: --setting-sources "" keeps it from loading the
# project hooks, and PR_HOOK_CHILD=1 makes every hook exit early if it does.
# Its cost is appended to .claude/pr/costs.jsonl by extract.py, success or
# not, so the A/B bill includes it.
#
# Measured on the smoke repo (same prompt, three configurations):
#   default system prompt + tools, warm cache   $0.034  18 s  (40k-token prefix)
#   own system prompt, --tools "", thinking on  $0.035  55 s  (5.4k thinking tokens)
#   own system prompt, --tools "", thinking off $0.008   5 s  <- this
# --max-turns 2 because the StructuredOutput tool needs its own turn.

set -uo pipefail
export PYTHONDONTWRITEBYTECODE=1

INPUT_FILE="${1:-}"
BIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL="${PR_EXTRACT_MODEL:-claude-haiku-4-5-20251001}"
BUDGET="${PR_EXTRACT_BUDGET_USD:-0.25}"
SYSTEM_PROMPT="You are a record-keeper. Extract only what the material states. Reply only through the structured output; do not use any other tool."

[[ -f "${INPUT_FILE}" ]] || exit 0
command -v claude >/dev/null 2>&1 || exit 0

PROMPT="$(python3 "${BIN_DIR}/extract.py" build "${INPUT_FILE}" 2>/dev/null || true)"
[[ -n "${PROMPT}" ]] || exit 0

# Run from an empty directory so the child inherits no CLAUDE.md or memory.
SCRATCH="$(mktemp -d 2>/dev/null || echo /tmp)"
OUTPUT="$(cd "${SCRATCH}" && printf '%s' "${PROMPT}" | PR_HOOK_CHILD=1 MAX_THINKING_TOKENS=0 claude -p \
  --model "${MODEL}" \
  --output-format json \
  --json-schema "$(cat "${BIN_DIR}/schema/extract.json")" \
  --system-prompt "${SYSTEM_PROMPT}" \
  --tools "" \
  --disable-slash-commands \
  --strict-mcp-config \
  --setting-sources "" \
  --no-session-persistence \
  --max-turns 2 \
  --max-budget-usd "${BUDGET}" 2>/dev/null || true)"
rmdir "${SCRATCH}" 2>/dev/null || true

printf '%s' "${OUTPUT}" | python3 "${BIN_DIR}/extract.py" ingest "${INPUT_FILE}" || true
exit 0
