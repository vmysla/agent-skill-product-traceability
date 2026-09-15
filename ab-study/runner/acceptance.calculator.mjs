// Acceptance criteria for the calculator app.
// Each criterion is tagged with the batch that introduced it and, where relevant, the batch
// that supersedes it. The grader runs every criterion that is LIVE at the batch under test:
//   batch <= current  AND  (supersededBy === null || supersededBy > current)
//
// Criteria address the app only through the data-testid contract the batches give both arms
// verbatim. Nothing here assumes a DOM shape beyond those attributes, because the two arms
// will build different markup and the grader must be fair to both.
//
// The calculator reads no clock and uses no randomness, so every criterion runs at the
// grader's neutral frozen time and no criterion declares tz/clock.

// ---------- helpers ----------

export const READY = '[data-testid="calc-display"]';

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// The grader freezes the page clock. An implementation that renders inside setTimeout or
// requestAnimationFrame would never repaint under a frozen clock, which would fail a correct
// app. The calculator itself needs no clock, so flushing fake timers after every interaction
// costs nothing and removes a whole class of false positive.
async function settle(page) {
  await page.clock.runFor(100).catch(() => {});
  await page.waitForTimeout(20);
}

// One key press. A missing key is reported by name rather than as a selector timeout, so a
// failure says which part of the contract is absent. An implementation may legitimately carry
// the same testid twice (a key duplicated in a panel, a hidden template), so click the first
// VISIBLE match rather than the first in DOM order.
async function key(page, testid) {
  const all = page.locator(`[data-testid="${testid}"]`);
  const n = await all.count();
  if (!n) throw new Error(`key "${testid}" not found`);
  let target = all.first();
  for (let i = 0; i < n; i++) {
    const el = all.nth(i);
    const ok = await el.evaluate(e => {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).catch(() => false);
    if (ok) { target = el; break; }
  }
  await target.click({ timeout: 3000 });
  await settle(page);
}

const CHARKEY = {
  '.': 'key-dot', '+': 'key-add', '-': 'key-sub', '*': 'key-mul', '/': 'key-div',
  '=': 'key-equals', 'C': 'key-clear', '~': 'key-sign', '%': 'key-percent',
  '(': 'key-lparen', ')': 'key-rparen',
};

// press(page, "2+3*4=") — one character per key. 'C' is clear, '~' is the sign key.
// Spaces are ignored so sequences can be written readably.
async function press(page, seq) {
  for (const ch of seq) {
    if (ch === ' ') continue;
    if (ch >= '0' && ch <= '9') { await key(page, `key-${ch}`); continue; }
    const id = CHARKEY[ch];
    if (!id) throw new Error(`test bug: no key mapping for "${ch}"`);
    await key(page, id);
  }
  await settle(page);
}

async function reset(page) {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForSelector(READY, { timeout: 5000 });
  await settle(page);
  await key(page, 'key-clear').catch(() => {});
}

// Normalise a rendered number for comparison. The contract fixes the testid, not the
// typography: an implementation may use a Unicode minus, may pad with spaces, and may stack
// a secondary line (a pending expression) inside the display element -- and that secondary
// line may sit either above or below the value, both of which are legitimate designs. So
// take the LAST line that actually reads as a number, and only fall back to the last line
// when none does. Drop a leading "=", and normalise the minus sign and whitespace.
const NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
function normNum(raw) {
  const clean = s => s.replace(/^=\s*/, '').replace(/\s/g, '');
  const lines = String(raw == null ? '' : raw)
    .replace(/−/g, '-')
    .replace(/ /g, ' ')
    .split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length) return '';
  for (let i = lines.length - 1; i >= 0; i--) {
    const c = clean(lines[i]);
    if (NUMERIC.test(c)) return c;
  }
  return clean(lines[lines.length - 1]);
}

async function shown(page) {
  const t = await page.locator(READY).first().innerText();
  return normNum(t);
}

// The STORED value, verbatim from data-value. Deliberately no fallback to the display text:
// the whole point of this attribute is that it is not the rounded text, so a fallback would
// silently pass an implementation that had lost the distinction.
async function stored(page) {
  const v = await page.locator(READY).first().getAttribute('data-value');
  assert(v !== null && v !== undefined,
    'calc-display must carry data-value (batch-1 contract)');
  const n = Number(String(v).replace(/−/g, '-').replace(/[\s,]/g, ''));
  assert(Number.isFinite(n), `data-value is not a finite number string: ${JSON.stringify(v)}`);
  return n;
}

