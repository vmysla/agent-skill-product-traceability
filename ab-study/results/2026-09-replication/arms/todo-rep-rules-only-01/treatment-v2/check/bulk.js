import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../todos.js', import.meta.url), 'utf8');
const { visibleTodos, clearCompleted, markAllComplete } = new Function(
  src + '\nreturn { visibleTodos, clearCompleted, markAllComplete };'
)();

const todos = [
  { id: 'a', completed: true, priority: 'low' },
  { id: 'b', priority: 'low' },
  { id: 'c', completed: true, priority: 'high' },
  { id: 'd', priority: 'high' },
  { id: 'e', priority: 'low' }
];
const ids = (list) => list.map((t) => t.id).join('');

assert.strictEqual(ids(visibleTodos(clearCompleted(todos), 'all')), 'dbe');
const marked = markAllComplete(todos);
assert.ok(marked.every((t) => t.completed));
assert.strictEqual(ids(marked), 'abcde');
assert.strictEqual(ids(visibleTodos(marked, 'all')), 'cdabe');
assert.strictEqual(clearCompleted(marked).length, 0);
console.log('bulk: ok');
