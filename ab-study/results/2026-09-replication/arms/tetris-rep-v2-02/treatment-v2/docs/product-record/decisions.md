# Decisions

_Appended by product-record hooks. Do not edit by hand._

## DEC-001 - One file constraint: single HTML with inline CSS and JS

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: index.html with all CSS and JavaScript inlined, no external files or build step
- Why: User constraint stated explicitly for the entire project
- Rejected: Separate CSS and JavaScript files - Violates the one-file constraint; Use a framework or build tool - Explicitly forbidden; no frameworks, no build step
- Evidence: "ONE file: `index.html`. Inline CSS and JS. No frameworks, no build step, no CDN links, no network requests."

## DEC-002 - Synchronous rendering: DOM updated immediately on state change

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: All state changes update DOM synchronously; no requestAnimationFrame or deferred timers
- Why: User constraint stated for the entire project: grader reads DOM immediately after driving game state
- Rejected: Use requestAnimationFrame for rendering - Grader reads DOM immediately; deferred draw never arrives; Use timers to defer updates - Test cannot see updated state when it reads DOM immediately
- Evidence: "Rendering must be synchronous. After any state change the DOM must already show the new state. Do not defer drawing to `requestAnimationFrame` or to a timer"

### Considered, not done (REQ-001, 2026-09-13)

- Rotation of falling pieces - Not requested in requirements. Evidence: "I left out rotation, a hold piece and points for drops because they weren't asked for."
- Hold piece feature - Not requested in requirements. Evidence: "I left out rotation, a hold piece and points for drops because they weren't asked for."
- Points for soft drop or hard drop - Not requested in requirements. Evidence: "I left out rotation, a hold piece and points for drops because they weren't asked for."

## DEC-003 - Clearing together must beat clearing separately

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Points for a clear depend on rows cleared at once: 1 row = 100, 2 rows = 300, 3 rows = 500, 4 rows = 800, multiplied by level. Clearing rows together must always beat clearing the same rows one at a time.
- Why: The user stated this is a decision to keep for the rest of the project, and provided a game design rationale: if split clearing scored as well as or better than simultaneous clearing, players would have no incentive to build stacks, removing strategic depth from the game.
- Rejected: Additive scoring (same points regardless of whether rows are cleared together or separately) - Players would have no reason to build stacks; the game loses its strategic shape
- Evidence: "The reason for the table: clearing rows together must always beat clearing the same rows one at a time. If it does not, there is no reason for a player to ever build a stack, and the game has no shape."

## DEC-004 - Drop action point scoring

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Soft drop scores 1 point per cell moved; hard drop scores 2 points per cell dropped. Gravity does not award points, and soft drop awards points only when the piece actually moves.
- Why: This adds skill-based scoring for player-controlled drops while avoiding free points from gravity or failed input attempts.
- Rejected: Award points when soft drop is pressed even if the piece cannot move - Players gain points for invalid input; no connection between action and reward; Award points for gravity-driven piece movement - Removes player agency from scoring; passive play is rewarded equally to active play
- Evidence: "Soft drop scores 1 point for each cell the piece moves down under the player's control. Hard drop scores 2 points for each cell the piece drops."

### Considered, not done (REQ-003, 2026-09-13)

- Test the game by playing it - Assistant stated it has not played the game to test the implementation. Evidence: "I have not played the game to test any of this."

## DEC-005 - Preview piece container structure

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: Each preview item is a 4x2 grid container with `data-piece` attribute on the item itself, with eight child mini-cells carrying the piece's colour
- Why: Allows the preview item to display only when a piece is queued (via `hidden` attribute on the item element) while mini-cells can independently carry colour data for the rendered shape
- Rejected: Colour the entire item box by type - The board colours individual cells, not boxes; this would be inconsistent with the board's design pattern
- Evidence: "The item box itself stays transparent, so only the piece shape is coloured."

## DEC-006 - Shared lock-restart budget for sideways and soft-drop

- Date: 2026-09-13
- REQ: REQ-005
- Status: accepted
- Chose: Sideways moves and soft drops on a resting piece share a single 3-restart budget per piece
- Why: Prevents holding down from stalling a piece forever, maintaining consistency with how the sideways rule already works
- Rejected: Give soft drop its own separate 3 restarts - Would allow holding down to stall indefinitely, breaking game balance; Allow restarts with no limit - Would allow infinite stalling, breaking game balance
- Evidence: "I kept the shared limit so holding down can't stall a piece forever, which is how the sideways rule already works."

### Considered, not done (REQ-005, 2026-09-13)

- Run the implementation in a browser to verify it works - Assistant acknowledged lack of verification. Evidence: "I haven't run it in a browser."

## DEC-007 - Preview shows only next piece

