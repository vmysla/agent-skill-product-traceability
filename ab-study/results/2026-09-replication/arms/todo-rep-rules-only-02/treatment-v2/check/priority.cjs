var assert = require('assert');
var fs = require('fs');
var path = require('path');

var mod = { exports: {} };
new Function('module', fs.readFileSync(path.join(__dirname, '../todo-logic.js'), 'utf8'))(mod);
var L = mod.exports;

assert.strictEqual(L.normalizePriority('low'), 'low');
assert.strictEqual(L.normalizePriority('high'), 'high');
assert.strictEqual(L.normalizePriority('med'), 'med');
assert.strictEqual(L.normalizePriority(undefined), 'med');
assert.strictEqual(L.normalizePriority('urgent'), 'med');

// Priority order within each group; completed stay below active; ties keep insertion order.
var todos = [
  { id: 'a', priority: 'low' },
  { id: 'b', priority: 'high', completed: true },
  { id: 'c' },
  { id: 'd', priority: 'high' },
  { id: 'e', priority: 'med' },
  { id: 'f', priority: 'low', completed: true },
  { id: 'g', priority: 'high' }
];
var ids = function (list) { return list.map(function (t) { return t.id; }).join(''); };
assert.strictEqual(ids(L.visibleTodos(todos, 'all')), 'dgceabf');
assert.strictEqual(ids(L.visibleTodos(todos, 'active')), 'dgcea');
assert.strictEqual(ids(L.visibleTodos(todos, 'completed')), 'bf');

// Bulk actions keep stored order; display order still follows the ordering rule.
var all = L.markAllComplete(todos);
assert.ok(all.every(function (t) { return t.completed === true; }));
assert.strictEqual(ids(all), 'abcdefg');
assert.strictEqual(ids(L.visibleTodos(all, 'all')), 'bdgceaf');
assert.strictEqual(todos[0].completed, undefined);
assert.strictEqual(ids(L.clearCompleted(todos)), 'acdeg');
assert.strictEqual(ids(L.visibleTodos(L.clearCompleted(todos), 'all')), 'dgcea');
console.log('priority: ok');
