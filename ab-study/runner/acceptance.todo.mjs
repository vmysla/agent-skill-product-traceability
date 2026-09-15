// Acceptance criteria for the todo app.
// Each criterion is tagged with the batch that introduced it and, where relevant, the batch
// that supersedes it. The grader runs every criterion that is LIVE at the batch under test:
//   batch <= current  AND  (supersededBy === null || supersededBy > current)
//
// Criteria address the app only through the data-testid contract that batch 1 gives both arms
// verbatim. Nothing here assumes a DOM shape beyond those attributes, because the two arms
// will build different markup and the grader must be fair to both.

const TZ = 'America/Los_Angeles';

// ---------- helpers ----------

async function reset(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid="todo-input"]', { timeout: 5000 });
}

// The contract does not say whether todo-due / todo-priority live in the add form or on the
// row. Both are legitimate readings. Prefer a control outside any row when adding; otherwise
// add first and set the field on the resulting row.
async function controlOutsideRows(page, testid) {
  const all = page.locator(`[data-testid="${testid}"]`);
  const n = await all.count();
  for (let i = 0; i < n; i++) {
    const el = all.nth(i);
    const inRow = await el.evaluate(e => !!e.closest('[data-testid="todo-item"]'));
    if (!inRow) return el;
  }
  return null;
}

async function addTodo(page, text, opts = {}) {
  const { due, priority } = opts;
  const dueCtl = due ? await controlOutsideRows(page, 'todo-due') : null;
  const priCtl = priority ? await controlOutsideRows(page, 'todo-priority') : null;

  await page.fill('[data-testid="todo-input"]', text);
  if (dueCtl) await dueCtl.fill(due);
  if (priCtl) await priCtl.selectOption(priority).catch(() => priCtl.fill(priority));
  await page.click('[data-testid="todo-add"]');
  await page.waitForTimeout(120);

  // fall back to setting the fields on the created row
  const row = page.locator('[data-testid="todo-item"]').filter({ hasText: text }).first();
  if (due && !dueCtl) {
    const d = row.locator('[data-testid="todo-due"]').first();
    if (await d.count()) { await d.fill(due); await d.blur().catch(() => {}); }
  }
  if (priority && !priCtl) {
    const p = row.locator('[data-testid="todo-priority"]').first();
    if (await p.count()) await p.selectOption(priority).catch(() => p.fill(priority));
  }
  await page.waitForTimeout(120);
}

// Visible rows, in DOM order, with their declared state.
async function rows(page) {
  return page.$$eval('[data-testid="todo-item"]', els =>
    els.filter(e => {
      const s = getComputedStyle(e);
      return s.display !== 'none' && s.visibility !== 'hidden' && e.offsetParent !== null;
    }).map(e => {
      const t = e.querySelector('[data-testid="todo-text"]');
      return {
        text: (t ? t.textContent : e.textContent).trim(),
        completed: e.getAttribute('data-completed'),
        overdue: e.getAttribute('data-overdue'),
        priority: e.getAttribute('data-priority'),
      };
    })
  );
}

async function toggle(page, text) {
  const row = page.locator('[data-testid="todo-item"]').filter({ hasText: text }).first();
  await row.locator('[data-testid="todo-toggle"]').first().click();
  await page.waitForTimeout(120);
}

const texts = rs => rs.map(r => r.text);
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ---------- criteria ----------

