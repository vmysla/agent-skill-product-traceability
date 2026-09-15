#!/usr/bin/env bash
# Product Traceability - UserPromptSubmit hook (sync, injects one line).
#
# Assigns the next REQ id, journals the prompt, seeds the requirement, and
# tells the model the id so it can tag the code it writes. One line: every
# token here is replayed on every later turn of the session.

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/pr-common.sh"

pr_py journal.py prompt 2>/dev/null || true
exit 0
