# Decisions

_Appended by product-record hooks. Do not edit by hand._

## DEC-001 - Constraint: single static HTML file, inline CSS and JS, offline

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: ONE file: index.html. Inline CSS and JS. No frameworks, no build step, no CDN links, no network requests. The app must work when opened directly from the filesystem.
- Why: The user stated this as a standing constraint that must hold for the entire project.
- Rejected: none stated
- Evidence: "ONE file: `index.html`. Inline CSS and JS. No frameworks, no build step, no CDN links, no network requests. The app must work when opened directly from the filesystem."

## DEC-002 - Test contract: exact attribute names and format

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: Use exact test attributes: data-testid='calc-display' with data-value holding String(value); digit keys as data-testid='key-0' through 'key-9'; data-testid='key-dot', 'key-add', 'key-sub', 'key-mul', 'key-div', 'key-equals', 'key-clear'.
- Why: The user stated these attributes are required for the grader and must be used verbatim.
- Rejected: none stated
- Evidence: "Test contract — the grader depends on these exact attributes, so use them verbatim"

### Considered, not done (REQ-001, 2026-09-13)

- Test the calculator in a browser - The assistant traced logic by hand for 7 + 8 = 15 and 1 2 3 → 123, but did not run it in a browser.. Evidence: "I haven't run it in a browser; I only traced `7 + 8 =` → `15` and `1 2 3` → `123` by hand."
- Round float results to hide floating-point noise - Rejected because data-value must be exactly String(value), so 0.1 + 0.2 displays the full precision 0.30000000000000004.. Evidence: "**Rejected:** rounding results to hide float noise. `0.1 + 0.2` shows `0.30000000000000004` because `data-value` has to be exactly `String(value)`."

## DEC-003 - Immediate execution model with no operator precedence

- Date: 2026-09-13
- REQ: REQ-002
- Status: accepted
- Chose: The calculator uses immediate execution. Each operator key finishes the operation already waiting, strictly left to right. There is no operator precedence. 2 + 3 × 4 = is 20, not 14.
- Why: The user established this as a standing rule for the rest of the project. It ensures the running display is always honest—the number on screen is always a real result the user can read and act on. If operations were deferred (like multiplying in 2 + 3 × 4), the display would show a number the calculator was not actually going to use.
- Rejected: Deferred execution with operator precedence - Would require deferring the multiply operation, causing the display to show a number the calculator is not actually going to use, making the running display dishonest
- Evidence: "The calculator uses immediate execution. Each operator key finishes the operation already waiting, strictly left to right. There is no operator precedence."

### Considered, not done (REQ-002, 2026-09-13)

- Add a standing check to enforce the no-precedence rule across the codebase - The compute function sits inside the HTML file and cannot be imported for external validation. Evidence: "I didn't add operator precedence (the rule you set) or a standing check, because `compute` sits inside the HTML file and can't be imported."

## DEC-004 - Number formatting rules and rounding at render time only

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Round displayed numbers to at most 10 significant digits; drop trailing zeros and decimal points; no thousands separators; use exponential notation only when |magnitude| ≥ 1e10 or < 1e-9; rounding happens only at render time, never in stored values or computations
- Why: Rounding at storage time compounds through calculation chains and silently corrupts results. Rounding belongs at the edge (render time) to preserve computation accuracy. For example, 2 ÷ 3 × 3 must equal exactly 2.
- Rejected: Round stored values during computation - Compounds rounding errors through calculation chains, silently corrupting results
- Evidence: "Round the displayed number to at most 10 significant digits... The rounding happens only when the number is rendered. The value the calculator stores and computes with is never rounded... Reason: rounding what we store compounds through a chain and quietly corrupts later results. `2 ÷ 3 × 3 =` must still be exactly `2`. Rounding is presentation, so it belongs at the edge, at render time, and nowhere else."

