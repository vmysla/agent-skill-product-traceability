#!/usr/bin/env bash
# Product Traceability - PostToolUse hook for Bash (async, silent).
#
# Edits made through the shell (heredocs, python -c, sed -i) never pass
# through Edit/Write. This hook snapshots the working tree (git status plus
# mtimes, harness excluded) into .claude/pr/tree-snapshot.json, journals what
# changed since the last snapshot as one bash_change line, and then runs the
# standing checks exactly as pr-check.sh does after an Edit (same debounce).
# A Bash call that changed nothing costs two git commands and no check run.

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/pr-common.sh"

if pr_py journal.py bash_change >/dev/null 2>&1; then
  pr_py check.py >/dev/null 2>&1 || true
fi
exit 0
