# Decisions

_Appended by product-record hooks. Do not edit by hand._

## DEC-001 - Single file constraint

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: One file: index.html. Inline CSS and JS. No frameworks, no build step, no CDN links, no network requests.
- Why: User stated this as a constraint that holds for the entire project
- Rejected: Multiple files (separate CSS/JS modules) - Violates the constraint; Using frameworks or CDN dependencies - Violates the constraint
- Evidence: "ONE file: `index.html`. Inline CSS and JS. No frameworks, no build step, no CDN links, no network requests."

## DEC-002 - Test contract attributes

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: Use exact data-testid attributes: todo-input, todo-add, todo-list, todo-item, todo-text, todo-delete
- Why: User specified these exact attributes as the grader contract
- Rejected: none stated
- Evidence: "the grader depends on these exact attributes, so use them verbatim"

### Considered, not done (REQ-001, 2026-09-13)

- Write automated tests - Not required by the prompt; would be logic testing on mostly DOM code. Evidence: "I didn't write a check, because the logic is almost all page code with little to test on its own."
- Pre-open and test in browser - Not part of the stated requirement; the prompt asks for the file to be built. Evidence: "I haven't opened it in a browser or run any tests."

## DEC-003 - Completed todos ordering rule

- Date: 2026-09-13
- REQ: REQ-002
- Status: accepted
- Chose: Completed todos always appear BELOW all active todos. Within each group, todos stay in insertion order (oldest first).
- Why: This is an explicit ordering requirement stated in the prompt as 'this is a decision, keep it for the rest of the project', establishing a standing rule for how the todo list must be ordered.
- Rejected: none stated
- Evidence: "Completed todos always appear BELOW all active todos. Within each group, todos stay in insertion order (oldest first)."

### Considered, not done (REQ-002, 2026-09-13)

- Persist the chosen filter to localStorage across page reloads - The implementation resets the filter to 'all' on reload, as stated in the assistant message: 'the chosen filter resets on reload'.. Evidence: "the chosen filter resets on reload"
- Run automated browser tests to verify the UI changes - The assistant performed only syntax checking of the script and did not open the page in a browser.. Evidence: "I only syntax-checked the script; I didn't open the page in a browser."

## DEC-004 - Due date storage and comparison format

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Store as plain YYYY-MM-DD string; treat as local calendar date; overdue means strictly before today's local date
- Why: The user stated this as a standing rule for the rest of the project to ensure consistent date handling without UTC conversion and correct overdue semantics.
- Rejected: Parse dates with new Date("YYYY-MM-DD") constructor - That constructor reads YYYY-MM-DD as UTC, conflicting with the local calendar date requirement; Exclude completed todos from overdue marking - The rule does not say to exclude completed todos, so they should remain overdue if their date is before today
- Evidence: "Store the due date as a plain `YYYY-MM-DD` string. - Treat it as a LOCAL calendar date. Do not convert it through UTC. - "Overdue" means the due date is strictly before today's local calendar date."

### Considered, not done (REQ-003, 2026-09-13)

- Parse dates with new Date("YYYY-MM-DD") - Would read dates as UTC, conflicting with the local calendar date requirement stated in the prompt. Evidence: "I didn't parse dates with `new Date("YYYY-MM-DD")`, since that reads them as UTC."
- Exclude completed todos from overdue marking - The rule does not say to exclude completed todos from being marked overdue. Evidence: "I didn't exclude completed todos from overdue, since your rule doesn't say to."

## DEC-005 - Priority values and colour scheme

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: low, med, high values with red for high, amber for med, grey for low
- Why: Requirement explicitly specifies these three priority levels and their colour assignments
- Rejected: none stated
- Evidence: "low, `med`, or `high`. Default is `med`. Colour-code the rows by priority: high is red, med is amber, low is grey."

## DEC-006 - Priority visualization via left stripe instead of row background tint

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: left stripe (5px border-left with colour) plus small label
- Why: Keeps high priority visually distinct from overdue rows, which already use red border and background
- Rejected: Tint the whole row background by priority - High would look the same as overdue rows (already red background); Sort todos by priority - The ordering rule (DEC-003) stays as it is
- Evidence: "A stripe keeps high priority and overdue apart. Todos saved earlier default to `med`"

### Considered, not done (REQ-004, 2026-09-13)

- Add a priority sort/reorder feature - Ordering rule (DEC-003) stays as is; sorting was explicitly rejected. Evidence: "Also rejected sorting by priority, because the ordering rule (DEC-003) stays as it is."

## DEC-007 - Priority sort order with insertion order preservation

