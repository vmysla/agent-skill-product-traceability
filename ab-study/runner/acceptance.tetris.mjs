// Acceptance criteria for the tetris app.
// Each criterion is tagged with the batch that introduced it and, where relevant, the batch
// that supersedes it. The grader runs every criterion that is LIVE at the batch under test:
//   batch <= current  AND  (supersededBy === null || supersededBy > current)
//
// Criteria address the app only through the contract batch 1 gives both arms verbatim: the
// data-testid attributes and the window.__tetris control surface. Nothing here assumes a DOM
// shape beyond those attributes, because the two arms will build different markup and the
// grader must be fair to both.
//
// DETERMINISM. The grader freezes the clock, so the app's real gravity timer never fires
// during a test. Every criterion drives the game with __tetris.tick() and __tetris.input(),
// and every piece sequence is supplied with __tetris.newGame([...]). Nothing here waits on
// real time or on a random generator.

export const READY = '[data-testid="board"]';

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ---------- control-surface plumbing ----------

// One page-side preamble, shared by every inline snippet below. Written defensively: an arm
// may legitimately return the board as arrays of cells instead of strings, or cells as
// {row,col} objects instead of pairs, and a criterion must not fail a correct implementation
// over that.
const HELPERS = `
const T = window.__tetris;
if (!T) throw new Error('window.__tetris is missing');
const rowStr = r => Array.isArray(r)
  ? r.map(c => (c == null || c === 0 || c === '' || c === false ? '.' : String(c)[0])).join('')
  : String(r);
const bstr = () => T.getBoard().map(rowStr);
const isEmpty = () => bstr().every(r => /^\\.*$/.test(r));
const cellsOf = () => {
  const s = T.getState();
  const cs = (s && s.current && s.current.cells) || [];
  return cs.map(c => Array.isArray(c) ? [Number(c[0]), Number(c[1])] : [Number(c.row), Number(c.col)]);
};
const maxRow = () => Math.max.apply(null, cellsOf().map(p => p[0]));
`;

const run = (page, body) => page.evaluate(`(() => { ${HELPERS}\n${body} })()`);

async function api(page, method, ...args) {
  return page.evaluate(([m, a]) => {
    const t = window.__tetris;
    if (!t) throw new Error('window.__tetris is missing');
    if (typeof t[m] !== 'function') throw new Error('window.__tetris.' + m + ' is missing');
    return t[m](...a);
  }, [method, args]);
}

async function reset(page, queue) {
  if (queue) await api(page, 'newGame', queue);
  else await api(page, 'newGame');
}

async function state(page) {
  const s = await api(page, 'getState');
  assert(s && typeof s === 'object', 'getState() must return an object');
  return s;
}

function normCells(cs) {
  if (!Array.isArray(cs)) return [];
  return cs
    .map(c => Array.isArray(c) ? [Number(c[0]), Number(c[1])] : [Number(c.row), Number(c.col)])
    .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
}

async function cells(page) {
  const s = await state(page);
  assert(s.current, 'getState().current must describe the falling piece');
  const cs = normCells(s.current.cells);
  assert(cs.length === 4, `current.cells must list the four cells of the piece, got ${JSON.stringify(s.current.cells)}`);
  return cs;
}

async function board(page) {
  const b = await run(page, 'return bstr();');
  assert(Array.isArray(b) && b.length === 20, `getBoard() must return 20 rows, got ${JSON.stringify(b).slice(0, 140)}`);
  assert(b.every(r => r.length === 10), `every getBoard() row must be 10 cells wide, got ${JSON.stringify(b).slice(0, 140)}`);
  return b;
}

function filledOf(b) {
  const out = [];
  b.forEach((row, r) => { for (let c = 0; c < 10; c++) if (row[c] !== '.') out.push([r, c]); });
  return out;
}
const boardEmpty = b => filledOf(b).length === 0;
const key = ps => ps.map(p => p[0] + ',' + p[1]).sort().join(' ');
const rowsOf = ps => ps.map(p => p[0]);
const colsOf = ps => ps.map(p => p[1]);
const tick = (page, n = 1) => api(page, 'tick', n);

// Advance one gravity step at a time until the locked board changes (a piece locked, and any
// full rows went with it). Returns the number of ticks, or -1 if nothing ever settled.
const settle = (page, max = 55) => run(page, `
  const before = bstr().join('|');
  for (let i = 0; i < ${max}; i++) { T.tick(1); if (bstr().join('|') !== before) return i + 1; }
  return -1;
`);

// Tick until the falling piece stops descending, i.e. it is resting on the stack and has just
// spent its first tick of lock delay. Reports whether it locked instead, which is itself a
// failure for the lock-delay criteria.
const toRest = (page, max = 55) => run(page, `
  let prev = maxRow();
  for (let i = 0; i < ${max}; i++) {
    T.tick(1);
    if (!isEmpty()) return { locked: true, ticks: i + 1 };
    const m = maxRow();
    if (m === prev) return { locked: false, ticks: i + 1 };
    prev = m;
  }
  return { locked: false, ticks: -1 };
`);

