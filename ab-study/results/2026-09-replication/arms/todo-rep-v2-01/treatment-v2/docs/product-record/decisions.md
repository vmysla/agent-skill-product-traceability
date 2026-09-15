# Decisions

_Appended by product-record hooks. Do not edit by hand._

## DEC-001 - Single file constraint for entire project

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: ONE file: index.html with inline CSS and JS, no frameworks, no build step, no CDN links, no network requests
- Why: User stated this as a standing constraint that applies to the entire project
- Rejected: Multiple files (HTML, CSS, JS) - Violates the one-file constraint; External frameworks or CDN links - Violates the no frameworks and no CDN links constraint; Build step or transpilation - Violates the no build step constraint
- Evidence: "ONE file: `index.html`. Inline CSS and JS. No frameworks, no build step, no CDN links, no network requests."

## DEC-002 - Exact test attribute names

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: Use verbatim test attributes: data-testid="todo-input", data-testid="todo-add", data-testid="todo-list", data-testid="todo-item", data-testid="todo-text", data-testid="todo-delete"
- Why: User specified these exact attributes as test contract that grader depends on
- Rejected: none stated
- Evidence: "Test contract — the grader depends on these exact attributes, so use them verbatim"

### Considered, not done (REQ-001, 2026-09-13)

- Browser testing or running tests - Assistant noted not having opened it in a browser or run any tests, and skipped testing logic that would require a simulated browser, which the rules don't allow. Evidence: "I haven't opened it in a browser or run any tests."

## DEC-003 - Ordering rule: completed todos below active

- Date: 2026-09-13
- REQ: REQ-002
- Status: accepted
- Chose: Completed todos always appear BELOW all active todos. Within each group, todos stay in insertion order (oldest first).
- Why: The prompt explicitly states this as a rule to keep for the rest of the project.
- Rejected: none stated
- Evidence: "Completed todos always appear BELOW all active todos. - Within each group, todos stay in insertion order (oldest first)."

## DEC-004 - Preserve original insertion order in saved list

- Date: 2026-09-13
- REQ: REQ-002
- Status: accepted
- Chose: Completed todos are moved below active ones when the list is drawn; unchecking a todo puts it back in its original place in the saved list.
- Why: This preserves insertion order across completions and reversals, allowing a toggled todo to return to its original position.
- Rejected: Move completed todos to the end of the saved list - unchecking one would then lose its original place
- Evidence: "the saved list stays in the order todos were added. Completed todos are moved below active ones when the list is drawn, so unchecking a todo puts it back in its original place."

### Considered, not done (REQ-002, 2026-09-13)

- Test the implementation in a browser - The assistant only checked that the script parses and did not verify actual functionality in a browser.. Evidence: "I only checked that the script parses; I haven't clicked through it in a browser."

## DEC-005 - Date storage and overdue comparison rules

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Store due dates as plain YYYY-MM-DD strings; treat as LOCAL calendar dates without UTC conversion; overdue means due date is strictly before today's local calendar date; date-only comparison—a todo due today is never overdue
- Why: User established this as a standing decision for the rest of the project to prevent timezone shifts and ensure consistent overdue logic across all future work
- Rejected: Use Date constructor (new Date) with YYYY-MM-DD parsing - Reads dates as UTC and can shift the date by one day depending on timezone; Use date-parsing library - Unnecessary complexity and potential timezone confusion
- Evidence: "Store the due date as a plain `YYYY-MM-DD` string. Treat it as a LOCAL calendar date. Do not convert it through UTC. "Overdue" means the due date is strictly before today's local calendar date. The comparison is date-only — a todo due today is never overdue, at any time of day."

## DEC-006 - Overdue includes completed todos

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Any todo dated before today counts as overdue, regardless of completion status
- Why: Established from implementation without explicit exclusion in requirements; consistent with treating overdue as a date property independent of todo state
- Rejected: none stated
- Evidence: "any todo dated before today counts as overdue, even if it's completed"

### Considered, not done (REQ-003, 2026-09-13)

- Run the app to test the implementation - Assistant deferred testing to a later session. Evidence: "I haven't run the app to test it"

## DEC-007 - Priority normalization rule

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: Invalid or missing priority values default to 'med'
- Why: Ensures backwards compatibility with older todos that have no saved priority, and guards against unexpected values.
- Rejected: Reject todos with invalid priority values - Would break older todos lacking the priority field; Pick a different default fallback - Med was specified in the requirement as the default
- Evidence: "Only low, med or high; anything else (including older todos) is med."

## DEC-008 - Priority visual implementation: left stripe vs row tinting

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: Left stripe (4px border-left) instead of tinting the whole row
- Why: Left stripe keeps its own colour and displays correctly with red overdue background, avoiding visual clash.
- Rejected: Tint the entire row background by priority - Would clash with the existing red overdue background when both apply
- Evidence: "I didn't tint the whole row by priority, because that would clash with the red overdue background."

### Considered, not done (REQ-004, 2026-09-13)

- Open the app in a browser to verify visual rendering - Assistant deferred manual testing. Evidence: "I haven't opened it in a browser."

