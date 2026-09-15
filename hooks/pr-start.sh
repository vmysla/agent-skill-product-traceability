#!/usr/bin/env bash
# Product Traceability - SessionStart hook (sync, injects).
#
# Emit-once: when the native MEMORY.md already carries the product-traceability
# block, native memory delivers the working rules inside the cached prefix
# and this hook prints nothing. Only a project's very first session gets
# the rules printed here, and the block is seeded at the same time so the
# next session finds it in memory.

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/pr-common.sh"

if pr_py memory.py has-block 2>/dev/null; then
  exit 0
fi

cat <<'EOF'
# Product traceability (maintained by hooks)
EOF
cat "${BIN_DIR}/working-rules.md" 2>/dev/null || true

pr_py memory.py write >/dev/null 2>&1 || true
exit 0
