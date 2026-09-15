# Decisions

_Appended by product-record hooks. Do not edit by hand._

## DEC-001 - Single file constraint with no external dependencies

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: One file index.html with inline CSS and JS, no frameworks, no build step, no CDN links, no network requests
- Why: User stated as a project-wide constraint that must be maintained for all future changes
- Rejected: Separate CSS and JS files - Violates the one-file constraint; External frameworks or CDN links - Violates the no-network-requests and no-framework constraints
- Evidence: "ONE file: `index.html`. Inline CSS and JS. No frameworks, no build step, no CDN links, no network requests."

## DEC-002 - Exact test attribute names required

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: Use verbatim data-testid attributes: calc-display, key-0 through key-9, key-dot, key-add, key-sub, key-mul, key-div, key-equals, key-clear; data-value holds exact current value as String(value)
- Why: Grader depends on these exact attributes; later test sessions cannot be modified and must match these names precisely
- Rejected: none stated
- Evidence: "Test contract — the grader depends on these exact attributes, so use them verbatim"

### Considered, not done (REQ-001, 2026-09-13)

- Add a check/ folder for test files - Project must stay one file; the logic lives inside index.html. Evidence: "I added no `check/` folder, because the project must stay one file and the logic lives inside it."

## DEC-003 - Immediate execution without operator precedence

- Date: 2026-09-13
- REQ: REQ-002
- Status: accepted
- Chose: Calculator uses immediate execution with strict left-to-right evaluation and no operator precedence
- Why: This is how a pocket calculator works and keeps the running display honest—the number on screen is always a real result the user can read and act on. If operations were deferred, the display would show a number the calculator was not actually going to use.
- Rejected: Defer operations to apply operator precedence - The display would show a number the calculator was not actually going to use, making the running display dishonest
- Evidence: "The calculator uses immediate execution. Each operator key finishes the operation already waiting, strictly left to right. There is no operator precedence. `2 + 3 × 4 =` is `20`, not `14`."

### Considered, not done (REQ-002, 2026-09-13)

- Add operator precedence logic - The user's decision established immediate execution as the rule for the rest of the project. Evidence: "This holds for the rest of the project"
- Write automated tests for the chaining logic - The logic lives inside the page script and cannot be tested in isolation. Evidence: "the logic lives inside the page script and can't be tested in a few lines"

## DEC-004 - Number display formatting rules

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Round displayed numbers to at most 10 significant digits, drop trailing zeros after decimal point and trailing decimal point, no thousands separators, use exponential notation only when magnitude is >= 1e10 or < 1e-9, and rounding happens only at render time
- Why: The prompt explicitly states these rules apply for the rest of the project, with examples and a reasoning section explaining that rounding stored values compounds and corrupts results
- Rejected: none stated
- Evidence: "Round the displayed number to at most 10 significant digits. Drop trailing zeros after the decimal point, and drop a trailing decimal point. ...No thousands separators. Use exponential notation only when the magnitude is 1e10 or larger, or smaller than 1e-9. The rounding happens only when the number is rendered. The value the calculator stores and computes with is never rounded...Reason: rounding what we store compounds through a chain and quietly corrupts later results."

## DEC-005 - Division by zero error handling

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Division by zero puts the calculator into an error state; display shows 'Error'; while in error state every key except clear is ignored; clear leaves error state and resets display to '0'; data-error attribute is always 'true' or 'false'
- Why: The prompt explicitly specifies this behavior as a requirement for the rest of the project
- Rejected: none stated
- Evidence: "`5 ÷ 0 =` puts the calculator into an error state. The display shows `Error`. While in the error state every key is ignored except clear. Clear leaves the error state and resets the display to `0`. `calc-display` must always carry `data-error="true"` or `data-error="false"`."

### Considered, not done (REQ-003, 2026-09-13)

- Keep rounding in compute function - The user rule requires rounding only at render time to prevent value corruption in chained calculations. Evidence: "Rejected: keeping any rounding in `compute`"
- Use toLocaleString for number formatting - toLocaleString adds thousands separators, which violates the formatting rule. Evidence: "Rejected: ...using `toLocaleString` (it adds thousands separators)"
- Keep data-value as NaN in error state - The error state design requires proper data-error attribute tracking instead. Evidence: "In the error state `data-value` stays `NaN`."

## DEC-006 - Sign and percent operations without entry in progress

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: With no entry in progress (e.g., right after a result), ± and % act on the number on screen. That number then becomes the current entry, so the next operator uses it and the next digit starts a new number.
- Why: Ensures consistent behavior: operations can always be applied to visible values, and the result feeds seamlessly into subsequent operations or new entries, matching common calculator behavior.
- Rejected: Percent relative to pending operand (e.g., 200 + 5 % giving 210) - The requirement specifies % only divides the entry by 100, so this would give 200.05 instead, violating the spec.
- Evidence: "With no entry in progress (say, right after a result), ± and % act on the number on screen. That number then becomes the current entry, so the next operator uses it, and the next digit starts a new number."

## DEC-007 - Percent result formatting

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: A % result is rounded only on screen, per DEC-004.
- Why: Maintains consistency with existing display formatting rules and ensures internal precision while showing formatted output.
- Rejected: none stated
- Evidence: "A % result is rounded only on screen, per DEC-004."

### Considered, not done (REQ-004, 2026-09-13)

- Browser testing of the new keys - Script was checked in Node with simulated key presses instead. Evidence: "I checked this by running the calculator's script in Node with simulated key presses, not in a browser."

## DEC-008 - Hidden operations prohibited in group handling

