import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../todos.js', import.meta.url), 'utf8');
const visibleTodos = new Function(src + '\nreturn visibleTodos;')();

const todos = [
  { id: 'a', completed: true },
  { id: 'b', completed: false },
  { id: 'c' },
  { id: 'd', completed: true }
];
const ids = (list) => list.map((t) => t.id).join('');

assert.strictEqual(ids(visibleTodos(todos, 'all')), 'bcad');
assert.strictEqual(ids(visibleTodos(todos, 'active')), 'bc');
assert.strictEqual(ids(visibleTodos(todos, 'completed')), 'ad');
console.log('order: ok');
