# Decisions

_Appended by product-record hooks. Do not edit by hand._

## DEC-001 - Single file constraint: index.html with inline CSS and JS, no external dependencies

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: One HTML file only, inline styles and scripts, no frameworks, build tools, CDN links, or network requests
- Why: User stated this as a hard constraint that must hold for the entire project
- Rejected: Split into separate CSS/JS files or use external libraries - Violates the one-file constraint and breaks filesystem-only operation requirement
- Evidence: "ONE file: `index.html`. Inline CSS and JS. No frameworks, no build step, no CDN links, no network requests."

## DEC-002 - Synchronous rendering: DOM must reflect state changes immediately

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: No deferred drawing; update DOM synchronously after every state change, never use requestAnimationFrame or timers for deferred draws
- Why: User stated that tests read DOM immediately after driving the game, so deferred draws will never be observed
- Rejected: Defer rendering to requestAnimationFrame or setTimeout - Tests would not observe the state change as the draw would never be seen by the test harness
- Evidence: "Rendering must be synchronous. After any state change the DOM must already show the new state. Do not defer drawing to `requestAnimationFrame` or to a timer — the tests read the DOM immediately after driving the game, and a deferred draw will never arrive."

### Considered, not done (REQ-001, 2026-09-13)

- Rotation (↑ or input('rotate')) - Feature was added beyond the spec; not a requirement, so no decision record needed. Evidence: "Beyond the spec: I also added rotation (↑ or `input("rotate")`)"
- Line clear scoring 100/300/500/800 × level - Scoring system was added beyond the spec; not a requirement, so no decision record needed. Evidence: "Beyond the spec: ... line clears scoring 100/300/500/800 × level"
- Level-up every 10 lines - Progression system was added beyond the spec; not a requirement, so no decision record needed. Evidence: "Beyond the spec: ... a level-up every 10 lines"
- Ghost piece showing where piece will land - Deliberately omitted because it would mark empty cells as filled, conflicting with the data-filled attribute semantics. Evidence: "I left out a ghost piece, because it would mark empty cells as filled."

## DEC-003 - Lock delay and restart mechanism

- Date: 2026-09-13
- REQ: REQ-002
- Status: accepted
- Chose: Lock delay is 2 ticks; piece locks on second tick unable to fall. Left/right moves while resting restart the delay, at most 3 times per piece. Hard drop locks immediately. Count belongs to the piece and persists when it falls.
- Why: The prompt explicitly establishes this as a decision to keep for the rest of the project, with a stated reason about forgiving placement while preventing infinite delay.
- Rejected: none stated
- Evidence: "A gravity step moves the falling piece down one row. If it cannot move down, that step counts one tick of **lock delay** instead. The lock delay is **2 ticks**. The piece locks on the second tick it spends unable to fall. Moving the piece left or right while it is resting **restarts** the lock delay: the player gets the full 2 ticks again. A piece may restart its lock delay **at most 3 times**. After the third restart the delay runs out no matter what the player does, and the piece locks. The count belongs to the piece, not to the moment — it is not cleared when the piece falls further. Hard drop is the exception: it locks the piece at once, with no delay."

## DEC-004 - Definition of resting state for lock delay restart

- Date: 2026-09-13
- REQ: REQ-002
- Status: accepted
- Chose: A piece is resting whenever it cannot move down, even before any tick has counted. Sideways move right after landing uses one restart; rotation does not restart the delay.
- Why: Clarifies the boundary condition for when a piece is considered resting and eligible for lock delay restart.
- Rejected: Count only moves made after at least one tick has counted - Would make the restart mechanism less predictable and forgiving at the moment of landing
- Evidence: "a piece is "resting" whenever it can't move down, even before any tick has counted. So a sideways move right after landing uses up one of the 3 restarts. I rejected counting only moves made after a tick; rotation does not restart the delay."

### Considered, not done (REQ-002, 2026-09-13)

