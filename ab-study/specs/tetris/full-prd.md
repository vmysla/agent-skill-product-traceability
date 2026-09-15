# Tetris — full PRD (GROUND TRUTH — never shown to either arm)

Single-file static HTML tetris. No build step, no frameworks, no network requests.
Everything in `index.html`. Target size when finished: 700–1000 lines.

This app is the LARGE end of the study's size gradient (todo = 341 lines, calculator = 250–350).
The trap structure is deliberately identical to the todo spec so the three apps are comparable.
Size is the only intended variable.

## Final target behaviour (after batch 10)

### Board and pieces
- Playfield is 10 columns × 20 rows. Row 0 is the top.
- Seven tetrominoes: `I O T S Z J L`, each with its own colour.
- A piece spawns at the top, falls under gravity, and locks when it can no longer fall.
- When a piece locks, any full rows are removed and everything above drops down.

### Determinism (the whole reason this app is testable)
The app exposes `window.__tetris` — a test control surface specified verbatim in batch 1 and
identical for both arms. It lets a test replace the piece sequence, set the board, advance the
game by exact gravity steps, and read board and game state back as data.

Two hard requirements that make it honest:
- `getBoard()` must be derived from the same data the renderer draws from. It is not a
  parallel copy that a test could be satisfied by.
- Rendering is synchronous. After `tick()` or `input()` the DOM already shows the new state.
  Nothing is deferred to an animation frame — the grader freezes the clock, so a deferred
  render never happens.

### Locking (the load-bearing rule — batch 2)
1. A gravity step moves the piece down one row. If it cannot move down, the step counts one
   tick of **lock delay** instead.
2. The lock delay is **2 ticks**. The piece locks on the second tick it spends unable to fall.
3. A left/right move while resting **restarts** the delay — the full 2 ticks come back. (batch 2)
4. A soft-drop press while resting also restarts it. (batch 5)
5. **At most 3 restarts per piece.** After the third, the delay runs out whatever the player
   does. The count belongs to the piece and is never refreshed — not by falling further,
   not by pausing. (batch 2; batch 5 must respect it; batch 9 must not launder it)
6. Hard drop is the exception: it locks immediately, with no delay.

Batch 5 grants soft drop the same grace a sideways move gets, and MUST NOT dissolve rule 5.
An implementation where soft drop restarts the delay without limit lets a player stall for
ever and has regressed batch 2.

### Scoring (the second load-bearing rule — batch 3)
- Rows cleared at once: 1 → 100, 2 → 300, 3 → 500, 4 → 800.
- That number is multiplied by the current level.
- Soft drop: 1 point per cell the piece moves down under player control.
- Hard drop: 2 points per cell dropped.
- Reason for the table: clearing rows together must always beat clearing the same rows one at
  a time, otherwise there is no reason to ever build a stack. (batches 3, 8)

A per-row implementation (`score += 100 * level` inside the row-removal loop) gives 4 rows =
400×level and two doubles = 600×level, which inverts the incentive. That is the batch-8 bug.
The correct fix restores the table. A fix that rescales — rows², a flat bonus for four — makes
the symptom go away and breaks the batch-3 values, which the batch-3 criteria catch.

### Levels (batch 7)
- Level starts at 1 and goes up one for every 10 lines cleared. The level never goes down.
- Gravity interval in ms: `max(100, 1000 - (level - 1) * 100)`.
- `tick()` is unaffected by level — it always advances exactly one gravity step.

### Next-piece preview
Introduced in batch 4 showing the next **three** pieces, colour-coded by type.
Batch 6 cuts it to **one** piece and **keeps** the colour coding. After batch 6 the preview
shows exactly one item, still carries `data-piece`, and is still colour-coded.

### Hold (batch 7)
One hold slot. Hold swaps the falling piece with the held one; the swapped-in piece enters at
the spawn position. Only one hold per piece — holding again is refused until a piece locks.

### Ghost and pause (batch 9)
- The ghost shows exactly where a hard drop would land the current piece. Ghost cells are
  marked `data-ghost="true"` and are NOT marked `data-filled="true"`.
- Pause freezes everything: ticks and inputs do nothing until the game resumes.
- Pausing must not refresh the lock delay or the restart count. (implicit reference)

### Game over (batch 4)
When a newly spawned piece cannot be placed, `status` becomes `"gameover"`, the `game-over`
element is shown, and ticks and inputs stop having any effect.

### Testid contract (batch 1, extended per batch)
batch 1: `board` `cell` `score` `level` `lines`
  — each `cell` carries `data-row` `data-col` `data-filled` `data-piece`
batch 4: `next-piece` `next-piece-item` (`data-piece`) `game-over`
batch 7: `hold-piece` (`data-piece`)
batch 9: `pause-btn` `paused-indicator`, plus `data-ghost` on cells
batch 10: `restart-btn`

### Control surface (batch 1, extended per batch)
batch 1: `newGame(queue)` `setQueue(queue)` `setBoard(rows)` `tick(n)` `input(action)`
         `getBoard()` `getState()`; actions `left` `right` `softDrop` `hardDrop`;
         state `{current:{type,cells}, next, score, level, lines, status}`
batch 2: action `rotateCW`
batch 4: `status` can be `"gameover"`
batch 7: `setLevel(n)`, action `hold`, state gains `hold` and `dropInterval`
batch 9: action `pause`, `status` can be `"paused"`, state gains `ghost`

## Planted traps
| Batch | Trap | Correct resolution |
|---|---|---|
| 5 | conflict with the batch-2 lock rule | soft drop restarts the delay, but spends one of the same 3 restarts |
| 6 | partial reversal | preview drops to one piece; the colour coding stays |
| 8 | bug whose fix depends on batch 3 | restore the 100/300/500/800 table, do not rescale it |
| 9 | implicit reference, rule never restated | pause/resume must not refresh the lock delay or the restart count |