## DEC-005 - Division by zero and non-finite result handling

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Non-finite results (including division by zero and 0 ÷ 0) enter error state showing 'Error'; all keys are ignored except clear; clear resets to 0; data-error attribute tracks state
- Why: Clear error handling prevents undefined calculator state and accidental computation continuation. Error state must be explicit and resettable only by clear.
- Rejected: Allow typing to clear error state automatically - User loses explicit control over error recovery; unclear what state calculator is in
- Evidence: "`5 ÷ 0 =` puts the calculator into an error state. The display shows `Error`. While in the error state every key is ignored except clear. Clear leaves the error state and resets the display to `0`. `calc-display` must always carry `data-error="true"` or `data-error="false"`."

### Considered, not done (REQ-003, 2026-09-13)

- Handle 0 ÷ 0 differently from other division by zero cases - The implementation treats all non-finite results (including 0 ÷ 0) the same way as division by zero—entering error state. The prompt did not specify separate handling.. Evidence: "Any result that isn't a finite number also shows `Error`. That includes `0 ÷ 0` and results too large to hold."
- Store intermediate formatting or use a formatted value for data-value - The prompt explicitly requires data-value to carry the exact unrounded value to prevent rounding corruption through calculation chains.. Evidence: "The value the calculator stores and computes with is never rounded, and `data-value` on `calc-display` always carries that exact unrounded value."

## DEC-006 - Sign flip and percent behavior on finished values

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: New value becomes the right operand if operator is waiting; next digit starts a new number
- Why: Each key changes only the number on screen and the change is stored exactly. Allows expressions like 2+50%=to evaluate to 2.5.
- Rejected: iOS-style 50+%=25 (percent of the first number) - Goes beyond acting on the current entry; requires context of the first operand; 5+± showing -0 - Goes beyond acting on the current entry; creates unintuitive intermediate state
- Evidence: "each key changes only the number on screen, and the change is stored exactly. ... iOS-style `50 + %` = 25 (percent of the first number), and `5 + ±` showing `-0`. Both go beyond "act on the current entry"."

### Considered, not done (REQ-004, 2026-09-13)

- Test the ± and % keys in a browser to verify 5±→-5→5 and 50%→0.5 work as expected - Assistant explicitly stated they have not opened the implementation in a browser yet. Evidence: "I haven't opened it in a browser, so `5 ±` → `-5` → `5` and `50 %` → `0.5` are still untested."

## DEC-007 - Group operation execution semantics

