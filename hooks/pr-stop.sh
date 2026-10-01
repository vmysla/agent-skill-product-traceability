#!/usr/bin/env bash
# Product Traceability - Stop hook (sync part kept short).
#
# The session shows as busy until this hook returns, so only the fast steps run here:
#   1. journal the turn end (message excerpt + diffstat)
#   2. settle the standing checks: wait for an in-flight run, re-run if the
#      last result predates this session's last edit
#   5. red-check gate: the only exit-2 path, at most once per session
# Steps 3 and 4 run in a detached background job, one at a time (stop-bg.lock):
#   3. extract requirement status and decisions with ONE Haiku call, only
#      when this turn edited something
#   4. compile the record (zero tokens) and project it into native memory
#
# stop_hook_active means we are already inside the one extra turn the gate
# bought; never block again from there.

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/pr-common.sh"

case "$(pr_field stop_hook_active)" in
  true|True|1) exit 0 ;;
esac

mkdir -p "${PR_DIR}" 2>/dev/null || true
# One file per turn, so a turn whose job could not start yet is resumed as a leftover.
STOP_INPUT="${PR_DIR}/stop-input-${SESSION_ID}-$(date +%s).json"
# The diff is captured now, inside the stop-input, so that if this hook is killed before
# extraction finishes (a harness that does not wait for hooks, a hard session end), the next
# Stop can resume it from the file even after the tree has moved on.
( cd "${PROJECT_DIR}" && printf '%s' "${INPUT_JSON}" | python3 "${BIN_DIR}/extract.py" snapshot "${STOP_INPUT}" ) >/dev/null 2>&1 \
  || printf '%s' "${INPUT_JSON}" > "${STOP_INPUT}" 2>/dev/null || true

pr_py journal.py turn_end >/dev/null 2>&1 || true

( cd "${PROJECT_DIR}" && printf '%s' "${INPUT_JSON}" | python3 "${BIN_DIR}/check.py" --if-stale ) >/dev/null 2>&1 || true

# Decide now: "edited this turn" reads rows since the latest prompt, and the next prompt
# may land before the background job gets here. No edits, nothing to extract.
pr_py journal.py has-edits >/dev/null 2>&1 || rm -f "${STOP_INPUT}" 2>/dev/null || true

(
  LOCK="${PR_DIR}/stop-bg.lock"
  # A job killed mid-run leaves its lock; break it after 15 minutes.
  [[ -n "$(find "${LOCK}" -maxdepth 0 -mmin +15 2>/dev/null)" ]] && rmdir "${LOCK}" 2>/dev/null
  # Another turn's job is still running: leave this turn's stop-input for the next job.
  mkdir "${LOCK}" 2>/dev/null || exit 0
  trap 'rmdir "${LOCK}" 2>/dev/null' EXIT
  # Every stop-input here is a turn not yet extracted (this one, or one a killed or
  # skipped job left behind).
  for pending in "${PR_DIR}"/stop-input-*.json; do
    [[ -f "${pending}" ]] || continue
    ( cd "${PROJECT_DIR}" && bash "${BIN_DIR}/extract.sh" "${pending}" ) || true
    rm -f "${pending}" 2>/dev/null || true
  done
  pr_py compile.py || true
  pr_py memory.py write || true
) </dev/null >/dev/null 2>&1 &
disown 2>/dev/null || true

# Red gate. Prints the block decision on stdout (JSON protocol) and the
# reason on stderr (exit-2 protocol) so either reading of the Stop contract
# delivers the message.
REASON="$(SESSION_ID="${SESSION_ID}" PR_DIR="${PR_DIR}" python3 - <<'PY' 2>/dev/null || true
import json, os, sys
pr, sid = os.environ["PR_DIR"], os.environ["SESSION_ID"]
try:
    st = json.load(open(os.path.join(pr, "check-status.json")))
except Exception:
    sys.exit(0)
marker = os.path.join(pr, f"red-reported-{sid}")
if st.get("status") != "red" or st.get("session_id") != sid or os.path.exists(marker):
    sys.exit(0)
open(marker, "w").close()
detail = "; ".join(f"{f.get('file')}: {' '.join(str(f.get('output', '')).split())[:300]}"
                   for f in st.get("failing", [])[:3])
sys.stdout.write(f"Standing check is red: {st.get('summary')}. {detail} Fix it, then stop.")
PY
)"

if [[ -n "${REASON}" ]]; then
  REASON="${REASON}" python3 -c 'import json,os; print(json.dumps({"decision":"block","reason":os.environ["REASON"]}))'
  printf '%s\n' "${REASON}" >&2
  exit 2
fi
exit 0
