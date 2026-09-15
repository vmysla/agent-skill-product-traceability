#!/usr/bin/env bash
# Product Traceability - PostToolUse hook for Edit|Write (async, silent).
#
# Journals one line per edit: file, tool, line counts, REQ markers. Nothing
# reaches the model: PostToolUse stdout only goes to the debug log, so this
# observation is free.

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/pr-common.sh"

pr_py journal.py edit >/dev/null 2>&1 || true
exit 0
