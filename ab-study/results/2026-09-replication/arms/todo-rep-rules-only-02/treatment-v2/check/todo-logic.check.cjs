var assert = require('assert');
var fs = require('fs');
var vm = require('vm');

// todo-logic.js is a browser script; the parent package is "type": "module", so load it via vm.
var sandbox = {};
vm.runInNewContext(fs.readFileSync(__dirname + '/../todo-logic.js', 'utf8'), sandbox);
var visibleTodos = sandbox.TodoLogic.visibleTodos;
var localToday = sandbox.TodoLogic.localToday;
var isOverdue = sandbox.TodoLogic.isOverdue;

var todos = [
  { id: 'a', completed: true },
  { id: 'b' },
  { id: 'c', completed: false },
  { id: 'd', completed: true }
];
var ids = function (list) { return list.map(function (t) { return t.id; }).join(''); };

assert.strictEqual(ids(visibleTodos(todos, 'all')), 'bcad');
assert.strictEqual(ids(visibleTodos(todos)), 'bcad');
assert.strictEqual(ids(visibleTodos(todos, 'active')), 'bc');
assert.strictEqual(ids(visibleTodos(todos, 'completed')), 'ad');

// Local calendar date, late at night and early morning.
assert.strictEqual(localToday(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
assert.strictEqual(localToday(new Date(2026, 11, 31, 0, 1)), '2026-12-31');
assert.strictEqual(isOverdue({ due: '2026-09-12' }, '2026-09-13'), true);
assert.strictEqual(isOverdue({ due: '2026-09-13' }, '2026-09-13'), false);
assert.strictEqual(isOverdue({ due: '2026-09-14' }, '2026-09-13'), false);
assert.strictEqual(isOverdue({}, '2026-09-13'), false);

// Search: case-insensitive substring, combined with the filter.
var named = [
  { id: 'a', text: 'Buy Milk' },
  { id: 'b', text: 'milkshake', completed: true },
  { id: 'c', text: 'Walk dog' }
];
assert.strictEqual(ids(visibleTodos(named, 'all', 'MILK')), 'ab');
assert.strictEqual(ids(visibleTodos(named, 'active', 'milk')), 'a');
assert.strictEqual(ids(visibleTodos(named, 'completed', 'dog')), '');
assert.strictEqual(ids(visibleTodos(named, 'all', '')), 'acb');
console.log('todo-logic: ok');
