# Decisions

_Appended by product-record hooks. Do not edit by hand._

## DEC-001 - Project structure and constraints

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: Single index.html file with inline CSS and JS; no frameworks, build step, CDN links, or network requests; must work from filesystem
- Why: The user stated these as project-wide constraints that apply to all future work.
- Rejected: none stated
- Evidence: "ONE file: `index.html`. Inline CSS and JS. No frameworks, no build step, no CDN links, no network requests."

## DEC-002 - Test attribute names are verbatim

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: Use exact data-testid values: todo-input, todo-add, todo-list, todo-item, todo-text, todo-delete
- Why: The user explicitly stated 'use them verbatim' for the grader contract, making this a binding invariant for all future changes.
- Rejected: none stated
- Evidence: "the grader depends on these exact attributes, so use them verbatim"

### Considered, not done (REQ-001, 2026-09-13)

- Add automated test suite - Not applicable—the logic lives inside the HTML file and cannot be tested independently. Evidence: "I added no automated checks, because the logic lives inside the HTML file and can't be tested on its own."

## DEC-003 - Completed todos ordering rule

- Date: 2026-09-13
- REQ: REQ-002
- Status: accepted
- Chose: Completed todos always appear BELOW all active todos. Within each group, todos stay in insertion order (oldest first).
- Why: The prompt explicitly states this is a decision to keep for the rest of the project, making it a binding rule for all future changes.
- Rejected: none stated
- Evidence: "Completed todos always appear BELOW all active todos. Within each group, todos stay in insertion order (oldest first)."

## DEC-004 - Saved list order preservation on toggle

- Date: 2026-09-13
- REQ: REQ-002
- Status: accepted
- Chose: The saved list stays in insertion order; todos are not rearranged when toggled, only sorted during display rendering.
- Why: Preserving original insertion order in the saved state allows unchecked todos to return to their original position rather than losing it, supporting state reversibility.
- Rejected: Move todos in the saved list when toggled (promoting active todos to the top) - Unchecking a todo would lose its original insertion position permanently
- Evidence: "The saved list itself stays in the order todos were added, so un-checking a todo puts it back in its original place."

### Considered, not done (REQ-002, 2026-09-13)

- Persist the selected filter across page reload - Not implemented; the filter state is session-only and resets to 'All' on reload.. Evidence: "The filter is not saved, so a page reload goes back to "All"."

## DEC-005 - Due date storage and comparison rule

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Store the due date as a plain YYYY-MM-DD string. Treat it as a LOCAL calendar date. Do not convert it through UTC. Overdue means the due date is strictly before today's local calendar date. A todo due today is never overdue, at any time of day.
- Why: This is an explicit rule stated in the prompt for how dates must be stored and compared for the rest of the project.
- Rejected: Use new Date("YYYY-MM-DD") to parse dates - It reads the date as UTC and can shift it by a day
- Evidence: "Store the due date as a plain `YYYY-MM-DD` string. Treat it as a LOCAL calendar date. Do not convert it through UTC. "Overdue" means the due date is strictly before today's local calendar date. The comparison is date-only — a todo due today is never overdue, at any time of day."

### Considered, not done (REQ-003, 2026-09-13)

- Update overdue marks at midnight automatically - An open page won't update the overdue marks at midnight until something changes. Evidence: "The date input is in the add form only, and an open page won't update the overdue marks at midnight until something changes."
- Hide overdue marks for completed todos - The definition of overdue doesn't exclude completed todos, so they can still show as overdue. Evidence: "Completed todos can still show as overdue, since your definition doesn't exclude them."

## DEC-006 - Priority normalization rule

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: Any missing or invalid priority value normalizes to 'med'
- Why: Handles legacy todos without priority and invalid inputs consistently
- Rejected: none stated
- Evidence: "Priority is low, med or high; anything else (including missing) is med."

## DEC-007 - Styling overdue and priority together

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: Use left stripe for priority colour; keep overdue red border and background; light background for priority only
- Why: Preserves overdue visual prominence while showing priority information
- Rejected: Colour the whole background by priority alone - Would hide the overdue styling
- Evidence: "Overdue rows keep their red border and background, but the left stripe still shows the priority colour."

### Considered, not done (REQ-004, 2026-09-13)

- Test the code before submitting - Not done in this turn. Evidence: "I haven't run or tested it."

