#!/usr/bin/env bash
# Fast checks that need no Claude usage. CI runs exactly this script.
#
#   ./tests/check.sh
#
# 1. shell scripts parse
# 2. Python files compile
# 3. JSON files parse
# 4. the installer works in a throwaway Claude home: full, light, switching, uninstall,
#    and the user's own settings and CLAUDE.md survive
# 5. the published study numbers recompute from the raw sessions
# 6. the README charts match the published data

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
export PYTHONDONTWRITEBYTECODE=1

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT
pass() { printf '  ok  %s\n' "$*"; }
fail() { printf '  FAIL %s\n' "$*" >&2; exit 1; }

echo "1. shell syntax"
for f in install.sh uninstall.sh hooks/*.sh bin/*.sh tests/*.sh; do
  bash -n "$f" || fail "$f"
done
pass "all shell scripts parse"

echo "2. python compiles"
python3 - <<'PY' || fail "python compile"
import pathlib, sys
files = [*pathlib.Path('bin').glob('*.py'), *pathlib.Path('ab-study/runner').glob('*.py'),
         pathlib.Path('docs/charts/make_charts.py')]
for f in files:
    compile(f.read_text(), str(f), 'exec')
print(f'  ok  {len(files)} Python files compile')
PY

echo "3. json parses"
python3 - <<'PY' || fail "json"
import json, pathlib
files = ['project-settings.json', 'bin/schema/extract.json',
         'ab-study/builds/product-traceability-v2.6/project-settings.json',
         'ab-study/builds/product-traceability-light/project-settings.json']
for f in files:
    json.loads(pathlib.Path(f).read_text())
print(f'  ok  {len(files)} JSON files parse')
PY

echo "4. installer"
H="${TMP}/home"
mkdir -p "${H}"
printf '{"theme": "dark", "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "/usr/local/bin/mine.sh"}]}]}}\n' > "${H}/settings.json"
printf '# My rules\n' > "${H}/CLAUDE.md"
hooks_of() {
  python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(sorted({h['command'].split('/')[-1] for b in d.get('hooks',{}).values() for e in b for h in e['hooks']}))" "${H}/settings.json"
}
CLAUDE_HOME="${H}" ./install.sh >/dev/null
[[ "$(hooks_of)" == "['mine.sh', 'pr-check.sh', 'pr-flush.sh', 'pr-prompt.sh', 'pr-start.sh', 'pr-stop.sh', 'pr-trace-bash.sh', 'pr-trace.sh']" ]] || fail "full install hooks: $(hooks_of)"
[[ -f "${H}/skills/product-traceability/SKILL.md" && -f "${H}/hooks/product-traceability/bin/prlib.py" ]] || fail "full install files"
pass "full install registers the hooks and keeps the user's hook"
CLAUDE_HOME="${H}" ./install.sh >/dev/null
[[ "$(hooks_of)" == "['mine.sh', 'pr-check.sh', 'pr-flush.sh', 'pr-prompt.sh', 'pr-start.sh', 'pr-stop.sh', 'pr-trace-bash.sh', 'pr-trace.sh']" ]] || fail "reinstall duplicated hooks"
pass "re-running the installer changes nothing"
CLAUDE_HOME="${H}" ./install.sh --light >/dev/null
[[ "$(hooks_of)" == "['mine.sh']" ]] || fail "light left hooks: $(hooks_of)"
[[ "$(grep -c 'product-traceability-light:start' "${H}/CLAUDE.md")" == "1" ]] || fail "light block"
[[ ! -d "${H}/skills/product-traceability" ]] || fail "light left the skill"
pass "--light replaces the full install with one rules block"
CLAUDE_HOME="${H}" ./uninstall.sh >/dev/null
[[ "$(hooks_of)" == "['mine.sh']" ]] || fail "uninstall hooks"
[[ "$(cat "${H}/CLAUDE.md")" == "# My rules" ]] || fail "uninstall CLAUDE.md: $(cat "${H}/CLAUDE.md")"
python3 -c "import json,sys; assert json.load(open(sys.argv[1]))['theme']=='dark'" "${H}/settings.json" || fail "user settings lost"
pass "uninstall leaves the user's settings and CLAUDE.md as they were"

echo "5. study results"
python3 ab-study/runner/collect.py --data ab-study/results/2026-09-replication --out "${TMP}/results" >/dev/null
for f in runs.csv summary.md; do
  cmp -s "${TMP}/results/${f}" "ab-study/results/2026-09-replication/${f}" || fail "${f} does not match the raw sessions"
done
pass "runs.csv and summary.md recompute exactly from the raw sessions"

echo "6. charts"
python3 docs/charts/make_charts.py --out "${TMP}/images" >/dev/null
for f in "${TMP}"/images/*.svg; do
  cmp -s "${f}" "docs/images/$(basename "${f}")" || fail "docs/images/$(basename "${f}") is out of date (run docs/charts/make_charts.py)"
done
pass "README charts match the published data"

echo "all checks passed"