- Date: 2026-09-13
- REQ: REQ-006
- Status: accepted
- Chose: Show only the next piece in preview
- Why: Three upcoming pieces is too much information and crowds the panel
- Rejected: Show three upcoming pieces - Turns game into planning exercise; crowds the panel
- Evidence: "Three upcoming pieces is too much information — it turns the game into a planning exercise and it crowds the panel. Show only the next piece."

### Considered, not done (REQ-006, 2026-09-13)

- Remove multi-item preview code entirely - Keeping it simple to show more pieces again in the future. Evidence: "I didn't remove the multi-item preview code; changing one setting keeps it simple to show more pieces again."
- Modify getState().next to return only next piece - Tests depend on it returning the whole upcoming queue. Evidence: "__tetris.getState().next still returns the whole upcoming queue, because tests depend on it."

## DEC-008 - Gravity interval formula

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: The interval between gravity steps is max(100, 1000 - (level - 1) * 100) milliseconds
- Why: User specified the exact formula for gravity step interval, which must be consistent across the codebase
- Rejected: Use 90 ms multiplier instead of 100 ms - Does not match the user-specified formula
- Evidence: "The interval between gravity steps, in milliseconds, is `max(100, 1000 - (level - 1) * 100)`"

## DEC-009 - Hold constraint: one per lock cycle

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Only one hold per piece: after holding, a second hold is refused until a piece locks
- Why: User explicitly stated this constraint to prevent hold-spinning abuses
- Rejected: Allow unlimited holds per piece - Would permit hold-spinning abuse, undermining game difficulty
- Evidence: "Only one hold per piece: after holding, a second hold is refused until a piece locks."

### Considered, not done (REQ-007, 2026-09-13)

- Work out the level from lines alone without considering the current level - Would undo the effect of setLevel, violating the requirement that 'Levelling from lines carries on from there'. Evidence: "I rejected working the level out from lines alone, because that would undo `setLevel`"

## DEC-010 - Pause must not circumvent locking rule

- Date: 2026-09-13
- REQ: REQ-009
- Status: accepted
- Chose: Lock count, restarts, and time-before-next-drop all resume exactly where they paused
- Why: User stated: 'Pausing must not become a way around the locking rule we settled on.' This ensures pausing provides no tactical advantage for evading piece locks.
- Rejected: Restart the full drop timer on resume - Pausing repeatedly would prevent pieces from ever locking
- Evidence: "Pausing must not become a way around the locking rule we settled on."

## DEC-011 - Ghost cell inclusion in getState().ghost

- Date: 2026-09-13
- REQ: REQ-009
- Status: accepted
- Chose: getState().ghost lists all four landing cells, even ones the falling piece already covers
- Why: Simplifies the API by returning the complete landing position set. Only uncovered cells render with data-ghost="true" in the DOM, separating the complete logical set from visual rendering.
- Rejected: getState().ghost lists only uncovered landing cells - Inconsistent between API return and DOM rendering; caller must reconstruct full landing position
- Evidence: "getState().ghost lists all four landing cells, even ones the falling piece already covers; only uncovered cells get data-ghost="true"."

### Considered, not done (REQ-009, 2026-09-13)

- Chain gravity steps with setTimeout instead of setInterval - Not a product decision; internal implementation detail for precise timing during pause/resume cycles. Evidence: "One gravity step per timeout, chained."
- Store pausedRemaining to track elapsed pause duration - Not a decision; routine implementation necessity to preserve exact remaining time-before-drop. Evidence: "pausedRemaining = Math.max(0, nextTickAt - Date.now())"

## DEC-012 - Keyboard controls specification

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Left and Right arrows move; Down soft drops; Up rotates clockwise; Space hard drops; C holds; P pauses/resumes; R starts new game
- Why: User stated exact control mappings as standing requirements for the product
- Rejected: none stated
- Evidence: "Left and Right arrows move the piece. - Down arrow soft drops. - Up arrow rotates clockwise. - Space hard drops. - C holds. - P pauses and resumes. - R starts a new game."

## DEC-013 - Restart button initial state

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Restart button empties board, sets score 0, lines 0, level 1, running state
- Why: User specified exact initial conditions the restart button must establish
- Rejected: none stated
- Evidence: "Add `data-testid="restart-btn"` — a button that starts a new game: empty board, score 0, lines 0, level 1, running."

### Considered, not done (REQ-010, 2026-09-13)

- Change existing Shift and Esc keys for hold and pause - Assistant kept these as backward-compatible legacy controls alongside C and P. Evidence: "I kept the old Shift (hold) and Esc (pause) keys"
- Play the game in a browser to verify controls - Assistant performed code reading and syntax check instead, relying on earlier test runs. Evidence: "I didn't play the game in a browser."
- Modify REQ-002 and REQ-008 open items - Full text was not visible to the assistant. Evidence: "I couldn't see their full text, so I didn't change anything for them."