- Date: 2026-09-13
- REQ: REQ-005
- Status: accepted
- Chose: Sort by priority (high, med, low) first; within same priority, preserve insertion order
- Why: The prompt establishes the exact sort order: high first, then med, then low, with insertion order maintained within each priority level
- Rejected: Sort by priority alone without preserving insertion order - Would not maintain insertion order within each priority level as required
- Evidence: "Todos should be sorted by priority, highest first — high, then med, then low. Within the same priority, keep insertion order."

## DEC-008 - Priority sort respects active/completed grouping

- Date: 2026-09-13
- REQ: REQ-005
- Status: accepted
- Chose: Apply priority sorting within active group and within completed group separately, keeping completed todos below active todos
- Why: DEC-003 (active todos first, completed below) must be preserved as the primary grouping, with priority sorting applied within each group to avoid breaking the invariant that active todos never appear below completed ones
- Rejected: Sort all todos by priority globally - Would violate DEC-003 by placing completed high-priority todos above active low-priority todos
- Evidence: "I rejected sorting by priority alone, because a completed high todo would then show above an active low one and break DEC-003."

### Considered, not done (REQ-005, 2026-09-13)

- Test the sorting in a browser - Out of scope for this turn; assistant deferred testing. Evidence: "I haven't tested it in a browser."

## DEC-009 - Priority display as neutral text label

- Date: 2026-09-13
- REQ: REQ-006
- Status: accepted
- Chose: Priority shown as plain grey text label without per-priority colours
- Why: Eliminates visual clash with the red overdue highlight. Keeps priorities visible and distinguishable while ensuring the overdue state remains clearly readable.
- Rejected: Tone down the priority colours - Muted colours would still compete with the red overdue highlight for visual attention; Remove the priority label entirely - Priorities still need to be visible to users
- Evidence: "I didn't try toning the colours down or removing the label, because muted colours would still compete with the red overdue highlight and priorities still need to be visible."

### Considered, not done (REQ-006, 2026-09-13)

- Check the changes in a browser - The assistant deferred this to later verification. Evidence: "I haven't checked it in a browser."

## DEC-010 - Blank edit saves as cancel instead of deletion

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Blank text on commit is treated as a cancel, keeping the old text
- Why: Prevents accidental deletion when saving an empty edit field
- Rejected: Delete the todo when saved blank - Could cause accidental data loss
- Evidence: "Blank text on commit is treated as a cancel, so editing never deletes a todo."

## DEC-011 - Search box placement outside add form

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Place search box outside the add form to prevent Enter from adding a todo
- Why: Pressing Enter in the search box should filter, not add a new todo
- Rejected: Include search box inside the add form - Pressing Enter in the search input would trigger the form submission and add a todo
- Evidence: "I also put the search box outside the add form, so pressing Enter in it doesn't add a todo."

### Considered, not done (REQ-007, 2026-09-13)

- Test the implementation in a browser - The assistant did not test in a browser. Evidence: "The script's syntax checks out, but I haven't tested it in a browser."

## DEC-012 - Bulk actions ignore current filter and search

- Date: 2026-09-13
- REQ: REQ-009
- Status: accepted
- Chose: Bulk actions operate on all todos in storage, not only visible ones
- Why: The assistant implemented both buttons to act on every todo regardless of filter or search state. This is a lasting rule for how bulk operations must work.
- Rejected: Make buttons work only on visible todos (filtered/searched) - Would require tracking visible state and could produce unexpected results when filters change
- Evidence: "Both buttons act on every todo, not only the ones the current filter or search shows."

### Considered, not done (REQ-009, 2026-09-13)

- Make mark-all button toggle back to incomplete when every todo is already done - Assistant explicitly did not implement this toggle behaviour. Evidence: "I didn't make "mark all" switch back to incomplete when every todo is already done."

## DEC-013 - Text field type coercion on todo load

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Missing or non-string text defaults to empty string
- Why: Search feature lowercases text; missing text breaks rendering. On save, text must always be a string to prevent downstream errors.
- Rejected: Allow null or undefined text values - Search lowercase operation fails on non-string types, breaking the entire list display
- Evidence: "if (typeof t.text !== 'string') t.text = t.text == null ? '' : String(t.text);"

## DEC-014 - Duplicate todo prevention on form submission

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Use only the form's native submit event; do not add a separate Enter key handler
- Why: The form already has a submit button that fires on Enter. A second handler would add every todo twice.
- Rejected: Add a separate Enter key event listener on the input field - Submits twice: once from the native form behavior and once from the custom key handler
- Evidence: "// [REQ-010] Enter in the todo input submits this form natively (it has a submit button), so no extra key handler; one would add twice."

### Considered, not done (REQ-010, 2026-09-13)

- Implement a separate Enter key handler for the todo input - The form already submits natively on Enter with its submit button; a second handler would cause duplicate additions. Evidence: "// [REQ-010] Enter in the todo input submits this form natively (it has a submit button), so no extra key handler; one would add twice."
