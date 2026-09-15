# Decisions

_Appended by product-record hooks. Do not edit by hand._

## DEC-001 - Single static HTML file with inline assets

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: ONE file: index.html with inline CSS and JS; no frameworks, build step, CDN links, or network requests
- Why: User's constraint applies to entire project; ensures filesystem-only operation and simplicity
- Rejected: Separate CSS and JS files - Violates the one-file constraint; Use frameworks or CDN links - Violates the no-framework and no-CDN constraint
- Evidence: "ONE file: `index.html`. Inline CSS and JS. No frameworks, no build step, no CDN links, no network requests."

## DEC-002 - Display vs data-value separation

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: Display shows entry as typed (e.g., '12.'); data-value holds String(Number(entry)) (e.g., '12')
- Why: Allows display to reflect user input faithfully while data-value provides normalized value for testing; results rounded to 15 significant digits to handle float precision
- Rejected: Display and data-value show the same normalized value - Would hide decimal point entry from user view before completion
- Evidence: "the display shows the entry as typed (`12.`), and `data-value` holds `String(Number(entry))` (`12`). Results are rounded to 15 significant digits, so `0.1 + 0.2` shows `0.3`."

### Considered, not done (REQ-001, 2026-09-13)

- Handle divide by zero with error message or zero result - Divide by zero shows Infinity without special handling. Evidence: "divide by zero has no special handling and shows `Infinity`."
- Implement keyboard input support - Not implemented; logic is inline in HTML and cannot be imported by external tests. Evidence: "There's no keyboard input and no `check/` tests, because the logic is inline in the HTML and can't be imported by a test."

## DEC-003 - Immediate execution, left-to-right evaluation, no operator precedence

- Date: 2026-09-13
- REQ: REQ-002
- Status: accepted
- Chose: The calculator uses immediate execution. Each operator key finishes the operation already waiting, strictly left to right. There is no operator precedence. 2 + 3 × 4 = is 20, not 14.
- Why: This is how a pocket calculator works, and it makes the running display honest. The number on screen is always a real result the user can read and act on.
- Rejected: Operator precedence (defer multiply until addition is complete) - The display would show a number the calculator was not actually going to use
- Evidence: "The calculator uses immediate execution. Each operator key finishes the operation already waiting, strictly left to right. There is no operator precedence."

## DEC-004 - Number display formatting rules

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Round displayed number to at most 10 significant digits; drop trailing zeros and decimal point; use exponential notation only when |n| ≥1e10 or |n|<1e-9; rounding happens only at render time
- Why: The prompt establishes these as standing rules for the rest of the project. Rounding only at the edge prevents corruption of calculated values through a chain.
- Rejected: Round stored values to 15 digits (previous toPrecision(15) approach) - Rounding compounds through chains and quietly corrupts results; 2 ÷ 3 × 3 would not equal exactly 2
- Evidence: "Round the displayed number to at most 10 significant digits. Drop trailing zeros after the decimal point, and drop a trailing decimal point. No thousands separators. Use exponential notation only when the magnitude is 1e10 or larger, or smaller than 1e-9. The rounding happens only when the number is rendered. The value the calculator stores and computes with is never rounded."

## DEC-005 - Division by zero error state

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Division by zero puts calculator into error state showing 'Error' with data-error='true'; only clear key works; clear resets to 0 and exits error state
- Why: The prompt establishes specific error handling behavior as a standing rule for the rest of the project.
- Rejected: none stated
- Evidence: "5 ÷ 0 = puts the calculator into an error state. The display shows Error. While in the error state every key is ignored except clear. Clear leaves the error state and resets the display to 0. calc-display must always carry data-error="true" or data-error="false"."

### Considered, not done (REQ-003, 2026-09-13)

- Store NaN in data-value when in error state - This was implemented as a necessary consequence of the error state specification, not a choice—the prompt did not specify what data-value should hold during error, so the assistant chose NaN. Evidence: "In the error state data-value is NaN, since you didn't specify it."

## DEC-006 - Reject phone-style % modifying pending operand

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: % divides current entry by 100 only
- Why: The requirement explicitly states 'divide the current entry by 100', not apply modulo logic to a pending operation like phone calculators do (200 + 10 % = 220).
- Rejected: Phone-style % that uses the pending operand (200 + 10 % = 220) - Violates the explicit requirement to divide the current entry by 100
- Evidence: "The request says divide the current entry by 100."

### Considered, not done (REQ-004, 2026-09-13)

- Test the new operations in a browser - The assistant checked logic by reading the code but did not open the page in a browser.. Evidence: "I checked the logic by reading it; I haven't opened the page in a browser."

## DEC-007 - Reject implicit multiplication with parentheses