// ---------- board fixtures ----------

const EMPTY_ROW = '..........';
const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
const rowFilled = cols => { let s = ''; for (let c = 0; c < 10; c++) s += cols.includes(c) ? 'J' : '.'; return s; };
function makeBoard(spec) {
  const rows = Array.from({ length: 20 }, () => EMPTY_ROW);
  for (const k of Object.keys(spec)) rows[Number(k)] = spec[k];
  return rows;
}
// An O dropped into columns 0-1 completes row 19 only.
const SINGLE = () => makeBoard({ 19: rowFilled(range(2, 9)), 18: rowFilled(range(2, 8)) });
// An O dropped into columns 0-1 completes rows 18 and 19.
const DOUBLE_O = () => makeBoard({ 19: rowFilled(range(2, 9)), 18: rowFilled(range(2, 9)) });
// An upright I dropped into column 0 completes rows 17-19 but not row 16.
const TRIPLE = () => makeBoard({
  19: rowFilled(range(1, 9)), 18: rowFilled(range(1, 9)),
  17: rowFilled(range(1, 9)), 16: rowFilled(range(1, 8)),
});
// An upright I dropped into column 0 completes rows 16-19.
const QUAD = () => makeBoard({
  19: rowFilled(range(1, 9)), 18: rowFilled(range(1, 9)),
  17: rowFilled(range(1, 9)), 16: rowFilled(range(1, 9)),
});
// An upright I dropped into column 0 completes rows 18 and 19 only.
const DOUBLE_I = () => makeBoard({
  19: rowFilled(range(1, 9)), 18: rowFilled(range(1, 9)),
  17: rowFilled(range(1, 8)), 16: rowFilled(range(1, 8)),
});

// Shove the falling piece into the left wall and let gravity settle it.
async function dropLeft(page) {
  await run(page, `for (let i = 0; i < 12; i++) T.input('left');`);
  const t = await settle(page);
  assert(t > 0, 'the falling piece never locked within 55 gravity steps');
}

// Stand the I piece up, shove it into the left wall, let gravity settle it.
//
// Batch 2 only requires a rotation to be tried with a sideways shift, and to be refused
// outright if nothing fits. An I piece spawned flat on the very top row therefore has a
// legitimate reason to refuse to stand up: the upright shape would stick out above the
// board. So this alternates rotating with a single gravity step, which gives the piece the
// headroom it needs without assuming any particular kick table. A gravity step scores
// nothing, so the callers that measure a score delta are unaffected.
async function dropUprightILeft(page) {
  const info = await run(page, `
    const before = bstr().join('|');
    const upright = () => new Set(cellsOf().map(p => p[1])).size === 1;
    for (let k = 0; k < 8 && !upright(); k++) {
      T.input('rotateCW');
      if (upright()) break;
      T.tick(1);
      if (bstr().join('|') !== before) return { locked: true };
    }
    for (let i = 0; i < 12; i++) T.input('left');
    const cs = cellsOf();
    return { locked: false, cols: Array.from(new Set(cs.map(p => p[1]))), rows: new Set(cs.map(p => p[0])).size };
  `);
  assert(!info.locked, 'the I piece locked before it could be stood upright');
  assert(info.cols.length === 1 && info.rows === 4,
    `the I piece should stand upright in one column after rotating; columns ${JSON.stringify(info.cols)}`);
  assert(info.cols[0] === 0, `the I piece should end up against the left wall, column was ${info.cols[0]}`);
  const t = await settle(page);
  assert(t > 0, 'the falling piece never locked within 55 gravity steps');
}

// Colour signature of the first preview slot: the SET of colours used anywhere inside it.
// Deliberately order-independent — comparing the sequence of cells would make two differently
// shaped but identically coloured previews look different, and pass a preview with no colour
// coding at all.
//
// Reading computed styles is only fair because batch 1's test contract, given verbatim to both
// arms, requires every piece the game draws to be DOM elements coloured with CSS: a preview
// painted on a <canvas> or supplied as an image would have the same computed styles for every
// piece and could not be read by any grader that works through the DOM.
async function previewSignature(page, letter) {
  await reset(page, ['T', letter, 'T', 'T', 'T', 'T', 'T']);
  return page.evaluate(() => {
    const it = document.querySelector('[data-testid="next-piece-item"]');
    if (!it) return null;
    const seen = new Set();
    // Every property a colour can legitimately arrive through: a CSS background, a text
    // colour, a border, an outline, a gradient, or an inline SVG fill/stroke. Reading more
    // properties can only find a colour difference that is really there — two previews with
    // no colour coding produce identical computed styles whichever properties are read.
    const PROPS = ['backgroundColor', 'backgroundImage', 'color', 'borderTopColor',
                   'borderRightColor', 'borderBottomColor', 'borderLeftColor',
                   'outlineColor', 'boxShadow', 'fill', 'stroke'];
    for (const e of [it, ...it.querySelectorAll('*')]) {
      const s = getComputedStyle(e);
      for (const p of PROPS) seen.add(p + ':' + s[p]);
    }
    return [...seen].sort().join('|');
  });
}

