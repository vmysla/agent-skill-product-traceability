var fs = require('fs'), vm = require('vm'), assert = require('assert');
var html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
var ctx = {};
vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1], ctx);
function run(keys) { return ctx.displayText(keys.split(' ').reduce(ctx.press, ctx.initialState())); }
function row(keys) {
  var s = ctx.initialState(), t = ctx.initialExpr(), out = null;
  keys.split(' ').forEach(function (k) {
    var n = ctx.press(s, k), r = ctx.trackExpr(t, s, k, n);
    if (r.row) out = r.row.expr + ' = ' + r.row.value;
    s = n; t = r.expr;
  });
  return out;
}
assert.strictEqual(run('9 sqrt'), '3');
assert.strictEqual(run('4 square'), '16');
assert.strictEqual(run('4 recip'), '0.25');
assert.strictEqual(run('9 sqrt 5'), '5');
assert.strictEqual(run('2 add 9 sqrt equals'), '5');
assert.strictEqual(run('3 add 1 equals square'), '16');
assert.strictEqual(run('0 recip'), 'Error');
assert.strictEqual(run('4 sign sqrt'), 'Error');
assert.strictEqual(row('2 add 9 sqrt equals'), '2 + √9 = 5');
assert.strictEqual(row('2 sign square equals'), '(-2)² = 4');
console.log('ok');