- Rotation behavior when piece does not fit - This was specified by the user and implemented without alternative consideration. Evidence: "A rotation must never put the piece outside the board or on top of a locked cell. If the rotated shape does not fit where it is, the game may shift it sideways to make room. If nothing works, refuse the rotation and leave the piece exactly as it was."
- Keyboard mapping for rotateCW - This was specified by the user; implementation choice was straightforward. Evidence: "rotateCW tries the turn in place, then shifted 1 or 2 columns sideways. If none fits, the piece stays as it was. The Up arrow now sends rotateCW, and the old rotate still works."

## DEC-005 - Scoring multiplier for row clears by count

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: 1 row = 100, 2 rows = 300, 3 rows = 500, 4 rows = 800 points; multiply by current level before the clear
- Why: Clearing rows together must always beat clearing the same rows one at a time to incentivize stack-building and give the game strategic shape
- Rejected: Equal points per row regardless of how many clear at once - Clearing rows together would not beat clearing them one at a time, removing strategic incentive to build a stack and eliminating game shape
- Evidence: "Points for a clear depend on how many rows go at once: 1 row = 100, 2 rows = 300, 3 rows = 500, 4 rows = 800. That number is multiplied by the current level."

## DEC-006 - Soft-drop point award only on actual movement

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Soft drop scores 1 point only when the player's down press actually moves the piece; gravity and presses that only count toward lock delay score nothing
- Why: Prevents unintended scoring from timer gravity or presses that do not advance the piece toward locking
- Rejected: none stated
- Evidence: "Soft drop: scores 1 point only when the player's down press actually moves the piece. Timer gravity scores nothing, and neither does a press that only counts toward the lock delay."

### Considered, not done (REQ-003, 2026-09-13)

- Run and test the scoring implementation - Assistant stated "I haven't run it", indicating testing was deferred to a later session. Evidence: "I haven't run it."

## DEC-007 - Preview queue refill timing

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: Refill preview after every spawn and after setQueue
- Why: Ensures preview always shows three pieces; fixed queue keeps order with random pieces added after it
- Rejected: Refill only when queue length falls to zero - Fixed queue would not maintain its order when refilled
- Evidence: "The queue now refills after every spawn and after `setQueue`, so a fixed queue keeps its order with random pieces added after it."

## DEC-008 - Game-over status value

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: Use "gameover" instead of "over"
- Why: Clarifies state name to distinguish from other end states; required for status check in render function
- Rejected: Keep existing "over" status value - Less explicit naming; breaks requirement specification which requires "gameover"
- Evidence: "a spawn that doesn't fit sets status to `"gameover"` (it was `"over"`)"

### Considered, not done (REQ-004, 2026-09-13)

- Keep data-piece attribute on individual mini cells - Removed to place data-piece only on the preview item container for semantic clarity. Evidence: "I took `data-piece` off the small cells inside, so it only appears on the items."
- Run and test in browser - Out of scope for this turn; only validated that script parses. Evidence: "I haven't run it in a browser; I only checked that the script parses."

## DEC-009 - Soft drop restarts lock delay on resting piece

- Date: 2026-09-13
- REQ: REQ-005
- Status: accepted
- Chose: Soft drop on a resting piece restarts the lock delay from the same MAX_LOCK_RESETS budget as sideways moves, scores nothing, and does nothing after the limit is exhausted
- Why: This provides the same breathing room (delay restart opportunity) for down-key taps as sideways moves, fixing the player complaint that slamming a piece down locks it before they can nudge it.
- Rejected: Keep the old 'counts a tick' behaviour once the 3 restarts are used up - Still locks the piece under the player's fingers after the restart budget is exhausted
- Evidence: "A soft drop on a resting piece restarts it too, from the same budget."

### Considered, not done (REQ-005, 2026-09-13)

- Play-test the change in a browser - The assistant only verified that the script parses; browser testing was not performed. Evidence: "I only checked that the script parses; I haven't played it in a browser."

### Considered, not done (REQ-006, 2026-09-13)

- Delete the preview rendering code - Changing the count variable was sufficient; the assistant preserved existing code rather than refactoring it.. Evidence: "I didn't delete the preview code. Changing the count was enough."

