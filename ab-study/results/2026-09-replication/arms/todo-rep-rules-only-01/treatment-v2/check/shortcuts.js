import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
vm.runInThisContext(fs.readFileSync(new URL('../todos.js', import.meta.url), 'utf8'));

assert.strictEqual(isTypingTarget({ tagName: 'INPUT' }), true);
assert.strictEqual(isTypingTarget({ tagName: 'textarea' }), true);
assert.strictEqual(isTypingTarget({ tagName: 'SELECT' }), true);
assert.strictEqual(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
assert.strictEqual(isTypingTarget({ tagName: 'BODY' }), false);
assert.strictEqual(isTypingTarget({ tagName: 'BUTTON' }), false);
assert.strictEqual(isTypingTarget(null), false);
console.log('shortcuts: ok');