- Date: 2026-09-13
- REQ: REQ-005
- Status: accepted
- Chose: Unmatched ( immediately after a number drops the number
- Why: Avoids complexity of inferring × before open parenthesis; simplifies parser and user model
- Rejected: Implied multiplication: 2 ( means 2 × - Adds parsing ambiguity and increases complexity of parenthesis handling
- Evidence: "I rejected implied multiplication, so `2 (` does not mean `2 ×`: it drops the 2."

## DEC-008 - % key must be removed entirely

- Date: 2026-09-13
- REQ: REQ-006
- Status: accepted
- Chose: Remove % key from keypad and all associated code
- Why: The % key generates support tickets because users expect it to mean 'percent of the other number' and it does not; the simplest solution is complete removal rather than implementation of expected behavior.
- Rejected: Implement % to calculate percent of the other number - User explicitly asked for the key to go, not for it to be fixed
- Evidence: "Take the `%` key off the keypad."

## DEC-009 - ± key must be preserved

- Date: 2026-09-13
- REQ: REQ-006
- Status: accepted
- Chose: Keep ± key fully operational with no changes
- Why: User stated 'Keep `±`. That one is fine and we still need it.'
- Rejected: none stated
- Evidence: "Keep `±`. That one is fine and we still need it."

### Considered, not done (REQ-006, 2026-09-13)

- Browser testing - Assistant did not open the page in a browser to visually verify the layout changes, stating 'I haven't opened the page in a browser to check.'. Evidence: "I haven't opened the page in a browser to check."

## DEC-010 - Tape expression building and closed group representation

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Expression is built as keys are pressed; closed groups kept as one piece. A number typed before '(' is dropped from the row as it is from the maths. Result row shows the expression exactly as worked out.
- Why: The row then matches how the result was actually worked out, with no precedence (DEC-003). A number typed right before '(' is dropped from the row, as it is from the maths (DEC-007).
- Rejected: Including = sign or timestamp in the row - Would add information not present in the calculation process itself
- Evidence: "the expression is built as you press keys, with a closed group kept as one piece (`−( 2 + 3 )` after `±`). `2 + ( 3 × 4 ) =` shows as `2 + ( 3 × 4 )`, result 14. ... A number typed right before `(` is dropped from the row, as it is from the maths (DEC-007)."

## DEC-011 - Tape clear button placement

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Place the tape's Clear button below the keypad as part of the tape UI, separate from calculator keys
- Why: Placing it among the keys would cause it to stop working during an error state, which is undesirable
- Rejected: Put the tape's Clear button among the calculator keys - It would stop working during an error state
- Evidence: "putting the tape's Clear button among the keys, where it would stop working during an error"

### Considered, not done (REQ-007, 2026-09-13)

- Only add a row when a calculation actually produced a result (not on standalone = or division by zero) - This was implemented, not decided; it is a direct consequence of the requirement and the existing error handling. Evidence: "A row is added only when `=` has something to calculate, so `7 =` adds nothing. Division by zero adds nothing either."

## DEC-012 - Memory must respect number behaviour

- Date: 2026-09-13
- REQ: REQ-009
- Status: accepted
- Chose: Store exact value; display rounded to 10 digits
- Why: User explicitly stated 'Make sure memory respects the number behaviour we agreed on', referring to the existing number display rules (REQ-003, DEC-004)
- Rejected: Store rounded display value in memory - Violates the rule that stored values are never rounded
- Evidence: "Make sure memory respects the number behaviour we agreed on."

### Considered, not done (REQ-009, 2026-09-13)

- Place memory indicator inside the display element - Would change the display's text from being just the number; indicator placed outside instead. Evidence: "The indicator sits next to the display, not inside it, so the display's text is still just the number."
- Make M+ store the rounded number shown on screen - Breaks the rule that stored values are never rounded. Evidence: "I did not make M+ store the rounded number shown on screen, because that breaks the rule that stored values are never rounded."

## DEC-013 - Keyboard mapping for calculator input

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Digit keys and . type into entry; +, -, *, / are operators; Enter or = equals; Escape clears
- Why: User specified exact keyboard behaviour in the prompt for consistent input handling
- Rejected: none stated
- Evidence: "Digit keys and `.` type into the entry. - `+`, `-`, `*`, `/` are the four operators. - `Enter` or `=` is equals. - `Escape` is clear."

## DEC-014 - Scientific panel structure and test identifiers

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Panel is toggled by key-sci button; contains key-sqrt (√x), key-square (x²), key-recip (1/x); each acts on current entry immediately
- Why: User specified the exact test identifiers and behaviour: each operation executes at once on the entry
- Rejected: none stated
- Evidence: "- `data-testid="key-sci"` — a key that toggles a small scientific panel. - While the panel is open it offers `data-testid="key-sqrt"` (√x), `data-testid="key-square"` (x²) and `data-testid="key-recip"` (1/x). Each acts on the current entry immediately: `9 √` shows `3`."

### Considered, not done (REQ-010, 2026-09-13)

- Treat √ of a negative number as something other than Error - Assistant explicitly rejected this alternative. Evidence: "I rejected treating √ of a negative as anything other than Error"
- Let Enter also press a focused button - Assistant explicitly rejected this alternative to prevent Enter from triggering button clicks. Evidence: "I rejected treating √ of a negative as anything other than Error, and letting Enter also press a focused button"
