import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
vm.runInThisContext(fs.readFileSync(new URL('../todos.js', import.meta.url), 'utf8'));

var todos = [
  { id: 'a', text: 'Buy Milk', completed: false, priority: 'low' },
  { id: 'b', text: 'milkshake', completed: true, priority: 'high' },
  { id: 'c', text: 'Walk dog', completed: false, priority: 'high' }
];
function ids(list) { return list.map(function (t) { return t.id; }).join(','); }

assert.strictEqual(ids(visibleTodos(todos, 'all', '')), 'c,a,b');
assert.strictEqual(ids(visibleTodos(todos, 'all', 'MILK')), 'a,b');
assert.strictEqual(ids(visibleTodos(todos, 'active', 'milk')), 'a');
assert.strictEqual(ids(visibleTodos(todos, 'completed', 'milk')), 'b');
assert.strictEqual(ids(visibleTodos(todos, 'all', 'cat')), '');
console.log('search: ok');
