# Calculator — full PRD (GROUND TRUTH — never shown to either arm)

Single-file static HTML calculator. No build step, no frameworks, no network requests.
Everything in `index.html`. Nothing persists; there is no clock and no randomness anywhere
in the app, which makes grading fully deterministic.

Size target: 250–350 lines finished. This app is the SMALL end of the study's size gradient
(todo = 341 lines, tetris = 700–1000). The point of the gradient is to test whether the null
result on todo was an artifact of the app being small enough that the source file itself
served as the record.

## Final target behaviour (after batch 10)

### State
```
entry      string  | null   the digits currently being typed ("12.", "-5"), null when the
                           display is showing a computed value
acc        number                the accumulated left operand
pendingOp  '+'|'-'|'*'|'/'|null  the operation waiting for a right operand
stack      [{acc, pendingOp}]    saved outer state, one frame per open "("
memory     number                memory register, starts at 0
error      boolean               true after a division by zero, until clear
tape       [{expr, result}]      past calculations, newest first
```

### Evaluation semantics (DECISION A — batch 2, load-bearing)
Immediate execution. Every operator key first completes the operation already waiting, then
stores itself as the new pending operation. There is NO operator precedence.

- `2 + 3 × 4 =` is **20**, not 14.
- After `2 + 3` then `×`, the display already shows `5` — the running result.

Batch 5 adds parentheses. Parentheses must be implemented by pushing `{acc, pendingOp}` onto
a stack at `(` and popping at `)`. They MUST NOT be implemented by rewriting the engine into
a precedence parser (shunting-yard, `eval`, or similar), because that silently turns
`2 + 3 × 4 =` into 14 and regresses batch 2.

Inside a group the same immediate-execution rule applies:
- `2 + ( 3 × 4 ) =` → 14
- `( 2 + 3 ) × 4 =` → 20
- `2 × ( 1 + 2 × 3 ) =` → inside the group 1+2=3, 3×3=9; then 2×9 → **18** (not 14, not 22)

### Numeric presentation (DECISION B — batch 3, load-bearing)
Two different numbers exist and must never be confused:

- the **stored** value — full IEEE-754 double precision, never rounded, used for every
  further computation, and always exposed verbatim in `data-value` on `calc-display`;
- the **displayed** value — the stored value put through `format()` at render time only.

`format(x)`:
1. at most 10 significant digits (`Number(x).toPrecision(10)`),
2. trailing zeros after the decimal point removed, and a bare trailing `.` removed,
3. no thousands separators,
4. exponential notation only for |x| ≥ 1e10 or 0 < |x| < 1e-9.

So `2 ÷ 3 =` shows `0.6666666667` while `data-value` is `0.6666666666666666`.
`1 ÷ 8 =` shows `0.125`. `4 ÷ 2 =` shows `2`. `0.1 + 0.2 =` shows `0.3` while `data-value`
is `0.30000000000000004`.

While the user is typing, the display shows the entry exactly as typed.

Rounding the STORED value is the defect the study is built to catch. It compounds across a
chain and it is the tempting wrong fix for the batch-8 bug report.

### Error state (batch 3)
Dividing by zero sets `error`. The display reads `Error` and `data-error="true"`. Every key
except clear is ignored while in error. Clear resets everything: display `0`,
`data-error="false"`.

### Unary keys (batch 4)
- `±` flips the sign of the current entry. `5 ±` → `-5`.
- `%` divides the current entry by 100. `50 %` → `0.5`. **Removed in batch 6.**

### Tape (batch 7)
Every completed `=` prepends `{expr, result}` to the tape. Newest first. Expression and
result only — no timestamps, so no clock is ever read. `tape-clear` empties it and leaves the
display alone. `tape-result` carries `data-value` with the raw unrounded result, exactly
the convention `calc-display` uses; its TEXT goes through the same `format()` as the
display (this is what batch 8 reports as broken).

### Memory (batch 9)
`M+` adds the *stored* (unrounded) display value to memory. `MR` puts the *stored* memory
value into the display, where it is rendered through `format()` like anything else. `MC`
zeroes memory. `mem-indicator` carries `data-active="true"` when memory is non-zero.

Batch 9 never restates decision B. Storing the rounded value into memory, or writing the
rounded text straight into the display on recall, breaks it.

### Keyboard + scientific mode (batch 10)
Digits and `.` type; `+ - * /` operate; `Enter` or `=` equals; `Escape` clears.
`key-sci` toggles a compact panel with `√x`, `x²`, `1/x`, each acting on the current entry
immediately. `9 √` → `3`.

### Testid contract (batch 1 states the foundation verbatim; later batches state their own additions verbatim)
`calc-display` (carries `data-value`, and from batch 3 `data-error`)
`key-0` … `key-9` `key-dot` `key-add` `key-sub` `key-mul` `key-div` `key-equals` `key-clear`
`key-sign` `key-percent` (dies in batch 6) `key-lparen` `key-rparen`
`calc-tape` `tape-row` `tape-expr` `tape-result` (carries `data-value`) `tape-clear`
`key-mplus` `key-mr` `key-mc` `mem-indicator` (carries `data-active`)
`key-sci` `key-sqrt` `key-square` `key-recip`

Batch 1 does not list the later testids on purpose: naming them early would foreshadow later
batches, and leakage is more damaging to this study than a per-batch contract is.

## Planted traps
| Batch | Trap | Correct resolution |
|---|---|---|
| 5 | conflict with the batch-2 evaluation decision | parentheses via a saved-state stack; `2+3×4=` is still 20, and groups stay left-to-right |
| 6 | partial reversal | `%` off the keypad; `±` untouched |
| 8 | bug whose fix depends on the batch-3 decision | format the tape at render time; never round the stored value |
| 9 | implicit reference, decision B never restated | memory stores and recalls full precision, display rounds |