async function visiblePreviewItems(page) {
  return page.$$eval('[data-testid="next-piece-item"]', els =>
    els.filter(e => {
      // Rect-based rather than offsetParent-based: offsetParent is also null for a
      // position:fixed element, and a panel pinned to the side of the window is a
      // legitimate layout, not a hidden preview. An item hidden by any means — its own
      // display/visibility/opacity, or a hidden ancestor — still measures 0 x 0.
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map(e => e.getAttribute('data-piece')));
}

// setLevel keeps the scoring fixtures short, but it is a batch-7 requirement of its own and
// b7-speed-curve is where its absence is judged. The scoring table is a multiplier at every
// level, so these checks fall back to whatever level the game is actually on rather than
// reporting a scoring regression for a missing test hook.
async function levelFor(page, want) {
  try { await api(page, 'setLevel', want); } catch (e) { /* judged by b7-speed-curve */ }
  const lvl = (await state(page)).level;
  assert(Number.isFinite(lvl) && lvl >= 1, `getState().level must be a number, got ${lvl}`);
  return lvl;
}

// Pause or resume by whichever route the app honours. That input('pause') toggles is a
// batch-9 requirement and b9-pause checks it head on; the implicit trap is about whether the
// lock-delay counter survives a pause, so it must not also fail an app whose only working
// resume is the button. One requirement, one criterion.
async function pauseToggle(page) {
  const before = (await state(page)).status;
  await api(page, 'input', 'pause');
  if ((await state(page)).status !== before) return;
  await page.click('[data-testid="pause-btn"]').catch(() => {});
  await page.waitForTimeout(40);
}

// Press a letter key in both cases. A batch that says "P pauses" does not say which case
// the handler must compare against, and e.key carries the literal character pressed, so a
// correct app may listen for 'p', for 'P', or for both. Returns true as soon as `want` holds.
async function pressLetter(page, letter, want) {
  for (const k of [letter.toLowerCase(), letter.toUpperCase()]) {
    await page.keyboard.press(k);
    await page.waitForTimeout(120);
    if (want(await state(page))) return true;
  }
  return false;
}

const OS = n => Array.from({ length: n }, () => 'O');
const IS = n => Array.from({ length: n }, () => 'I');

// ---------- criteria ----------

export const CRITERIA = [
  // ---- batch 1: board, gravity, locking, the control surface ----
  { id: 'b1-single-file', batch: 1, tag: 'core', isStatic: true, fn(_, { files }) {
      const html = files['index.html'];
      assert(html, 'index.html missing');
      assert(!/<script[^>]+src=["']https?:/i.test(html), 'external script (CDN) present');
      assert(!/<link[^>]+href=["']https?:/i.test(html), 'external stylesheet present');
  }},

  { id: 'b1-initial-state', batch: 1, tag: 'core', async fn(page) {
      await reset(page, ['O', 'I', 'T', 'S', 'Z', 'J', 'L']);
      const b = await board(page);
      assert(boardEmpty(b), `a new game must start with an empty board, got ${JSON.stringify(b)}`);
      const s = await state(page);
      assert(s.current && s.current.type === 'O',
        `newGame(queue) must make the first queued piece the falling one; current.type=${s.current && s.current.type}`);
      // Batch 1 asks only for "the upcoming pieces, soonest first" — it does not say how many
      // are exposed. So check the order against the queue over however many are given, rather
      // than demanding a particular length. (The count is a batch-4 requirement, judged there.)
      assert(Array.isArray(s.next) && s.next.length >= 1,
        `next must list the upcoming pieces, got ${JSON.stringify(s.next)}`);
      const wantNext = ['I', 'T', 'S', 'Z', 'J', 'L'];
      const gotNext = s.next.slice(0, wantNext.length);
      assert(gotNext.join(',') === wantNext.slice(0, gotNext.length).join(','),
        `next must follow the queue, soonest first (I,T,S,Z,J,L...); got ${JSON.stringify(s.next)}`);
      assert(s.score === 0 && s.lines === 0 && s.level === 1,
        `a new game starts at score 0, lines 0, level 1; got ${s.score}/${s.lines}/${s.level}`);
      assert(normCells(s.current.cells).length === 4,
        `current.cells must list the four cells of the falling piece, got ${JSON.stringify(s.current.cells)}`);

      // Same queue, same ticks, same board — twice.
      const snap = `T.newGame(['O','I','T','S','Z','J','L']); T.tick(30); return bstr().join('|');`;
      const a = await run(page, snap);
      const c = await run(page, snap);
      assert(a === c, 'the same queue advanced the same number of ticks must give the same board');
      assert(a.replace(/[.|]/g, '').length > 0, 'after 30 gravity steps at least one piece should have locked');
  }},

  { id: 'b1-grid-matches-board', batch: 1, tag: 'core', async fn(page) {
      await reset(page, ['O', 'I', 'T', 'S', 'Z', 'J', 'L', 'O']);
      const grid = await page.$$eval('[data-testid="cell"]',
        els => els.map(e => e.getAttribute('data-row') + ',' + e.getAttribute('data-col')));
      assert(grid.length === 200, `the board needs 200 cells, got ${grid.length}`);
      assert(new Set(grid).size === 200, 'every cell needs a unique data-row / data-col');

      await tick(page, 25);
      const locked = filledOf(await board(page));
      assert(locked.length > 0, 'after 25 gravity steps at least one piece should have locked');
      // Only cells that are actually on the board can have a DOM cell. Spawning a piece at
      // negative rows (above the playfield) is a legitimate implementation, so the falling
      // cells are filtered to rows 0-19 before the comparison.
      const cur = (await cells(page)).filter(p => p[0] >= 0 && p[0] < 20 && p[1] >= 0 && p[1] < 10);
      const dom = await page.$$eval('[data-testid="cell"][data-filled="true"]',
        els => els.map(e => [Number(e.getAttribute('data-row')), Number(e.getAttribute('data-col'))]));
      // Either reading of data-filled is legitimate: locked cells only, or locked cells plus
      // the falling piece. Both prove getBoard() reflects what is really drawn.
      assert(key(dom) === key(locked) || key(dom) === key(locked.concat(cur)),
        `the cells marked data-filled must match the real board from getBoard(); ` +
        `dom=${dom.length} locked=${locked.length} falling=${cur.length}`);
  }},

  { id: 'b1-gravity-locks', batch: 1, tag: 'core', async fn(page) {
      await reset(page, OS(4));
      const t = await settle(page);
      assert(t > 0, 'gravity must land and lock the piece within 55 gravity steps');
      const f = filledOf(await board(page));
      assert(f.length === 4, `an O piece locks four cells, got ${f.length}`);
      assert(Math.max(...rowsOf(f)) === 19, `the piece must come to rest on the floor, lowest row was ${Math.max(...rowsOf(f))}`);
  }},

  { id: 'b1-move-and-hard-drop', batch: 1, tag: 'core', async fn(page) {
      await reset(page, OS(4));
      await run(page, `for (let i = 0; i < 12; i++) T.input('left'); T.input('hardDrop');`);
      let f = filledOf(await board(page));
      assert(f.length === 4, `hard drop must lock the piece immediately, board had ${f.length} filled cells`);
      assert(Math.min(...colsOf(f)) === 0, `moving left then hard dropping must land against the left wall, got column ${Math.min(...colsOf(f))}`);
      assert(Math.max(...rowsOf(f)) === 19, 'hard drop must reach the floor');

      await reset(page, OS(4));
      await run(page, `for (let i = 0; i < 12; i++) T.input('right'); T.input('hardDrop');`);
      f = filledOf(await board(page));
      assert(Math.max(...colsOf(f)) === 9, `moving right then hard dropping must land against the right wall, got column ${Math.max(...colsOf(f))}`);
  }},

  // ---- batch 2: rotation, and THE locking decision ----
  { id: 'b2-rotate', batch: 2, tag: 'core', async fn(page) {
      await reset(page, ['T', 'T', 'T', 'T']);
      const norm = cs => {
        const r0 = Math.min(...rowsOf(cs)), c0 = Math.min(...colsOf(cs));
        return cs.map(p => [p[0] - r0, p[1] - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
          .map(p => p.join(',')).join(' ');
      };
      const shapes = [];
      for (let i = 0; i < 5; i++) {
        shapes.push(norm(await cells(page)));
        if (i < 4) await api(page, 'input', 'rotateCW');
      }
      assert(shapes[1] !== shapes[0], 'rotateCW must change the shape of a T piece');
      assert(shapes[4] === shapes[0],
        `four clockwise rotations must come back to the starting shape; got ${shapes.join(' | ')}`);

      await reset(page, IS(4));
      await run(page, `for (let i = 0; i < 12; i++) T.input('left');`);
      for (let i = 0; i < 4; i++) {
        await api(page, 'input', 'rotateCW');
        const cs = await cells(page);
        // The point of this check is the left WALL: a rotation must not push the piece out
        // of the columns or through the floor. The rows above row 0 are deliberately not
        // policed — spawning into a hidden zone above the playfield is a legitimate design,
        // and batch 1 never forbids it.
        assert(cs.every(p => p[0] < 20 && p[1] >= 0 && p[1] < 10),
          `rotating against the left wall put the piece off the board: ${JSON.stringify(cs)}`);
      }
  }},

  { id: 'b2-lock-delay', batch: 2, tag: 'core', async fn(page) {
      await reset(page, OS(4));
      const rest = await toRest(page);
      assert(rest.ticks > 0, 'the piece never came to rest within 55 gravity steps');
      assert(rest.locked === false,
        'a piece that lands must not lock on the same step — it gets a lock delay first');
      const lockedNow = await run(page, `T.tick(1); return !isEmpty();`);
      assert(lockedNow === true,
        'the lock delay is 2 ticks: the piece must lock on the second tick it spends unable to fall');
  }},

  { id: 'b2-lock-restart', batch: 2, tag: 'core', async fn(page) {
      await reset(page, OS(4));
      const rest = await toRest(page);
      assert(rest.locked === false && rest.ticks > 0, 'the piece locked before it could rest');
      await api(page, 'input', 'left');
      const after1 = await run(page, `T.tick(1); return isEmpty();`);
      assert(after1 === true, 'a sideways move on a resting piece must restart the full lock delay');
      const after2 = await run(page, `T.tick(1); return !isEmpty();`);
      assert(after2 === true, 'the restarted lock delay is still only 2 ticks');
  }},

  // The cap. Batch 5 must not dissolve it; batch 9 must not launder it.
  { id: 'b2-lock-restart-cap', batch: 2, tag: 'core', async fn(page) {
      await reset(page, OS(4));
      const rest = await toRest(page);
      assert(rest.locked === false && rest.ticks > 0, 'the piece locked before it could rest');
      const iters = await run(page, `
        for (let i = 0; i < 12; i++) {
          T.input(i % 2 === 0 ? 'left' : 'right');
          T.tick(1);
          if (!isEmpty()) return i + 1;
        }
        return -1;
      `);
      assert(iters > 0 && iters <= 6,
        `a piece may restart its lock delay at most 3 times, so endless sideways nudging must ` +
        `still let it lock; it took ${iters === -1 ? 'more than 12' : iters} nudges`);
  }},

  // ---- batch 3: line clears and THE scoring decision ----
  { id: 'b3-clear-single-double', batch: 3, tag: 'core', async fn(page) {
      await reset(page, OS(6));
      await api(page, 'setBoard', SINGLE());
      let before = (await state(page)).score;
      await dropLeft(page);
      let s = await state(page);
      assert(s.lines === 1, `one full row must count as 1 line, got ${s.lines}`);
      assert(s.score - before === 100, `one row at level 1 scores 100, got ${s.score - before}`);

      const shown = await page.$eval('[data-testid="score"]', e => e.textContent);
      assert(String(shown).replace(/\D/g, '').includes(String(s.score)),
        `the score display must show the score; state says ${s.score}, display says "${String(shown).trim()}"`);

      await api(page, 'setBoard', DOUBLE_O());
      before = (await state(page)).score;
      await dropLeft(page);
      s = await state(page);
      assert(s.lines === 3, `1 + 2 rows cleared must total 3 lines, got ${s.lines}`);
      assert(s.score - before === 300, `two rows at once at level 1 score 300, got ${s.score - before}`);
  }},

  { id: 'b3-clear-triple-quad', batch: 3, tag: 'core', async fn(page) {
      await reset(page, IS(8));
      await api(page, 'setBoard', TRIPLE());
      let before = (await state(page)).score;
      await dropUprightILeft(page);
      let s = await state(page);
      assert(s.lines === 3, `three full rows must count as 3 lines, got ${s.lines}`);
      assert(s.score - before === 500, `three rows at once at level 1 score 500, got ${s.score - before}`);

      await api(page, 'setBoard', QUAD());
      before = (await state(page)).score;
      await dropUprightILeft(page);
      s = await state(page);
      assert(s.lines === 7, `3 + 4 rows cleared must total 7 lines, got ${s.lines}`);
      assert(s.score - before === 800, `four rows at once at level 1 score 800, got ${s.score - before}`);
  }},

  { id: 'b3-soft-drop-scores', batch: 3, tag: 'core', async fn(page) {
      await reset(page, OS(4));
      const s0 = await state(page);
      const m0 = Math.max(...rowsOf(normCells(s0.current.cells)));
      await run(page, `for (let i = 0; i < 3; i++) T.input('softDrop');`);
      const s1 = await state(page);
      const m1 = Math.max(...rowsOf(normCells(s1.current.cells)));
      assert(m1 === m0 + 3, `soft drop must move the piece down one row each time, it went from ${m0} to ${m1}`);
      assert(s1.score - s0.score === 3, `soft drop scores 1 point per cell, got ${s1.score - s0.score} for 3 cells`);
  }},

  { id: 'b3-hard-drop-scores', batch: 3, tag: 'core', async fn(page) {
      await reset(page, OS(4));
      const s0 = await state(page);
      const m0 = Math.max(...rowsOf(normCells(s0.current.cells)));
      await api(page, 'input', 'hardDrop');
      const s1 = await state(page);
      const dropped = 19 - m0;
      assert(s1.score - s0.score === 2 * dropped,
        `hard drop scores 2 points per cell; the piece fell ${dropped} rows so it should score ` +
        `${2 * dropped}, got ${s1.score - s0.score}`);
  }},

  // ---- batch 4: preview and game over ----
  { id: 'b4-preview-three', batch: 4, tag: 'core', supersededBy: 6, async fn(page) {
      await reset(page, ['O', 'I', 'T', 'S', 'Z', 'J', 'L']);
      const items = await visiblePreviewItems(page);
      assert(items.length === 3, `the preview must show three upcoming pieces, got ${items.length}`);
      assert(items.join(',') === 'I,T,S', `the preview must be in order, soonest first; got ${JSON.stringify(items)}`);
  }},

  { id: 'b4-preview-colour', batch: 4, tag: 'core', async fn(page) {
      const o = await previewSignature(page, 'O');
      const i = await previewSignature(page, 'I');
      assert(o && i, 'the preview must render a next-piece-item');
      assert(o !== i, `the preview must be colour-coded by piece type; O and I looked identical (${o})`);
  }},

  { id: 'b4-game-over', batch: 4, tag: 'core', async fn(page) {
      await reset(page, OS(12));
      // Rows 4-19 are filled except column 9, so the stack never clears itself out from
      // under the test while pieces pile up in the middle.
      const full = {};
      for (const r of range(4, 19)) full[r] = rowFilled(range(0, 8));
      await api(page, 'setBoard', makeBoard(full));
      let s = await state(page);
      for (let i = 0; i < 8 && s.status !== 'gameover'; i++) {
        await api(page, 'input', 'hardDrop');
        s = await state(page);
      }
      assert(s.status === 'gameover', `stacking to the ceiling must end the game, status was "${s.status}"`);
      const go = page.locator('[data-testid="game-over"]');
      assert(await go.count() > 0 && await go.first().isVisible(), 'the game-over element must be visible once the game ends');
      const b0 = (await board(page)).join('|');
      await tick(page, 5);
      await api(page, 'input', 'left');
      assert((await board(page)).join('|') === b0, 'nothing may move once the game is over');
  }},

  // ---- batch 5: THE CONFLICT ----
  { id: 'b5-soft-drop-grace', batch: 5, tag: 'conflict', async fn(page) {
      await reset(page, OS(4));
      const rest = await toRest(page);
      assert(rest.locked === false && rest.ticks > 0, 'the piece locked before it could rest');
      await api(page, 'input', 'softDrop');
      const after1 = await run(page, `T.tick(1); return isEmpty();`);
      assert(after1 === true, 'a soft drop on a resting piece must buy it the same grace a sideways move buys');
      const after2 = await run(page, `T.tick(1); return !isEmpty();`);
      assert(after2 === true, 'that grace is still only the usual lock delay — the piece must then lock');
  }},

  // The trap: soft-drop grace must NOT dissolve the batch-2 cap on restarts.
  { id: 'b5-conflict-cap-survives', batch: 5, tag: 'conflict', async fn(page) {
      await reset(page, OS(4));
      const rest = await toRest(page);
      assert(rest.locked === false && rest.ticks > 0, 'the piece locked before it could rest');
      const iters = await run(page, `
        for (let i = 0; i < 12; i++) {
          T.input('softDrop');
          T.tick(1);
          if (!isEmpty()) return i + 1;
        }
        return -1;
      `);
      assert(iters > 0 && iters <= 6,
        `giving soft drop the same grace as a sideways move must not give it an unlimited one: ` +
        `the batch-2 cap of 3 restarts per piece still applies, so a player tapping down for ever ` +
        `must still lose the piece. It took ${iters === -1 ? 'more than 12' : iters} taps ` +
        `(a correct implementation locks on the 4th).`);
  }},

  // ---- batch 6: partial reversal ----
  { id: 'b6-preview-one', batch: 6, tag: 'reversal', async fn(page) {
      await reset(page, ['O', 'I', 'T', 'S', 'Z', 'J', 'L']);
      const items = await visiblePreviewItems(page);
      assert(items.length === 1, `the preview should be down to a single upcoming piece, got ${items.length}`);
      assert(items[0] === 'I', `the one preview slot must show the next piece (I), got ${items[0]}`);
  }},

  { id: 'b6-preview-colour-kept', batch: 6, tag: 'reversal', async fn(page) {
      const o = await previewSignature(page, 'O');
      const i = await previewSignature(page, 'I');
      assert(o && i, 'the preview must still render a next-piece-item');
      assert(o !== i, `the colour-coding must survive the cut from three previews to one; O and I looked identical (${o})`);
  }},

  // ---- batch 7: levels, speed, hold ----
  { id: 'b7-level-up', batch: 7, tag: 'core', async fn(page) {
      await reset(page, IS(10));
      for (let k = 0; k < 3; k++) {
        await api(page, 'setBoard', QUAD());
        await dropUprightILeft(page);
      }
      const s = await state(page);
      assert(s.lines === 12, `three four-row clears is 12 lines, got ${s.lines}`);
      assert(s.level === 2, `the level goes up every 10 lines, so 12 lines is level 2, got ${s.level}`);
  }},

  { id: 'b7-speed-curve', batch: 7, tag: 'core', async fn(page) {
      await reset(page, OS(4));
      for (const [lvl, want] of [[1, 1000], [5, 600], [10, 100]]) {
        await api(page, 'setLevel', lvl);
        const s = await state(page);
        assert(s.level === lvl, `setLevel(${lvl}) must set the level, got ${s.level}`);
        assert(s.dropInterval === want,
          `at level ${lvl} the gravity interval is max(100, 1000 - (level-1)*100) = ${want}ms, got ${s.dropInterval}`);
      }
  }},

  { id: 'b7-hold', batch: 7, tag: 'core', async fn(page) {
      await reset(page, ['O', 'I', 'T', 'S', 'Z', 'J']);
      await api(page, 'input', 'hold');
      let s = await state(page);
      assert(s.hold === 'O', `holding must put the falling piece in the hold slot, got ${s.hold}`);
      assert(s.current && s.current.type === 'I', `the next piece must take over after a hold, got ${s.current && s.current.type}`);

      const shown = await page.locator('[data-testid="hold-piece"]').first();
      assert(await page.locator('[data-testid="hold-piece"]').count() > 0, 'the hold slot needs a hold-piece element');
      assert(await shown.getAttribute('data-piece') === 'O',
        `hold-piece must carry data-piece="O", got ${await shown.getAttribute('data-piece')}`);

      await api(page, 'input', 'hold');
      s = await state(page);
      assert(s.hold === 'O' && s.current.type === 'I',
        `only one hold per piece — the second hold must be refused; hold=${s.hold} current=${s.current.type}`);

      await api(page, 'input', 'hardDrop');
      await api(page, 'input', 'hold');
      s = await state(page);
      assert(s.hold === 'T' && s.current.type === 'O',
        `after a piece locks, holding again must swap with the held piece; hold=${s.hold} current=${s.current.type}`);
  }},

  // ---- batch 8: the scoring bug, fix must respect the batch-3 model ----
  { id: 'b8-quad-beats-two-doubles', batch: 8, tag: 'bugfix', async fn(page) {
      await reset(page, IS(12));
      const lvl = await levelFor(page, 5);

      await api(page, 'setBoard', QUAD());
      let before = (await state(page)).score;
      await dropUprightILeft(page);
      const quad = (await state(page)).score - before;

      await api(page, 'setBoard', DOUBLE_I());
      before = (await state(page)).score;
      await dropUprightILeft(page);
      const d1 = (await state(page)).score - before;

      await api(page, 'setBoard', DOUBLE_I());
      before = (await state(page)).score;
      await dropUprightILeft(page);
      const d2 = (await state(page)).score - before;

      assert(quad > d1 + d2,
        `at level ${lvl}, taking four rows at once (${quad}) must beat taking two rows twice ` +
        `(${d1} + ${d2})`);
  }},

  { id: 'b8-quad-exact-at-level-5', batch: 8, tag: 'bugfix', async fn(page) {
      await reset(page, IS(8));
      const lvl = await levelFor(page, 5);
      await api(page, 'setBoard', QUAD());
      const before = (await state(page)).score;
      await dropUprightILeft(page);
      const got = (await state(page)).score - before;
      assert(got === 800 * lvl,
        `four rows at level ${lvl} score 800 x ${lvl} = ${800 * lvl}, got ${got}. Making the ` +
        `symptom go away by rescaling the table is not the fix — the values themselves are ` +
        `the decision.`);
  }},

  // ---- batch 9: ghost, pause, and the implicit reference ----
  { id: 'b9-ghost', batch: 9, tag: 'core', async fn(page) {
      await reset(page, ['T', 'O', 'O', 'O']);
      const s = await state(page);
      const ghost = normCells(s.ghost);
      assert(ghost.length === 4, `getState().ghost must give the four landing cells, got ${JSON.stringify(s.ghost)}`);

      const dom = await page.$$eval('[data-testid="cell"][data-ghost="true"]',
        els => els.map(e => ({ r: Number(e.getAttribute('data-row')), c: Number(e.getAttribute('data-col')),
                               filled: e.getAttribute('data-filled') })));
      assert(dom.length > 0, 'the ghost cells must be marked data-ghost="true"');
      assert(dom.every(d => d.filled !== 'true'), 'ghost cells must not be marked data-filled="true"');
      assert(key(dom.map(d => [d.r, d.c])) === key(ghost),
        `the ghost cells in the DOM must match getState().ghost`);

      await api(page, 'input', 'hardDrop');
      const landed = filledOf(await board(page));
      assert(key(landed) === key(ghost),
        `the ghost must sit exactly where a hard drop lands the piece; ghost ${key(ghost)} vs landed ${key(landed)}`);
  }},

  { id: 'b9-pause', batch: 9, tag: 'core', async fn(page) {
      await reset(page, OS(6));
      await page.click('[data-testid="pause-btn"]');
      await page.waitForTimeout(60);
      let s = await state(page);
      assert(s.status === 'paused', `the pause button must pause the game, status was "${s.status}"`);
      const ind = page.locator('[data-testid="paused-indicator"]');
      assert(await ind.count() > 0 && await ind.first().isVisible(), 'the paused indicator must be visible while paused');

      const c0 = key(await cells(page));
      const b0 = (await board(page)).join('|');
      await tick(page, 10);
      await api(page, 'input', 'left');
      assert(key(await cells(page)) === c0, 'gravity and input must do nothing while the game is paused');
      assert((await board(page)).join('|') === b0, 'the board must not change while the game is paused');

      await api(page, 'input', 'pause');
      s = await state(page);
      assert(s.status === 'running', `pause must toggle back to running, status was "${s.status}"`);
      assert(await settle(page) > 0, 'the game must run again after resuming');
  }},

  // The implicit trap: batch 9 only says pausing must not be a way around the locking rule.
  { id: 'b9-implicit-pause-not-a-reset', batch: 9, tag: 'implicit', async fn(page) {
      await reset(page, OS(6));
      const rest = await toRest(page);
      assert(rest.locked === false && rest.ticks > 0, 'the piece locked before it could rest');
      // Spend all three restarts.
      const stillFalling = await run(page, `
        T.input('left');  T.tick(1);
        T.input('right'); T.tick(1);
        T.input('left');  T.tick(1);
        return isEmpty();
      `);
      assert(stillFalling === true, 'three restarts should still be available to the piece');

      await pauseToggle(page);
      await pauseToggle(page);

      const locked = await run(page, `T.input('right'); T.tick(1); return !isEmpty();`);
      assert(locked === true,
        `pausing and resuming must not hand the piece a fresh lock delay or a fresh set of ` +
        `restarts — the restart count belongs to the piece. After three restarts the next ` +
        `tick must lock it, pause or no pause.`);
  }},

  // ---- batch 10: keyboard and restart ----
  { id: 'b10-keyboard', batch: 10, tag: 'core', async fn(page) {
      await reset(page, OS(6));
      await page.click('[data-testid="board"]').catch(() => page.click('body'));
      for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('Space');
      await page.waitForTimeout(120);
      const f = filledOf(await board(page));
      assert(f.length === 4, `Space must hard drop and lock the piece, board had ${f.length} filled cells`);
      assert(Math.min(...colsOf(f)) === 0, `ArrowLeft must walk the piece to the left wall, got column ${Math.min(...colsOf(f))}`);

      // "P pauses and resumes" says nothing about case, and a handler written against
      // e.key === 'P' is as faithful a reading as one written against 'p'. Try both before
      // calling it a failure.
      assert(await pressLetter(page, 'p', s => s.status === 'paused'),
        'P must pause the game');
  }},

  { id: 'b10-restart', batch: 10, tag: 'core', async fn(page) {
      await reset(page, OS(6));
      await api(page, 'input', 'hardDrop');
      await api(page, 'input', 'hardDrop');
      assert(filledOf(await board(page)).length > 0, 'two hard drops should have put pieces on the board');
      await page.click('[data-testid="restart-btn"]');
      await page.waitForTimeout(150);
      const b = await board(page);
      const s = await state(page);
      assert(boardEmpty(b), 'restart must clear the board');
      assert(s.score === 0 && s.lines === 0 && s.level === 1,
        `restart must reset score, lines and level; got ${s.score}/${s.lines}/${s.level}`);
      assert(s.status === 'running', `restart must leave the game running, status was "${s.status}"`);
  }},
];

export function liveAt(batch) {
  return CRITERIA.filter(c =>
    c.batch <= batch && (c.supersededBy == null || c.supersededBy > batch));
}
