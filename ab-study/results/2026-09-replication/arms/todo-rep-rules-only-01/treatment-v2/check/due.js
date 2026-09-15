import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../todos.js', import.meta.url), 'utf8');
const { localDateString, isOverdue } = new Function(src + '\nreturn { localDateString, isOverdue };')();

// Local getters, not UTC: late evening and just after midnight stay on their local day.
assert.strictEqual(localDateString(new Date(2026, 8, 13, 23, 59)), '2026-09-13');
assert.strictEqual(localDateString(new Date(2026, 0, 1, 0, 0)), '2026-01-01');

assert.strictEqual(isOverdue('2026-09-12', '2026-09-13'), true);
assert.strictEqual(isOverdue('2026-09-13', '2026-09-13'), false);
assert.strictEqual(isOverdue('2026-09-14', '2026-09-13'), false);
assert.strictEqual(isOverdue('2025-12-31', '2026-01-01'), true);
assert.strictEqual(isOverdue(undefined, '2026-09-13'), false);
assert.strictEqual(isOverdue('', '2026-09-13'), false);
console.log('due: ok');