## DEC-010 - Level advancement carries forward from setLevel

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Level is incremented by the difference in 10-line thresholds crossed, preserving level set by setLevel
- Why: Ensures setLevel(n) establishes a starting level that progresses naturally; calculating level as floor(lines/10)+1 would discard the manually set level.
- Rejected: Calculate level as floor(lines/10)+1 - That would throw away a level set by setLevel
- Evidence: "state.level += Math.floor(state.lines / 10) - before;"

## DEC-011 - Gravity speed formula step size

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: The interval between gravity steps is max(100, 1000 - (level - 1) * 100) milliseconds
- Why: User specified the exact formula with 100 ms step increments to replace the existing 90 ms step.
- Rejected: none stated
- Evidence: "The interval between gravity steps, in milliseconds, is `max(100, 1000 - (level - 1) * 100)`."

### Considered, not done (REQ-007, 2026-09-13)

- Bind hold to additional keys beyond C and Shift - Assistant chose C, c, and Shift without exploring alternatives; routine key binding choice not a decision. Evidence: "c: "hold", C: "hold", Shift: "hold""

## DEC-012 - Pausing must not circumvent locking rule

- Date: 2026-09-13
- REQ: REQ-009
- Status: accepted
- Chose: Pause preserves lock ticks, restart count, and remaining gravity time; resume continues with time left in interrupted interval
- Why: The user explicitly stated pausing must not become a way around the locking rule; the implementation records when the timer is due and resumes with partial time left, making pause ineffective for delaying piece lock
- Rejected: Restart gravity timer on resume with full interval - Lets a player hold off locking forever by pausing repeatedly
- Evidence: "Pausing must not become a way around the locking rule we settled on."

## DEC-013 - Ghost cells rendering when overlapped by falling piece

- Date: 2026-09-13
- REQ: REQ-009
- Status: accepted
- Chose: Where the piece overlaps its landing spot, the piece is drawn (filled) and those cells are not marked ghost; getState().ghost still lists all landing cells
- Why: Preserves visual priority of the active piece while maintaining complete ghost cell state for testing and logic
- Rejected: Mark all landing cells as ghost, hiding piece cells beneath - Would hide the falling piece under the ghost outline, reducing visibility
- Evidence: "where the piece overlaps its own landing spot, the piece is drawn, so those cells are not marked as ghost. `getState().ghost` still lists all landing cells."

### Considered, not done (REQ-009, 2026-09-13)

- Run the game in a browser to verify the implementation - Out of scope for this turn; assistant explicitly stated the script parses but was not run in a browser. Evidence: "The script parses, but I haven't run the game in a browser."

## DEC-014 - Game actions ignore modifier keys

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Game keys (ArrowLeft, ArrowRight, Down, Up, Space, C, P, R, Enter) must not fire when Ctrl, Cmd, or Alt is held
- Why: Prevents conflicts with browser shortcuts and system commands. Ctrl+C and Cmd+C will not trigger game hold; Cmd+R will not prevent page reload.
- Rejected: Allow game actions with any key combination - Browser shortcuts like Cmd+R (reload) or Cmd+C (copy) would be captured by game handler
- Evidence: "if (e.ctrlKey || e.metaKey || e.altKey) return;"

## DEC-015 - Restart action works in paused and game-over states

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Restart action is checked before game-status guard and bypasses the running-state requirement
- Why: Player can restart from paused state or after game over without needing to unpause first. R, Enter, and restart button all trigger the same action.
- Rejected: Require unpause before restart is allowed - Unnecessary step; restart should be immediately available
- Evidence: "if (action === "restart") { newGame(); return; }"

### Considered, not done (REQ-010, 2026-09-13)

- Remove extra keys (Enter, Shift, Escape) that were not in the prompt - The prompt did not ask for removal of earlier keys; retaining them maintains backward compatibility. Evidence: "Rejected: removing the extra keys (Enter, Shift, Escape), because the prompt didn't ask for it."
