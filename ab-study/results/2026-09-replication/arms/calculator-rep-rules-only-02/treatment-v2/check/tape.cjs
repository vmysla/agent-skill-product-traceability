var fs = require('fs'), vm = require('vm'), assert = require('assert');
var html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
var ctx = {};
vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1], ctx);
// Returns the tape rows, newest first, produced by a key sequence.
function rows(keys) {
  var s = ctx.initialState(), t = ctx.initialExpr(), out = [];
  keys.split(' ').forEach(function (k) {
    var n = ctx.press(s, k), r = ctx.trackExpr(t, s, k, n);
    if (r.row) out.unshift(r.row.expr + ' = ' + r.row.value);
    s = n; t = r.expr;
  });
  return out;
}
assert.deepStrictEqual(rows('1 add 2 equals'), ['1 + 2 = 3']);
assert.deepStrictEqual(rows('2 add sub 3 equals mul 4 equals'), ['-1 × 4 = -4', '2 − 3 = -1']);
assert.deepStrictEqual(rows('2 mul lparen 3 add 4 equals'), ['2 × (3 + 4) = 14']);
assert.deepStrictEqual(rows('lparen 2 add 3 rparen sign mul 2 equals'), ['-(2 + 3) × 2 = -10']);
assert.deepStrictEqual(rows('5 equals 1 div 0 equals'), []);
assert.deepStrictEqual(rows('0.1 add 0.2 equals').length, 1);
assert.strictEqual(rows('1 dot add 2 equals')[0], '1 + 2 = 3');
console.log('ok');
