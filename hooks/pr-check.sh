#!/usr/bin/env bash
# Product Traceability - PostToolUse hook for Edit|Write (async, silent).
#
# Runs the standing checks under check/ and records the result in
# .claude/pr/check-status.json. The Stop hook reads that file; the model
# never runs the checks itself, which is where the control arm spent 40
# of its 138 tool calls.

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/pr-common.sh"

pr_py check.py >/dev/null 2>&1 || true
exit 0