## DEC-008 - Priority sort order and insertion order preservation

- Date: 2026-09-13
- REQ: REQ-005
- Status: accepted
- Chose: high, then med, then low; within the same priority, keep insertion order
- Why: User requirement explicitly stated the sort order and preservation of insertion order as a standing rule.
- Rejected: Single sort across entire list mixing active and completed todos - Would put completed todos above active ones, breaking DEC-003
- Evidence: "Todos should be sorted by priority, highest first — high, then med, then low. Within the same priority, keep insertion order."

## DEC-009 - Default priority normalization for sorting

- Date: 2026-09-13
- REQ: REQ-005
- Status: accepted
- Chose: Missing priorities count as med when sorting
- Why: Ensures consistent sort behavior when priority field is absent; establishes invariant for all sorting operations.
- Rejected: Treat missing priority as low or high - Would create unpredictable sort results and inconsistent user experience
- Evidence: "Missing priorities count as med."

### Considered, not done (REQ-005, 2026-09-13)

- Single sort pass across completed and active todos together - Would violate DEC-003 (completed todos must stay below active ones). Evidence: "I rejected one sort across the whole list, because it would put completed todos above active ones and break DEC-003."

## DEC-010 - Priority displayed as grey text, not colour-coded

- Date: 2026-09-13
- REQ: REQ-006
- Status: accepted
- Chose: Priority shown as small grey text label ('High', 'Med', 'Low') with no background or border colours
- Why: Prevents colour clash with overdue highlight while keeping priorities visible. Any colour styling would still conflict with the red overdue indication.
- Rejected: Keep a toned-down priority colour stripe or background - Any colour would still clash with the overdue red highlight, making the list hard to read
- Evidence: "Priority now shows as small grey text ("High", "Med" or "Low") on each item, because the colour was the only place you could see it."

## DEC-011 - Blank text edit keeps original text

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Clearing the text in an inline edit keeps the old text and does not delete the todo
- Why: The user specified 'Clearing the text keeps the old text, and I didn't make it delete the todo' in the assistant message, confirming the expected behaviour
- Rejected: Delete the todo when text is cleared - User explicitly stated this should not happen; blank submissions preserve the original text; Delete the todo when text is cleared and submitted - Dangerous destructive action; user requirement is to preserve on blank submission
- Evidence: "Clearing the text keeps the old text, and I didn't make it delete the todo"

## DEC-012 - Search does not trim spaces from input

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Search matching uses the exact search term without trimming whitespace
- Why: The assistant explicitly documented this behaviour in the message: 'doesn't trim spaces' in the search implementation
- Rejected: Trim spaces from search term before matching - Would lose the ability to search for text with leading or trailing spaces, and doesn't match the documented implementation
- Evidence: "doesn't trim spaces"

## DEC-013 - Bulk actions apply to all todos regardless of visibility

- Date: 2026-09-13
- REQ: REQ-009
- Status: accepted
- Chose: Apply bulk actions to all todos in the saved list, not just visible ones
- Why: The assistant explicitly chose not to limit actions to visible (filtered/searched) todos, stating this approach in the message.
- Rejected: Limit bulk actions to visible todos only - Would require tracking which todos match current filter and search state before applying the action
- Evidence: "I didn't limit the actions to visible todos"

### Considered, not done (REQ-009, 2026-09-13)

- Make Mark all complete a toggle that can un-complete todos - The assistant chose not to implement this; the button never un-completes a todo once clicked.. Evidence: "I didn't make "Mark all" a toggle"

## DEC-014 - Slash shortcut does not fire while typing in text fields or with modifier keys

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: / fires only when no text field or modifier key is active
- Why: Prevents interfering with user text input and standard browser shortcuts (Ctrl, Cmd, Alt). Allow slash to fire when checkbox or button has focus.
- Rejected: / fires even while typing in text fields - Would interfere with user ability to type forward-slash characters; / never fires when any form control has focus - Would prevent quick search activation from checkboxes or buttons, reducing usability
- Evidence: "It doesn't fire while you type in a text field, date, dropdown or the edit box, or with Ctrl, Cmd or Alt held. When a checkbox or button has focus, it still jumps."

### Considered, not done (REQ-010, 2026-09-13)

- Run the app or automated tests to verify functionality - Assistant did not run the app or tests; only read the code. Evidence: "I didn't run the app or any tests."