export const CRITERIA = [
  // ---- batch 1: core ----
  { id: 'b1-add', batch: 1, tag: 'core', async fn(page) {
      await reset(page);
      await addTodo(page, 'alpha');
      const r = await rows(page);
      assert(r.length === 1 && r[0].text.includes('alpha'), `expected 1 row 'alpha', got ${JSON.stringify(texts(r))}`);
  }},
  { id: 'b1-multiple', batch: 1, tag: 'core', async fn(page) {
      await reset(page);
      for (const t of ['one', 'two', 'three']) await addTodo(page, t);
      const r = await rows(page);
      assert(r.length === 3, `expected 3 rows, got ${r.length}`);
  }},
  { id: 'b1-delete', batch: 1, tag: 'core', async fn(page) {
      await reset(page);
      await addTodo(page, 'keepme'); await addTodo(page, 'killme');
      const row = page.locator('[data-testid="todo-item"]').filter({ hasText: 'killme' }).first();
      await row.locator('[data-testid="todo-delete"]').first().click();
      await page.waitForTimeout(150);
      const r = await rows(page);
      assert(r.length === 1 && r[0].text.includes('keepme'), `delete failed: ${JSON.stringify(texts(r))}`);
  }},
  { id: 'b1-persist', batch: 1, tag: 'core', async fn(page) {
      await reset(page);
      await addTodo(page, 'survivor');
      await page.reload();
      await page.waitForSelector('[data-testid="todo-input"]');
      await page.waitForTimeout(200);
      const r = await rows(page);
      assert(r.some(x => x.text.includes('survivor')), `did not persist across reload: ${JSON.stringify(texts(r))}`);
  }},
  { id: 'b1-single-file', batch: 1, tag: 'core', isStatic: true, fn(_, { files }) {
      const html = files['index.html'];
      assert(html, 'index.html missing');
      assert(!/<script[^>]+src=["']https?:/i.test(html), 'external script (CDN) present');
      assert(!/<link[^>]+href=["']https?:/i.test(html), 'external stylesheet present');
  }},

  // ---- batch 2: completion, filters, ordering decision ----
  { id: 'b2-toggle', batch: 2, tag: 'core', async fn(page) {
      await reset(page);
      await addTodo(page, 'task-a');
      await toggle(page, 'task-a');
      const r = await rows(page);
      assert(r[0].completed === 'true', `data-completed not true after toggle: ${r[0].completed}`);
  }},
  { id: 'b2-filters', batch: 2, tag: 'core', async fn(page) {
      await reset(page);
      await addTodo(page, 'act-1'); await addTodo(page, 'don-1');
      await toggle(page, 'don-1');
      await page.click('[data-testid="filter-active"]'); await page.waitForTimeout(150);
      let r = await rows(page);
      assert(r.length === 1 && r[0].text.includes('act-1'), `active filter wrong: ${JSON.stringify(texts(r))}`);
      await page.click('[data-testid="filter-completed"]'); await page.waitForTimeout(150);
      r = await rows(page);
      assert(r.length === 1 && r[0].text.includes('don-1'), `completed filter wrong: ${JSON.stringify(texts(r))}`);
      await page.click('[data-testid="filter-all"]'); await page.waitForTimeout(150);
      r = await rows(page);
      assert(r.length === 2, `all filter wrong: ${JSON.stringify(texts(r))}`);
  }},
  // THE load-bearing rule. Batch 5 conflicts with it; batch 9 references it implicitly.
  { id: 'b2-completed-last', batch: 2, tag: 'core', async fn(page) {
      await reset(page);
      for (const t of ['first', 'second', 'third']) await addTodo(page, t);
      await toggle(page, 'first');
      await page.click('[data-testid="filter-all"]').catch(() => {});
      await page.waitForTimeout(150);
      const r = await rows(page);
      assert(r[r.length - 1].text.includes('first'),
        `completed item must sort last; order was ${JSON.stringify(texts(r))}`);
  }},

  // ---- batch 3: due dates, local-date decision ----
  { id: 'b3-overdue-past', batch: 3, tag: 'core', tz: TZ, clock: '2026-01-15T12:00:00-08:00', async fn(page) {
      await reset(page);
      await addTodo(page, 'late-task', { due: '2026-01-10' });
      const r = await rows(page);
      assert(r[0].overdue === 'true', `past due should be overdue, data-overdue=${r[0].overdue}`);
  }},
  { id: 'b3-overdue-future', batch: 3, tag: 'core', tz: TZ, clock: '2026-01-15T12:00:00-08:00', async fn(page) {
      await reset(page);
      await addTodo(page, 'future-task', { due: '2026-01-20' });
      const r = await rows(page);
      assert(r[0].overdue === 'false', `future due must not be overdue, data-overdue=${r[0].overdue}`);
  }},

  // ---- batch 4: priorities (colour superseded by batch 6) ----
  { id: 'b4-priority-attr', batch: 4, tag: 'core', async fn(page) {
      await reset(page);
      await addTodo(page, 'hi-task', { priority: 'high' });
      const r = await rows(page);
      assert(r[0].priority === 'high', `data-priority expected 'high', got ${r[0].priority}`);
  }},
  { id: 'b4-priority-colour', batch: 4, tag: 'core', supersededBy: 6, async fn(page) {
      await reset(page);
      await addTodo(page, 'red-task', { priority: 'high' });
      await addTodo(page, 'grey-task', { priority: 'low' });
      const bg = await page.$$eval('[data-testid="todo-item"]', els =>
        els.map(e => getComputedStyle(e).backgroundColor + '|' + getComputedStyle(e).color));
      assert(new Set(bg).size > 1, `priorities should be colour-coded differently, got ${JSON.stringify(bg)}`);
  }},

  // ---- batch 5: THE CONFLICT ----
  { id: 'b5-priority-sort', batch: 5, tag: 'conflict', async fn(page) {
      await reset(page);
      await addTodo(page, 'p-low', { priority: 'low' });
      await addTodo(page, 'p-high', { priority: 'high' });
      await addTodo(page, 'p-med', { priority: 'med' });
      const r = await rows(page);
      assert(texts(r).join(',').indexOf('p-high') < texts(r).join(',').indexOf('p-med'),
        `high must sort above med: ${JSON.stringify(texts(r))}`);
      assert(texts(r).join(',').indexOf('p-med') < texts(r).join(',').indexOf('p-low'),
        `med must sort above low: ${JSON.stringify(texts(r))}`);
  }},
  // The trap: priority sorting must NOT dissolve the batch-2 completed-last rule.
  { id: 'b5-conflict-completed-still-last', batch: 5, tag: 'conflict', async fn(page) {
      await reset(page);
      await addTodo(page, 'c-high', { priority: 'high' });
      await addTodo(page, 'c-low', { priority: 'low' });
      await toggle(page, 'c-high');               // completed AND highest priority
      await page.click('[data-testid="filter-all"]').catch(() => {});
      await page.waitForTimeout(150);
      const r = await rows(page);
      assert(r[r.length - 1].text.includes('c-high'),
        `a completed high-priority item must still sort BELOW an active low-priority one ` +
        `(batch 2 rule survives batch 5); order was ${JSON.stringify(texts(r))}`);
  }},

  // ---- batch 6: partial reversal ----
  { id: 'b6-colour-removed', batch: 6, tag: 'reversal', async fn(page) {
      await reset(page);
      await addTodo(page, 'x-high', { priority: 'high' });
      await addTodo(page, 'x-low', { priority: 'low' });
      const bg = await page.$$eval('[data-testid="todo-item"]', els =>
        els.map(e => getComputedStyle(e).backgroundColor + '|' + getComputedStyle(e).color));
      assert(new Set(bg).size === 1, `priority colour-coding should be gone, got ${JSON.stringify(bg)}`);
  }},
  { id: 'b6-priority-kept', batch: 6, tag: 'reversal', async fn(page) {
      await reset(page);
      await addTodo(page, 'y-high', { priority: 'high' });
      const r = await rows(page);
      assert(r[0].priority === 'high', `priority field must survive the colour removal, got ${r[0].priority}`);
  }},

  // ---- batch 7: edit + search ----
  { id: 'b7-search', batch: 7, tag: 'core', async fn(page) {
      await reset(page);
      await addTodo(page, 'apple pie'); await addTodo(page, 'banana bread');
      await page.fill('[data-testid="search-input"]', 'banana');
      await page.waitForTimeout(200);
      const r = await rows(page);
      assert(r.length === 1 && r[0].text.toLowerCase().includes('banana'),
        `search should show only matches: ${JSON.stringify(texts(r))}`);
  }},
  { id: 'b7-search-with-filter', batch: 7, tag: 'core', async fn(page) {
      await reset(page);
      await addTodo(page, 'zebra active'); await addTodo(page, 'zebra done');
      await toggle(page, 'zebra done');
      await page.click('[data-testid="filter-active"]');
      await page.fill('[data-testid="search-input"]', 'zebra');
      await page.waitForTimeout(200);
      const r = await rows(page);
      assert(r.length === 1 && r[0].text.includes('active'),
        `search must combine with the active filter: ${JSON.stringify(texts(r))}`);
  }},

  // ---- batch 8: the timezone bug, fix must respect the batch-3 decision ----
  { id: 'b8-due-today-not-overdue-evening', batch: 8, tag: 'bugfix', tz: TZ,
    clock: '2026-01-15T22:30:00-08:00', async fn(page) {
      await reset(page);
      await addTodo(page, 'due-today', { due: '2026-01-15' });
      const r = await rows(page);
      assert(r[0].overdue === 'false',
        `a todo due TODAY must not be overdue at 22:30 local in UTC-8 ` +
        `(the reported bug); data-overdue=${r[0].overdue}`);
  }},
  { id: 'b8-yesterday-still-overdue', batch: 8, tag: 'bugfix', tz: TZ,
    clock: '2026-01-15T22:30:00-08:00', async fn(page) {
      await reset(page);
      await addTodo(page, 'due-yesterday', { due: '2026-01-14' });
      const r = await rows(page);
      assert(r[0].overdue === 'true',
        `the fix must not disable overdue entirely; yesterday is still overdue, got ${r[0].overdue}`);
  }},

  // ---- batch 9: implicit reference to the ordering rule ----
  { id: 'b9-clear-completed', batch: 9, tag: 'core', async fn(page) {
      await reset(page);
      await addTodo(page, 'stay'); await addTodo(page, 'go');
      await toggle(page, 'go');
      await page.click('[data-testid="bulk-clear-completed"]');
      await page.waitForTimeout(200);
      const r = await rows(page);
      assert(r.length === 1 && r[0].text.includes('stay'), `clear-completed wrong: ${JSON.stringify(texts(r))}`);
  }},
  { id: 'b9-mark-all', batch: 9, tag: 'core', async fn(page) {
      await reset(page);
      await addTodo(page, 'm1'); await addTodo(page, 'm2');
      await page.click('[data-testid="bulk-mark-all"]');
      await page.waitForTimeout(200);
      const r = await rows(page);
      assert(r.every(x => x.completed === 'true'), `mark-all should complete everything: ${JSON.stringify(r)}`);
  }},
  // The implicit trap: ordering must survive bulk operations.
  { id: 'b9-implicit-ordering-preserved', batch: 9, tag: 'implicit', async fn(page) {
      await reset(page);
      await addTodo(page, 'i-low', { priority: 'low' });
      await addTodo(page, 'i-high', { priority: 'high' });
      await addTodo(page, 'i-med', { priority: 'med' });
      await toggle(page, 'i-high');                 // completed high -> must drop to the bottom
      await page.click('[data-testid="filter-all"]').catch(() => {});
      await page.waitForTimeout(150);
      const r = await rows(page);
      assert(r[r.length - 1].text.includes('i-high'),
        `after a bulk-actions batch that only said "respect the ordering we agreed on", ` +
        `a completed item must still sort last; order was ${JSON.stringify(texts(r))}`);
      assert(texts(r)[0].includes('i-med'),
        `active items must still be priority-ordered (med above low); order was ${JSON.stringify(texts(r))}`);
  }},

  // ---- batch 10: shortcuts ----
  { id: 'b10-enter-adds', batch: 10, tag: 'core', async fn(page) {
      await reset(page);
      await page.fill('[data-testid="todo-input"]', 'via-enter');
      await page.press('[data-testid="todo-input"]', 'Enter');
      await page.waitForTimeout(200);
      const r = await rows(page);
      assert(r.some(x => x.text.includes('via-enter')), `Enter should add a todo: ${JSON.stringify(texts(r))}`);
  }},
  { id: 'b10-slash-focuses-search', batch: 10, tag: 'core', async fn(page) {
      await reset(page);
      await page.click('body');
      await page.keyboard.press('/');
      await page.waitForTimeout(150);
      const focused = await page.evaluate(() =>
        document.activeElement && document.activeElement.getAttribute('data-testid'));
      assert(focused === 'search-input', `'/' should focus search, focus was on ${focused}`);
  }},
];

export function liveAt(batch) {
  return CRITERIA.filter(c =>
    c.batch <= batch && (c.supersededBy == null || c.supersededBy > batch));
}

// Selector the grader waits for before running any criterion: the app is "ready" once this
// element exists. Named here rather than in the grader so each app can declare its own.
export const READY = '[data-testid="todo-input"]';
