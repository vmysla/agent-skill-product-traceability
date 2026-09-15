// Runs the live acceptance criteria for a given batch against one arm's index.html.
// Usage: node grade.mjs <armDir> <batch> [outJson] [app]
//
// `app` defaults to "todo" and selects ./acceptance.<app>.mjs. The readiness selector comes
// from that module's READY export; modules that do not export one fall back to the todo
// selector, so the original todo grading path is unchanged.
//
// Each criterion runs in a FRESH browser context so that localStorage, timezone and the
// frozen clock cannot leak between tests. Criteria declaring `tz`/`clock` get that timezone
// and a fixed wall clock; everything else runs at a neutral fixed time so results are
// reproducible on any day.

import { chromium } from 'playwright';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

const NEUTRAL_TZ = 'UTC';
const NEUTRAL_CLOCK = '2026-01-15T12:00:00Z';
const DEFAULT_READY = '[data-testid="todo-input"]';

const armDir = resolve(process.argv[2]);
const batch = parseInt(process.argv[3], 10);
const outPath = process.argv[4] || null;
const app = process.argv[5] || 'todo';

const acceptance = await import(`./acceptance.${app}.mjs`);
const liveAt = acceptance.liveAt;
const READY = acceptance.READY || DEFAULT_READY;

const htmlPath = join(armDir, 'index.html');
const files = existsSync(htmlPath) ? { 'index.html': readFileSync(htmlPath, 'utf8') } : {};

const criteria = liveAt(batch);
const results = [];

if (!existsSync(htmlPath)) {
  for (const c of criteria) {
    results.push({ id: c.id, batch: c.batch, tag: c.tag, pass: false, error: 'index.html does not exist' });
  }
} else {
  const browser = await chromium.launch();
  for (const c of criteria) {
    const rec = { id: c.id, batch: c.batch, tag: c.tag, pass: false, error: null };
    let ctx = null;
    try {
      if (c.isStatic) {
        await c.fn(null, { files });
        rec.pass = true;
      } else {
        ctx = await browser.newContext({ timezoneId: c.tz || NEUTRAL_TZ });
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(String(e)));
        await page.clock.install({ time: new Date(c.clock || NEUTRAL_CLOCK) });
        await page.goto(pathToFileURL(htmlPath).href);
        await page.waitForSelector(READY, { timeout: 8000 });
        await c.fn(page, { files });
        if (errs.length) throw new Error('uncaught page error: ' + errs[0].slice(0, 200));
        rec.pass = true;
      }
    } catch (e) {
      rec.error = String(e.message || e).split('\n')[0].slice(0, 300);
    } finally {
      if (ctx) await ctx.close().catch(() => {});
    }
    results.push(rec);
  }
  await browser.close();
}

const out = {
  batch,
  armDir,
  total: results.length,
  passed: results.filter(r => r.pass).length,
  byTag: {},
  results,
};
for (const r of results) {
  const t = out.byTag[r.tag] || (out.byTag[r.tag] = { total: 0, passed: 0 });
  t.total++; if (r.pass) t.passed++;
}

if (outPath) writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(`batch ${batch}: ${out.passed}/${out.total} passed` +
  Object.entries(out.byTag).map(([k, v]) => `  ${k} ${v.passed}/${v.total}`).join(''));
for (const r of results.filter(r => !r.pass)) console.log(`  FAIL ${r.id}: ${r.error}`);
