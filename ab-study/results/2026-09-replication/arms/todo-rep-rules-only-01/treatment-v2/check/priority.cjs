var assert = require('assert');
var fs = require('fs');
var vm = require('vm');

var t = {};
vm.runInNewContext(fs.readFileSync(__dirname + '/../todos.js', 'utf8'), t);

assert.strictEqual(t.normalizePriority('low'), 'low');
assert.strictEqual(t.normalizePriority('high'), 'high');
assert.strictEqual(t.normalizePriority(undefined), 'med');
assert.strictEqual(t.normalizePriority('urgent'), 'med');

function ids(list) { return list.map(function (x) { return x.id; }); }

// Completed still sit below active, whatever their priority.
var list = [
  { id: 'a', completed: true, priority: 'high' },
  { id: 'b', completed: false, priority: 'low' }
];
assert.deepStrictEqual(ids(t.visibleTodos(list, 'all')), ['b', 'a']);

// Within a group: high, med, low; ties keep insertion order; missing is med.
var mixed = [
  { id: 'l1', priority: 'low' },
  { id: 'm1' },
  { id: 'h1', priority: 'high' },
  { id: 'm2', priority: 'med' },
  { id: 'h2', priority: 'high' },
  { id: 'c1', completed: true, priority: 'low' },
  { id: 'c2', completed: true, priority: 'high' }
];
assert.deepStrictEqual(ids(t.visibleTodos(mixed, 'all')), ['h1', 'h2', 'm1', 'm2', 'l1', 'c2', 'c1']);
assert.deepStrictEqual(ids(t.visibleTodos(mixed, 'completed')), ['c2', 'c1']);

console.log('priority checks passed');