- Date: 2026-09-13
- REQ: REQ-005
- Status: accepted
- Chose: Reject treating '5 (' as '5 × ('
- Why: A key should never perform a hidden operation; each keystroke must only do what the user explicitly pressed
- Rejected: Treat '5 (' as '5 × (' (implicit multiplication) - Performs a hidden operation not explicitly initiated by the user
- Evidence: "a key should never do a hidden operation"

### Considered, not done (REQ-005, 2026-09-13)

- Add standing browser-based test to verify parentheses calculations - Assistant checked calculations with a throwaway script instead, not adding a standing check to the codebase. Evidence: "I checked these with a quick throwaway script, not in a browser, and added no standing check"

## DEC-009 - Percent key removal requirement

- Date: 2026-09-13
- REQ: REQ-006
- Status: accepted
- Chose: Remove the % key entirely from keypad and disable its keyboard shortcut
- Why: Users expect % to mean 'percent of the other number' which the calculator does not support, generating support tickets.
- Rejected: Keep the % key on the keypad - Continues to generate support tickets from users with incorrect expectations; Keep the % keyboard shortcut - Allows percent operation through another input method, defeating the purpose of removal; Make % mean 'percent of the other number' - Would require implementing percent-of functionality that the calculator does not currently support
- Evidence: "The `%` key is generating support tickets. People expect it to mean "percent of the other number" and it does not. Take the `%` key off the keypad."

## DEC-010 - Keep ± key functional

- Date: 2026-09-13
- REQ: REQ-006
- Status: accepted
- Chose: Retain the ± key on the keypad and maintain its functionality
- Why: The ± key is working correctly and remains necessary for the calculator.
- Rejected: none stated
- Evidence: "Keep `±`. That one is fine and we still need it."

### Considered, not done (REQ-006, 2026-09-13)

- Open the page in a browser to verify the changes - Assistant noted this was not completed: 'I haven't opened the page in a browser to check it.'. Evidence: "I haven't opened the page in a browser to check it."

## DEC-011 - Expression reconstruction in tape preserves groups and signs

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Write expression as typed, preserving closed brackets and signs, not rebuilding from result
- Why: Rebuilding from the result would lose grouping information and any ± applied to a group
- Rejected: Reconstruct expression from the computed result - Would lose the grouping brackets and signs applied to groups
- Evidence: "I rejected rebuilding the expression afterwards from the result, because that would lose the groups and a `±` on a group (`-(2 + 3)`)"

## DEC-012 - Tape persistence across AC and calculation reset

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Tape is maintained separately from calculator state; AC clears state but not tape
- Why: The tape requirement states clearing the tape does not change the display, implying they are independent and AC should not wipe history
- Rejected: Reset tape when AC is pressed - Contradicts the requirement that clearing tape is a separate action via the Clear button
- Evidence: "AC keeps the tape, and the tape's Clear button leaves the display alone"

### Considered, not done (REQ-007, 2026-09-13)

- Test the tape in a browser before delivery - Assistant deferred browser testing pending completion. Evidence: "A syntax check of the script passed, but I have not tried the tape in a browser"

## DEC-013 - Memory holds full-precision value; display-only rounding

- Date: 2026-09-13
- REQ: REQ-009
- Status: accepted
- Chose: Memory stores the unrounded, full-precision value internally; rounding only occurs when presenting on screen
- Why: Ensures memory preserves complete numeric information for subsequent calculations, consistent with the calculator's number behaviour already established
- Rejected: Memory stores pre-rounded display value - Would lose precision for future calculations, breaking consistency with how the calculator internally maintains full values
- Evidence: "memory keeps the full value and only rounds when shown on screen"

## DEC-014 - AC preserves memory state

- Date: 2026-09-13
- REQ: REQ-009
- Status: accepted
- Chose: AC (clear) does not clear memory, only the display and entry state, consistent with not clearing history
- Why: Maintains memory as a persistent state across AC operations, parallel to tape history persistence already established
- Rejected: AC clears both display and memory - Would be inconsistent with the established pattern that AC doesn't clear the history/tape
- Evidence: "AC doesn't clear memory, just as it doesn't clear the history"

### Considered, not done (REQ-009, 2026-09-13)

- Add keyboard shortcuts for memory keys - Not requested in the requirement. Evidence: "there are no keyboard shortcuts for the memory keys, since you didn't ask for them"

## DEC-015 - Keyboard entry specification

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Digit keys and `.` type into entry; `+`, `-`, `*`, `/` are operators; `Enter` or `=` equals; `Escape` clears
- Why: The user stated the complete keyboard entry specification as a requirement to verify
- Rejected: none stated
- Evidence: "Digit keys and `.` type into the entry. - `+`, `-`, `*`, `/` are the four operators. - `Enter` or `=` is equals. - `Escape` is clear."

## DEC-016 - Scientific panel UI structure and test IDs

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Panel with data-testid="key-sci" toggle, containing key-sqrt (√x), key-square (x²), key-recip (1/x)
- Why: The user specified exact test IDs and labels for the scientific panel and its buttons
- Rejected: none stated
- Evidence: "`data-testid="key-sci"` — a key that toggles a small scientific panel. - While the panel is open it offers `data-testid="key-sqrt"` (√x), `data-testid="key-square"` (x²) and `data-testid="key-recip"` (1/x). Each acts on the current entry immediately: `9 √` shows `3`."

### Considered, not done (REQ-010, 2026-09-13)

- Hide the panel on AC - The assistant explicitly rejected this to keep the panel state independent of calculator state. Evidence: "The panel is not part of state, so AC leaves it open or closed."
- Allow panel keys to work while panel is closed - The assistant explicitly rejected this by adding a guard that prevents unary operations when the panel is hidden. Evidence: "if ((key === 'sqrt' || key === 'square' || key === 'recip') && sciPanel.hidden) return;"
