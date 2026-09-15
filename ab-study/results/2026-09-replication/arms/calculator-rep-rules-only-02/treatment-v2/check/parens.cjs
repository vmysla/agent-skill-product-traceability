var fs = require('fs'), vm = require('vm'), assert = require('assert');
var html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
var ctx = {};
vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1], ctx);
function run(keys) { return keys.split(' ').reduce(ctx.press, ctx.initialState()); }
assert.strictEqual(run('2 add lparen 3 mul 4 rparen equals').value, 14);
assert.strictEqual(run('lparen 2 add 3 rparen mul 4 equals').value, 20);
assert.strictEqual(run('2 mul lparen 1 add lparen 2 add 3 rparen mul 2 rparen equals').value, 24);
assert.strictEqual(run('2 add lparen 3 mul 4 rparen mul 5 equals').value, 70);
assert.strictEqual(run('2 mul lparen 3 add 4 equals').value, 14);
assert.strictEqual(run('rparen 5 add 1 equals').value, 6);
assert.strictEqual(run('1 add 2 equals').value, 3);
console.log('ok');
