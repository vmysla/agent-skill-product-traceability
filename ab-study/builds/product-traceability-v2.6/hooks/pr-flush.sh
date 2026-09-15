#!/usr/bin/env bash
# Product Record - SessionEnd hook (sync, silent).
#
# The Stop hook already projected the record; this only catches a session
# that ended without a Stop (interrupt, teardown). Re-projects when the
# journal has lines newer than the last projection. No extraction here:
# there is no assistant message to extract from.

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/pr-common.sh"

STALE="$(PR_DIR="${PR_DIR}" python3 - <<'PY' 2>/dev/null || true
import json, os
pr = os.environ["PR_DIR"]
try:
    done = json.load(open(os.path.join(pr, "state.json"))).get("projected_lines", 0)
except Exception:
    done = 0
try:
    have = sum(1 for l in open(os.path.join(pr, "journal.jsonl")) if l.strip())
except Exception:
    have = 0
print("yes" if have > done else "")
PY
)"

if [[ "${STALE}" == "yes" ]]; then
  pr_py compile.py >/dev/null 2>&1 || true
  pr_py memory.py write >/dev/null 2>&1 || true
fi
exit 0
