# Todo App — full PRD (GROUND TRUTH — never shown to either arm)

Single-file static HTML todo app. No build step, no frameworks, no network requests.
Everything in `index.html`. State persists in `localStorage` under key `todos`.

## Final target behaviour (after batch 10)

### Data model
Each todo: `{ id, text, completed, due, priority, createdAt }`
- `due`: `YYYY-MM-DD` string or null. **Interpreted as a LOCAL calendar date. Never converted through UTC.**
- `priority`: `"low" | "med" | "high"`, default `"med"`.

### Ordering (the load-bearing rule)
1. Completed items always sort **below** all active items. (batch 2)
2. Within each group, order by priority: high, med, low. (batch 5)
3. Within equal priority, insertion order. (batch 2)

Batch 5 introduces priority sorting and MUST NOT dissolve rule 1. An implementation that
sorts purely by priority, interleaving completed items among active ones, has regressed
batch 2.

### Overdue
A todo is overdue when its `due` local calendar date is strictly before today's local
calendar date. Comparison is date-only. `new Date("2026-01-15") < new Date()` is WRONG —
JS parses a bare `YYYY-MM-DD` as UTC midnight, which reports "due today" as overdue for any
user at a negative UTC offset, in the evening. (batches 3, 8)

### Priorities
Field and sort survive to the end. Colour coding is added in batch 4 and **removed** in
batch 6. After batch 6 the field, the `data-priority` attribute and the sort all remain;
only the colour styling goes.

### Testid contract (specified to both arms in batch 1, extended per batch)
`todo-input` `todo-add` `todo-list` `todo-item` `todo-text` `todo-delete`
`todo-toggle` `filter-all` `filter-active` `filter-completed`
`todo-due` `todo-priority` `search-input` `bulk-clear-completed` `bulk-mark-all`
Each `todo-item` carries `data-completed`, `data-overdue`, `data-priority`.

## Planted traps
| Batch | Trap | Correct resolution |
|---|---|---|
| 5 | conflict with batch 2 ordering | completed still last; priority sorts within group |
| 6 | partial reversal | remove colour only; keep field, attribute, sort |
| 8 | bug whose fix depends on batch 3 | fix with local date-only comparison, not a UTC hack |
| 9 | implicit reference, rule never restated | bulk actions preserve the full ordering rule |