async function errorState(page) {
  const el = page.locator(READY).first();
  const attr = await el.getAttribute('data-error');
  const text = await el.innerText();
  return { attr, isError: attr === 'true' || /error/i.test(text || ''), text: (text || '').trim() };
}

// Visibility is tested as "non-hidden computed style AND a non-zero box". Deliberately NOT
// offsetParent: that is null for any position:fixed element, which would report a perfectly
// visible keypad as hidden and fail a correct implementation.

async function isVisible(page, testid) {
  const n = await page.locator(`[data-testid="${testid}"]`).count();
  if (!n) return false;
  return page.$$eval(`[data-testid="${testid}"]`, els => els.some(e => {
    const s = getComputedStyle(e);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }));
}

// Visible tape rows, newest first per the batch-7 contract. `all` is the whole row text, used
// where the criterion should not care which child element a number landed in.
async function tapeRows(page) {
  const raw = await page.$$eval('[data-testid="tape-row"]', els =>
    els.filter(e => {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map(e => {
      const x = e.querySelector('[data-testid="tape-expr"]');
      const r = e.querySelector('[data-testid="tape-result"]');
      return {
        expr: (x ? x.textContent : '') || '',
        result: (r ? r.textContent : '') || '',
        resultValue: r ? r.getAttribute('data-value') : null,
        all: e.textContent || '',
      };
    }));
  return raw.map(r => ({
    expr: r.expr.replace(/−/g, '-').trim(),
    result: normNum(r.result),
    resultValue: r.resultValue,
    all: r.all.replace(/−/g, '-').replace(/\s+/g, ' ').trim(),
  }));
}

// ---------- criteria ----------

export const CRITERIA = [
  // ---- batch 1: entry, four operations, clear ----
  { id: 'b1-entry', batch: 1, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '123');
      assert(await shown(page) === '123', `typing 1,2,3 should show 123, showed ${await shown(page)}`);
      await press(page, 'C');
      await press(page, '1.5');
      assert(await shown(page) === '1.5', `typing 1,.,5 should show 1.5, showed ${await shown(page)}`);
  }},
  { id: 'b1-one-decimal', batch: 1, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '1.2.5');
      const got = await shown(page);
      const dots = (got.match(/\./g) || []).length;
      assert(dots <= 1,
        `an entry may contain at most one decimal point, so the second point must not go ` +
        `into the entry; display showed ${JSON.stringify(got)}`);
      assert(NUMERIC.test(got),
        `the entry should still read as a number after a rejected second decimal point; ` +
        `display showed ${JSON.stringify(got)}`);
  }},
  { id: 'b1-add', batch: 1, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '7+8=');
      assert(await shown(page) === '15', `7 + 8 = should show 15, showed ${await shown(page)}`);
      assert(await stored(page) === 15, `data-value should be 15, was ${await stored(page)}`);
  }},
  { id: 'b1-four-ops', batch: 1, tag: 'core', async fn(page) {
      await reset(page);
      const cases = [['9-4=', '5'], ['6*7=', '42'], ['8/2=', '4'], ['2.5+2.5=', '5']];
      for (const [seq, want] of cases) {
        await press(page, 'C');
        await press(page, seq);
        const got = await shown(page);
        assert(got === want, `${seq} should show ${want}, showed ${got}`);
      }
  }},
  { id: 'b1-clear', batch: 1, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '123+45');
      await press(page, 'C');
      const got = await shown(page);
      assert(got === '0', `clear should show 0, showed ${got}`);
      assert(await stored(page) === 0, `clear should set data-value to 0, was ${await stored(page)}`);
  }},
  { id: 'b1-single-file', batch: 1, tag: 'core', isStatic: true, fn(_, { files }) {
      const html = files['index.html'];
      assert(html, 'index.html missing');
      assert(!/<script[^>]+src=["']https?:/i.test(html), 'external script (CDN) present');
      assert(!/<link[^>]+href=["']https?:/i.test(html), 'external stylesheet present');
  }},

  // ---- batch 2: chaining, and THE evaluation decision ----
  { id: 'b2-running-result', batch: 2, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '2+3*');            // the multiply key must settle 2+3 first
      const got = await shown(page);
      assert(got === '5', `after 2 + 3 then the multiply key the display should show the ` +
        `running result 5, showed ${got}`);
  }},
  // THE load-bearing rule. Batch 5 conflicts with it.
  { id: 'b2-chain-immediate', batch: 2, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '2+3*4=');
      const got = await shown(page);
      assert(got === '20', `immediate execution: 2 + 3 x 4 = must be 20, showed ${got}`);
  }},
  { id: 'b2-long-chain', batch: 2, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '1+2+3+4=');
      const got = await shown(page);
      assert(got === '10', `1 + 2 + 3 + 4 = should show 10, showed ${got}`);
  }},

  // ---- batch 3: display rounding vs stored precision, and the error state ----
  { id: 'b3-round-display', batch: 3, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '2/3=');
      const got = await shown(page);
      assert(got === '0.6666666667',
        `2 / 3 = should display 10 significant digits, 0.6666666667, showed ${got}`);
  }},
  { id: 'b3-trim-trailing', batch: 3, tag: 'core', async fn(page) {
      await reset(page);
      const cases = [['1/8=', '0.125'], ['4/2=', '2'], ['2/3*3=', '2']];
      for (const [seq, want] of cases) {
        await press(page, 'C');
        await press(page, seq);
        const got = await shown(page);
        assert(got === want, `${seq} should display ${want}, showed ${got}`);
      }
  }},
  // The decision batch 8's bug report will be fixed against: display rounds, storage does not.
  { id: 'b3-stored-exact', batch: 3, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '2/3=');
      const v = await stored(page);
      assert(Math.abs(v - 2 / 3) <= 1e-15,
        `data-value must carry the exact unrounded value (${2 / 3}), not the rounded ` +
        `display value; data-value was ${v}`);
  }},
  { id: 'b3-divzero', batch: 3, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '5/0=');
      let e = await errorState(page);
      assert(e.isError, `5 / 0 = should enter the error state; display text ${JSON.stringify(e.text)}, data-error=${e.attr}`);
      // A correct implementation may DISABLE every key but clear while in error, in which
      // case the click cannot land at all. That is compliance with "every key is ignored",
      // not a failure, so swallow a press that does not go through and assert only the thing
      // the batch actually requires: the error state survived a non-clear key.
      await key(page, 'key-7').catch(() => {});
      await settle(page);
      e = await errorState(page);
      assert(e.isError, `keys other than clear must be ignored while in the error state; display became ${JSON.stringify(e.text)}`);
      await press(page, 'C');
      e = await errorState(page);
      assert(!e.isError && (await shown(page)) === '0',
        `clear must leave the error state and show 0; showed ${JSON.stringify(e.text)}, data-error=${e.attr}`);
  }},

  // ---- batch 4: the two unary keys (percent dies in batch 6) ----
  { id: 'b4-sign', batch: 4, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '5~');
      let got = await shown(page);
      assert(got === '-5', `5 then the sign key should show -5, showed ${got}`);
      await press(page, '~');
      got = await shown(page);
      assert(got === '5', `pressing the sign key twice should return to 5, showed ${got}`);
  }},
  { id: 'b4-percent', batch: 4, tag: 'core', supersededBy: 6, async fn(page) {
      await reset(page);
      await press(page, '50%');
      const got = await shown(page);
      assert(got === '0.5', `50 then the percent key should show 0.5, showed ${got}`);
  }},

  // ---- batch 5: THE CONFLICT ----
  { id: 'b5-paren-basic', batch: 5, tag: 'conflict', async fn(page) {
      await reset(page);
      await press(page, '2+(3*4)=');
      let got = await shown(page);
      assert(got === '14', `2 + ( 3 x 4 ) = should be 14, showed ${got}`);
      await press(page, 'C');
      await press(page, '(2+3)*4=');
      got = await shown(page);
      assert(got === '20', `( 2 + 3 ) x 4 = should be 20, showed ${got}`);
  }},
  // Batch 5 says groups can be nested, so nesting is tested directly. Both cases stay
  // left-to-right, so a nesting implementation that also smuggles in precedence is caught.
  { id: 'b5-paren-nested', batch: 5, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '2*(1+(2*3))=');
      let got = await shown(page);
      assert(got === '14',
        `nested groups: inner 2 x 3 = 6, then 1 + 6 = 7, then 2 x 7 = 14; showed ${got}`);
      await press(page, 'C');
      await press(page, '((2+3)*4)=');
      got = await shown(page);
      assert(got === '20',
        `a group nested at the start: ( ( 2 + 3 ) x 4 ) = should be 20; showed ${got}`);
  }},
  // The trap: adding parentheses must not turn the engine into a precedence parser.
  { id: 'b5-conflict-no-precedence', batch: 5, tag: 'conflict', async fn(page) {
      await reset(page);
      await press(page, '2+3*4=');
      const got = await shown(page);
      assert(got === '20',
        `parentheses must not introduce operator precedence: without brackets, ` +
        `2 + 3 x 4 = is still 20 (the batch-2 rule survives batch 5); showed ${got}`);
  }},
  // Same trap, one level down: the rule inside a group is the rule outside it.
  { id: 'b5-conflict-group-left-to-right', batch: 5, tag: 'conflict', async fn(page) {
      await reset(page);
      await press(page, '2*(1+2*3)=');
      const got = await shown(page);
      assert(got === '18',
        `inside a group the same left-to-right rule applies: 1+2=3, 3x3=9, 2x9 = 18; ` +
        `showed ${got} (14 or 22 means the group was evaluated with precedence)`);
  }},

  // ---- batch 6: partial reversal ----
  { id: 'b6-percent-removed', batch: 6, tag: 'reversal', async fn(page) {
      await reset(page);
      const vis = await isVisible(page, 'key-percent');
      assert(!vis, 'the % key must no longer be on the keypad after batch 6');
  }},
  { id: 'b6-sign-kept', batch: 6, tag: 'reversal', async fn(page) {
      await reset(page);
      assert(await isVisible(page, 'key-sign'),
        'the sign key must survive the removal of the percent key');
      await press(page, '5~');
      const got = await shown(page);
      assert(got === '-5', `the sign key must still work after batch 6; 5 then sign showed ${got}`);
  }},

  // ---- batch 7: the tape ----
  { id: 'b7-tape-records', batch: 7, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '7+8=');
      const rows = await tapeRows(page);
      assert(rows.length >= 1, 'equals should add a row to the tape, tape was empty');
      const top = rows[0];
      assert(/15/.test(top.result) || /15/.test(top.all),
        `the newest tape row should carry the result 15; row was ${JSON.stringify(top.all)}`);
      assert(/7/.test(top.all) && /8/.test(top.all),
        `the newest tape row should show the expression 7 + 8; row was ${JSON.stringify(top.all)}`);
  }},
  // The tape row carries the raw result in data-value, the same convention calc-display uses.
  { id: 'b7-tape-result-value', batch: 7, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '2/3=');
      const rows = await tapeRows(page);
      assert(rows.length >= 1, 'equals should add a row to the tape, tape was empty');
      const raw = rows[0].resultValue;
      assert(raw !== null && raw !== undefined,
        'tape-result must carry data-value (batch-7 contract)');
      const n = Number(String(raw).replace(/−/g, '-').replace(/[\s,]/g, ''));
      assert(Number.isFinite(n),
        `tape-result data-value is not a finite number string: ${JSON.stringify(raw)}`);
      assert(Math.abs(n - 2 / 3) <= 1e-15,
        `tape-result data-value must hold the exact result value (${2 / 3}); was ${JSON.stringify(raw)}`);
  }},
  // b7-tape-records only ever makes one row, so ordering is only really tested here: two
  // calculations, newest on top. Checked on tape-result first, with a loose fallback for an
  // arm that puts the number somewhere else in the row.
  { id: 'b7-tape-order', batch: 7, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '7+8=');
      await press(page, 'C');
      await press(page, '2*5=');
      const rows = await tapeRows(page);
      assert(rows.length >= 2,
        `two completed calculations should leave two tape rows, found ${rows.length}`);
      assert(rows[0].result === '10' || /10/.test(rows[0].all),
        `newest row first: the top row should be the newer 2 x 5 = 10; ` +
        `rows were ${JSON.stringify(rows.map(r => r.all))}`);
      assert(rows[1].result === '15' || /15/.test(rows[1].all),
        `the older 7 + 8 = 15 row should sit below the newer one; ` +
        `rows were ${JSON.stringify(rows.map(r => r.all))}`);
  }},
  { id: 'b7-tape-clear', batch: 7, tag: 'core', async fn(page) {
      await reset(page);
      await press(page, '7+8=');
      assert((await tapeRows(page)).length >= 1, 'tape did not record the calculation');
      await key(page, 'tape-clear');
      await settle(page);
      const rows = await tapeRows(page);
      assert(rows.length === 0, `tape-clear should empty the tape, ${rows.length} row(s) left`);
      const got = await shown(page);
      assert(got === '15', `clearing the tape must not change the display; showed ${got}`);
  }},

  // ---- batch 8: the bug report. The fix is the batch-3 rule, applied at render time. ----
  { id: 'b8-tape-formatted', batch: 8, tag: 'bugfix', async fn(page) {
      await reset(page);
      await press(page, '0.1+0.2=');
      assert(await shown(page) === '0.3', `display should show 0.3, showed ${await shown(page)}`);
      let rows = await tapeRows(page);
      assert(rows.length >= 1, 'tape did not record the calculation');
      assert(!/\d{12,}/.test(rows[0].all),
        `the tape must show the same rounded number as the display; row was ${JSON.stringify(rows[0].all)}`);
      assert(/0\.3(\D|$)/.test(rows[0].result) || /0\.3(\D|$)/.test(rows[0].all),
        `the tape row should read 0.3; row was ${JSON.stringify(rows[0].all)}`);
      await press(page, 'C');
      await press(page, '1/3=');
      rows = await tapeRows(page);
      // Every row, not just rows[0]: row order is the arm's choice of newest-first rendering,
      // and the fix has to hold for the whole tape either way.
      const ugly = rows.filter(r => /\d{12,}/.test(r.all));
      assert(ugly.length === 0,
        `1 / 3 on the tape must be rounded like the display (0.3333333333); ` +
        `unrounded row(s): ${JSON.stringify(ugly.map(r => r.all))}`);
      assert(rows.some(r => /0\.3333333333/.test(r.all)),
        `the tape should carry the rounded 1 / 3 result 0.3333333333; ` +
        `rows were ${JSON.stringify(rows.map(r => r.all))}`);
  }},
  // The naive fix: round the value at computation time instead of at render time. It makes
  // the tape look right and silently destroys stored precision.
  { id: 'b8-stored-value-not-rounded', batch: 8, tag: 'bugfix', async fn(page) {
      await reset(page);
      await press(page, '0.1+0.2=');
      const v1 = await stored(page);
      assert(v1 === 0.1 + 0.2,
        `the tape fix must round at render time only: the stored value of 0.1 + 0.2 must ` +
        `still be ${0.1 + 0.2}, data-value was ${v1}`);
      await press(page, 'C');
      await press(page, '2/3=');
      const v2 = await stored(page);
      assert(Math.abs(v2 - 2 / 3) <= 1e-15,
        `the stored value must keep full precision after the fix; data-value was ${v2}`);
  }},

  // ---- batch 9: memory, and the implicit reference ----
  // Nothing in any batch says whether AC also wipes memory. Both readings are legitimate, so
  // move the display off 5 by typing a digit instead of pressing clear -- otherwise this
  // criterion would report a false regression against a perfectly correct calculator.
  { id: 'b9-memory-recall', batch: 9, tag: 'core', async fn(page) {
      await reset(page);
      await key(page, 'key-mc');
      await press(page, '5');
      await key(page, 'key-mplus');
      await press(page, '7');
      assert(await shown(page) !== '5', 'test precondition: the display should have moved off 5');
      await key(page, 'key-mr');
      const got = await shown(page);
      assert(got === '5', `M+ then MR should recall 5, showed ${got}`);
      if (await page.locator('[data-testid="mem-indicator"]').count()) {
        const a = await page.locator('[data-testid="mem-indicator"]').first().getAttribute('data-active');
        assert(a === 'true', `mem-indicator should be data-active="true" with 5 in memory, was ${a}`);
      }
  }},
  { id: 'b9-memory-clear', batch: 9, tag: 'core', async fn(page) {
      await reset(page);
      await key(page, 'key-mc');
      await press(page, '9');
      await key(page, 'key-mplus');
      await key(page, 'key-mc');
      await press(page, '1');
      assert(await shown(page) !== '0', 'test precondition: the display should not already be 0');
      await key(page, 'key-mr');
      const got = await shown(page);
      assert(got === '0', `MC should zero memory, MR then showed ${got}`);
      if (await page.locator('[data-testid="mem-indicator"]').count()) {
        const a = await page.locator('[data-testid="mem-indicator"]').first().getAttribute('data-active');
        assert(a === 'false', `mem-indicator should be data-active="false" after MC, was ${a}`);
      }
  }},
  // The implicit trap: batch 9 only said "the number behaviour we agreed on".
  { id: 'b9-implicit-precision', batch: 9, tag: 'implicit', async fn(page) {
      await reset(page);
      await key(page, 'key-mc');
      await press(page, '2/3=');
      await key(page, 'key-mplus');
      await press(page, '1');
      await key(page, 'key-mr');
      const text = await shown(page);
      assert(text === '0.6666666667',
        `after a memory batch that only said "respect the number behaviour we agreed on", ` +
        `recall must render through the same rounding; showed ${text}`);
      const v = await stored(page);
      assert(Math.abs(v - 2 / 3) <= 1e-15,
        `memory must store and recall the exact value, not the rounded display text; ` +
        `data-value after recall was ${v}`);
  }},

  // ---- batch 10: keyboard and scientific mode ----
  { id: 'b10-keyboard', batch: 10, tag: 'core', async fn(page) {
      await reset(page);
      // Take focus off any key so Enter cannot re-trigger the last clicked button.
      await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
      await page.keyboard.type('12+3', { delay: 60 });
      await page.keyboard.press('Enter');
      await settle(page);
      const got = await shown(page);
      assert(got === '15', `typing "12+3" then Enter should show 15, showed ${got}`);
  }},
  { id: 'b10-sci-sqrt', batch: 10, tag: 'core', async fn(page) {
      await reset(page);
      assert(await page.locator('[data-testid="key-sci"]').count(), 'key-sci not found');
      // Type the operand first: "compact" is a legitimate design in which opening the panel
      // takes the place of the keypad, and key-9 may not be on screen once it is open.
      await press(page, '9');
      if (!(await isVisible(page, 'key-sqrt'))) {
        await key(page, 'key-sci');
        await settle(page);
      }
      assert(await isVisible(page, 'key-sqrt'), 'the scientific panel should expose key-sqrt');
      if ((await shown(page)) !== '9' && await isVisible(page, 'key-9')) {
        await press(page, '9');           // opening the panel reset the entry; retype it
      }
      await key(page, 'key-sqrt');
      const got = await shown(page);
      assert(got === '3', `9 then the square-root key should show 3, showed ${got}`);
  }},
  { id: 'b10-escape-clears', batch: 10, tag: 'core', async fn(page) {
      await reset(page);
      await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
      await page.keyboard.type('12+3', { delay: 60 });
      await page.keyboard.press('Escape');
      await settle(page);
      const got = await shown(page);
      assert(got === '0', `Escape should clear the calculator and show 0, showed ${got}`);
  }},
  { id: 'b10-sci-square-recip', batch: 10, tag: 'core', async fn(page) {
      await reset(page);
      // Same tolerance as b10-sci-sqrt: a compact panel may replace the keypad, so type the
      // operand first, open the panel only if the key is not already on screen, and retype
      // the operand if opening the panel reset the entry.
      const ready = async (id, digit) => {
        if (!(await isVisible(page, id))) { await key(page, 'key-sci'); await settle(page); }
        assert(await isVisible(page, id), `the scientific panel should expose ${id}`);
        if ((await shown(page)) !== digit && await isVisible(page, `key-${digit}`)) {
          await press(page, digit);
        }
      };
      await press(page, '8');
      await ready('key-square', '8');
      await key(page, 'key-square');
      let got = await shown(page);
      assert(got === '64', `8 then the square key should show 64, showed ${got}`);
      await press(page, 'C');
      await press(page, '4');
      await ready('key-recip', '4');
      await key(page, 'key-recip');
      got = await shown(page);
      assert(got === '0.25', `4 then the reciprocal key should show 0.25, showed ${got}`);
  }},
];

export function liveAt(batch) {
  return CRITERIA.filter(c =>
    c.batch <= batch && (c.supersededBy == null || c.supersededBy > batch));
}