## DEC-009 - Priority sort order and insertion order preservation

- Date: 2026-09-13
- REQ: REQ-005
- Status: accepted
- Chose: Todos sorted high, then med, then low; same priority keeps insertion order
- Why: User explicitly stated this as the sorting requirement. This must be enforced every time todos are ordered.
- Rejected: none stated
- Evidence: "Todos should be sorted by priority, highest first — high, then med, then low. Within the same priority, keep insertion order."

## DEC-010 - Priority sort applies within active/completed groups separately

- Date: 2026-09-13
- REQ: REQ-005
- Status: accepted
- Chose: Apply priority sort to active todos and completed todos as independent groups
- Why: The prompt did not override DEC-003 (completed todos below active), so this rule remains. The new priority sort must respect the existing grouping, sorting only within each group to avoid placing completed high-priority todos above active low-priority ones.
- Rejected: Single priority sort across all todos regardless of completion status - Would place a completed high-priority todo above an active low-priority todo, violating DEC-003
- Evidence: "Completed todos still sit below active ones (DEC-003), and the priority sort applies within each of those two groups."

### Considered, not done (REQ-005, 2026-09-13)

- Change storage format of todos in the saved list - The prompt only specified display sorting behavior, not storage changes. The assistant explicitly retained the saved list unchanged.. Evidence: "The saved list is unchanged"

## DEC-011 - Priority display as plain text label

- Date: 2026-09-13
- REQ: REQ-006
- Status: accepted
- Chose: Priority shown as uncoloured plain grey text label positioned alongside other metadata
- Why: Without the stripe, priority would only be visible through sort position; a text label preserves explicit priority visibility.
- Rejected: Remove colour with no label - Priority would only be inferrable from sort order, not explicitly visible; Any other colour scheme - Would continue to clash with or complicate the overdue visual treatment
- Evidence: "Each todo now shows its priority as plain grey text ("High", "Med", "Low")"

## DEC-012 - Search matching behavior

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Search is case-insensitive and matches literal text including spaces; search does not persist across sessions
- Why: Establishes the technical behavior of the search feature that future changes must maintain.
- Rejected: Normalize whitespace or trim spaces in search matching - Would match differently than what user types, creating inconsistency
- Evidence: "Search is not saved and matches the literal text you type, spaces included."

## DEC-013 - Blank edit behavior

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Blank edits preserve the original todo text instead of deleting the todo
- Why: The assistant explicitly chose this approach over deletion, making it a decision that future sessions might reconsider.
- Rejected: Delete the todo when a blank text is saved - Would lose data if user accidentally clears the field and saves
- Evidence: "If you save a blank edit, the todo keeps its old text; I chose that over deleting the todo."

### Considered, not done (REQ-007, 2026-09-13)

- Test the inline editing and search features in a browser - Assistant verified only that the script's syntax checks out but explicitly stated 'I haven't tried either feature in a browser.'. Evidence: "The script's syntax checks out, but I haven't tried either feature in a browser."

## DEC-014 - Bulk actions scope: all todos vs filtered view

- Date: 2026-09-13
- REQ: REQ-009
- Status: accepted
- Chose: Both buttons act on every todo, not just the ones the current filter or search is showing
- Why: Bulk actions apply to the entire dataset, making them more predictable and less error-prone than operating only on visible/filtered todos
- Rejected: Bulk actions only affect todos shown by current filter or search - Could accidentally clear or mark complete fewer todos than user expects, leading to confusion about what 'all' means
- Evidence: "Both buttons act on every todo, not just the ones the current filter or search is showing."

### Considered, not done (REQ-009, 2026-09-13)

- Browser testing of the implemented buttons - Not performed in this session. Evidence: "I haven't run the page in a browser to check them."

## DEC-015 - Edit field focus preservation across re-renders

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Edit field must regain focus after every render if an edit is in progress
- Why: Ensures that keyboard handlers (Enter, Escape, blur) continue to work even after tab refocus or other re-renders, so the user's edit session is not interrupted.
- Rejected: Move focus logic into the startEdit function only - Focus is lost when the page re-renders (e.g. tab visibility change, other state updates), breaking Edit, Escape and blur handlers mid-edit.
- Evidence: "The edit box now gets focus back after every redraw."

## DEC-016 - Separate Enter handler on todo input avoided

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Do not add a separate Enter keydown handler to the todo input
- Why: A separate handler would fire in addition to the form's native submit, adding the todo twice. The form's native submit already handles the requirement.
- Rejected: Add a separate Enter keydown handler on the todo input - Would add the todo twice (once from the handler, once from form submit).
- Evidence: "Rejected: a separate Enter handler on the todo box, because it would add the todo twice."

### Considered, not done (REQ-010, 2026-09-13)

- Run the app to test keyboard shortcuts and regressions - The assistant performed only a syntax check; no runtime testing was conducted.. Evidence: "I did not run the app; the only test was a syntax check of the script."
- Add automated tests for the new shortcuts and bug fix - The checks folder is empty, so no test infrastructure exists for earlier features or this one.. Evidence: "The checks folder is empty, so no earlier feature has an automated test."
