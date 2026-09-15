// @verifies REQ-003
// Clearing rows together must beat clearing the same rows in any smaller groups.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const m = html.match(/var LINE_SCORES = (\[[^\]]*\]);/);
assert.ok(m, "LINE_SCORES not found");
const S = JSON.parse(m[1]);
assert.deepEqual(S, [0, 100, 300, 500, 800]);

// Best score for n rows split into at least two groups.
function bestSplit(n) {
  let best = 0;
  for (let k = 1; k < n; k++) best = Math.max(best, S[k] + Math.max(S[n - k], bestSplit(n - k)));
  return best;
}
for (let n = 2; n <= 4; n++) assert.ok(S[n] > bestSplit(n), `${n} rows together must beat any split`);