- Date: 2026-09-13
- REQ: REQ-005
- Status: accepted
- Chose: ( saves pending operation and starts new group; ) evaluates group and uses result as next operand; = closes all open groups; ) with no open group is ignored; AC and errors clear all groups
- Why: Preserves the existing left-to-right model (DEC-003) and error rules (DEC-005)
- Rejected: Treat 2 ( as 2 × ( (implicit multiplication before grouping) - Request did not ask for it; simpler to make ( just replace the number on screen
- Evidence: ""(" saves the pending operation and starts a new group; ")" works out the group and uses its value as the next number. "=" closes any open groups. A ")" with no open group does nothing. AC and errors clear all groups."

### Considered, not done (REQ-005, 2026-09-13)

- Implicit multiplication when ( follows a number (e.g., treat 2 ( as 2 × () - Request did not ask for it. Evidence: "Rejected: treating `2 (` as `2 × (`, since the request didn't ask for it"

## DEC-008 - Keypad layout adjustment for removed percent key

- Date: 2026-09-13
- REQ: REQ-006
- Status: accepted
- Chose: Make AC button two keys wide to fill the space left by the removed `%` key
- Why: Prevents an empty gap in the keypad layout and maintains visual balance of the row
- Rejected: Leave an empty gap where the `%` key was - Creates visual inconsistency and incomplete keypad appearance; Keep the percent code with no key to trigger it - Dead code that serves no purpose and creates maintenance confusion
- Evidence: "made AC two keys wide so the row stays full"

### Considered, not done (REQ-006, 2026-09-13)

- Test the changes in a browser - Assistant explicitly chose not to perform browser testing. Evidence: "I have not opened it in a browser"

## DEC-009 - Tape rows created only for real calculations via equals

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: A row is added only when equals completes a real calculation; Error states and lone number entries add nothing
- Why: Ensures tape records only computations that yield a result, avoiding spurious rows for intermediate errors or incomplete expressions
- Rejected: Adding 'Error' rows to tape - Would pollute tape with non-computation states, obscuring actual calculated history; Putting '=' or timestamps in row text - Violates tape row spec: 'Nothing else — no timestamps'; equals is added by CSS only
- Evidence: "nothing gets a row unless `=` finishes a real calculation, so dividing by zero (Error) or pressing `=` on a single number adds nothing"

## DEC-010 - Operator replacement and group sign representation on tape

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: When an operator is pressed right after another, only the final operator shows on tape; ± on a group displays as -( … )
- Why: Tape captures what the calculator actually computed, not intermediate editing states; flipped groups render accurately as negated expressions
- Rejected: none stated
- Evidence: "An operator pressed right after another replaces it on the tape, and `±` on a group shows as `-( … )`"

### Considered, not done (REQ-007, 2026-09-13)

- Placing tape below the display instead of above - Implementation detail; assistant chose above per the UI hierarchy; not a decision rule for future changes. Evidence: "rows appear above the display"
- Using a scrollbar vs. overflow-y: auto for max-height 132px - CSS implementation choice specific to this layout; not a constraint future work must honor. Evidence: "max-height: 132px; overflow-y: auto;"

## DEC-011 - Memory respects number behaviour

- Date: 2026-09-13
- REQ: REQ-009
- Status: accepted
- Chose: Memory stores exact values, rounded only when displayed
- Why: The prompt stated 'Make sure memory respects the number behaviour we agreed on.' The existing DEC-004 established that rounding happens at render time only. This rule ensures memory follows the same pattern.
- Rejected: Store rounded display text in memory - Breaks the agreed rounding rule that rounding happens only at render time
- Evidence: "Make sure memory respects the number behaviour we agreed on."

## DEC-012 - Memory indicator visibility state

- Date: 2026-09-13
- REQ: REQ-009
- Status: accepted
- Chose: Dim the indicator with opacity instead of hiding it
- Why: Keeps the indicator always on screen for visual consistency and prevents layout shift, improving the user experience.
- Rejected: Hide the indicator when memory is zero - Causes layout shift and makes the indicator disappear from the DOM flow
- Evidence: "I dimmed the indicator instead of hiding it, so it is always on screen."

### Considered, not done (REQ-009, 2026-09-13)

- AC (clear all) should also clear memory - The prompt did not request this; the assistant correctly preserved the prior decision that AC leaves memory alone. Evidence: "AC leaves memory alone."

## DEC-013 - Scientific functions create history rows

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: √, square, and reciprocal operations generate history rows the same way equals does
- Why: The assistant explicitly decided that these are real calculations (not single numbers), so they warrant tape history. This is a standing invariant about how the history feature must behave going forward.
- Rejected: Treat scientific functions as single-number operations with no history row - Would be inconsistent with user expectation that all calculations show in history
- Evidence: "I decided the √ is a real calculation rather than "a single number", which the history rule says gets no row."

## DEC-014 - No additional keyboard shortcuts beyond requirement

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Keyboard entry limited to digits, `.`, operators, `Enter`/`=`, and `Escape`
- Why: The assistant explicitly chose not to add Backspace or parentheses keys, constraining the keyboard interface to only what was requested.
- Rejected: Add Backspace key for digit entry correction - Not requested in the requirement; Add keyboard shortcuts for parentheses - Not requested in the requirement
- Evidence: "I chose not to add extra keys (Backspace, parentheses) beyond what you asked for."

### Considered, not done (REQ-010, 2026-09-13)

- Add extra scientific functions (sin, cos, log, etc.) - Only √x, x², and 1/x were requested. Evidence: "While the panel is open it offers `data-testid="key-sqrt"` (√x), `data-testid="key-square"` (x²) and `data-testid="key-recip"` (1/x)."
- Make the scientific panel open by default - Requirement specifies compact mode starts closed. Evidence: "Compact scientific mode"
