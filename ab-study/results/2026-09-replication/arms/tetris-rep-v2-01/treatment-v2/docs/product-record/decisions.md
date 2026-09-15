# Decisions

_Appended by product-record hooks. Do not edit by hand._

## DEC-001 - Inline-only HTML file, no external dependencies

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: ONE file: `index.html`. Inline CSS and JS. No frameworks, no build step, no CDN links, no network requests.
- Why: The constraint ensures the game is self-contained, portable, and works offline from the filesystem without any build or network dependencies.
- Rejected: Separate CSS and JS files with build step or CDN resources - Violates the single-file constraint; breaks filesystem loading and adds external dependencies.
- Evidence: "ONE file: `index.html`. Inline CSS and JS. No frameworks, no build step, no CDN links, no network requests."

## DEC-002 - Synchronous rendering without animation frame deferral

- Date: 2026-09-13
- REQ: REQ-001
- Status: accepted
- Chose: Rendering must be synchronous. After any state change the DOM must already show the new state. Do not defer drawing to `requestAnimationFrame` or to a timer.
- Why: The test harness reads the DOM immediately after driving game events; deferred rendering via requestAnimationFrame or timers will not have executed by the time the test checks it, causing assertions to fail.
- Rejected: Defer rendering to requestAnimationFrame or a timer callback - DOM will not be updated by the time tests read it, causing test failures.
- Evidence: "Rendering must be synchronous. After any state change the DOM must already show the new state. Do not defer drawing to `requestAnimationFrame` or to a timer"

### Considered, not done (REQ-001, 2026-09-13)

- Line clearing and scoring logic - The spec required these features, but the assistant noted they were not yet implemented; score and lines remain hardcoded at 0.. Evidence: "Not added: line clearing, scoring, rotation and game over, since the spec didn't ask for them."
- Rotation mechanics - The prompt did not list rotation as a requirement; it was omitted entirely.. Evidence: "Not added: line clearing, scoring, rotation and game over, since the spec didn't ask for them."
- Game-over detection and handling - The prompt did not require game-over logic; the game remains in 'running' status indefinitely.. Evidence: "Not added: line clearing, scoring, rotation and game over, since the spec didn't ask for them."

## DEC-003 - Lock delay and restart cap rules

- Date: 2026-09-13
- REQ: REQ-002
- Status: accepted
- Chose: Lock delay is 2 ticks; piece restarts delay on left/right move while resting, up to 3 restarts max; hard drop locks immediately
- Why: User explicitly stated this as a decision to keep for the rest of the project to balance forgiving placement against infinite piece suspension
- Rejected: none stated
- Evidence: "Locking rule — this is a decision, keep it for the rest of the project: - A gravity step moves the falling piece down one row. If it cannot move down, that step counts one tick of **lock delay** instead. - The lock delay is **2 ticks**. The piece locks on the second tick it spends unable to fall. - Moving the piece left or right while it is resting **restarts** the lock delay: the player gets the full 2 ticks again. - A piece may restart its lock delay **at most 3 times**. After the third restart the delay runs out no matter what the player does, and the piece locks."

## DEC-004 - I piece rotation at board top

- Date: 2026-09-13
- REQ: REQ-002
- Status: accepted
- Chose: Move I piece down just enough to stay on board when rotation would poke above it
- Why: Allows I piece to rotate immediately after spawn at top; alternative would have delayed rotation until piece fell
- Rejected: Refuse rotation if rotated piece would go above board - I piece could not turn until it had fallen a row, reducing player control immediately after spawn
- Evidence: "**I piece at the top:** right after it appears, a turned I would poke above the board, so the game moves it down just enough to stay on the board. I rejected the alternative, refusing that rotation, because the I could not turn until it had fallen a row."

### Considered, not done (REQ-002, 2026-09-13)

- Wall kick order (try shifts in which sequence) - Implementation detail: the sequence [0, -1, 1, -2, 2] is a routine choice of which sideways shifts to attempt, not a decision for later sessions. Evidence: "var KICKS = [0, -1, 1, -2, 2]; // sideways shifts tried when a rotation does not fit"
- Rotation affects lock delay - User specification did not mention rotation affecting delay, only left/right movement; treating it as a routine implementation detail. Evidence: "Rotating does not restart the delay, because you only asked for left and right."
- Lock delay counter cleared when piece falls - Only tick count is reset on downward movement; restart count persists with piece as specified, so only tick reset is a routine implementation choice. Evidence: "The tick count goes back to 0 whenever the piece moves down. The restart count stays with the piece"

## DEC-005 - Tetris scoring table for line clears

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: 1 row = 100, 2 rows = 300, 3 rows = 500, 4 rows = 800, each multiplied by level; clearing together always scores more than clearing the same rows one at a time
- Why: The user explicitly stated this scoring model is a decision to keep for the rest of the project and provided the justification that clearing rows together must always beat clearing them one at a time, or players have no reason to build stacks.
- Rejected: none stated
- Evidence: "Points for a clear depend on how many rows go at once: 1 row = 100, 2 rows = 300, 3 rows = 500, 4 rows = 800. - That number is multiplied by the current level. ...clearing rows together must always beat clearing the same rows one at a time."

## DEC-006 - Drop scoring: soft and hard drop points per cell

- Date: 2026-09-13
- REQ: REQ-003
- Status: accepted
- Chose: Soft drop scores 1 point per cell moved down under player control; hard drop scores 2 points per cell dropped
- Why: The user specified the drop scoring model as part of the scoring decision to keep for the rest of the project.
- Rejected: none stated
- Evidence: "Soft drop scores 1 point for each cell the piece moves down under the player's control. - Hard drop scores 2 points for each cell the piece drops."

### Considered, not done (REQ-003, 2026-09-13)

- Test clears and scoring in a browser - The assistant deferred testing to a later stage, noting 'The script passes a syntax check, but I haven't played the game or tested clears and scoring in a browser.'. Evidence: "The script passes a syntax check, but I haven't played the game or tested clears and scoring in a browser."

## DEC-007 - Preview queue padding rule

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: Preview queue always maintains 3 pieces; if fewer are provided, random pieces fill to reach 3
- Why: The implementation adds a fillUpcoming() function that pads state.upcoming to PREVIEW_COUNT (3) with random pieces whenever the queue falls short, ensuring the preview always has exactly 3 pieces to display
- Rejected: Only show pieces actually in the queue, leaving gaps if fewer than 3 - Would create variable-sized preview that is unpredictable to the player
- Evidence: "Short queues:** the preview always holds 3 pieces. If `setQueue` or `newGame` gets fewer than 3, random pieces fill the rest, so `getState().next` will include them."

## DEC-008 - Game over trigger condition

- Date: 2026-09-13
- REQ: REQ-004
- Status: accepted
- Chose: Game ends when a new piece does not fit at its spawn spot
- Why: The prompt required detection when 'a newly spawned piece has nowhere to go', and the assistant chose to test fit at spawn position rather than checking for 'no legal move at all' anywhere on the board
- Rejected: Check for no legal move anywhere on the board - More expensive computation; would require full board scan beyond spawn point
- Evidence: "Game over:** it happens when a new piece doesn't fit at its spawn spot. The piece is not drawn and `current` becomes `null`. The status becomes `"gameover"`, the timer stops, and the "Game over" banner shows. I didn't use "no legal move at all" as the test."

### Considered, not done (REQ-004, 2026-09-13)

- Add animation or transition effects to the game over display - Not required by the specification; the banner simply appears when status becomes 'gameover'. Evidence: "`data-testid="game-over"` — shown when the game is over."
- Allow resuming the game after game over - The prompt specifies 'Once the game is over, gravity steps and player actions do nothing', establishing that game over is a terminal state. Evidence: "Once the game is over, gravity steps and player actions do nothing."

## DEC-009 - Lock delay restart shared across all movement keys

- Date: 2026-09-13
- REQ: REQ-005
- Status: accepted
- Chose: Down on a resting piece resets the lock timer using the same restartLockDelay function as left and right
- Why: Provides consistent breathing room across all key directions and ensures the lock timer reset logic is centralized and maintainable.
- Rejected: Give down its own separate reset limit - players could then stall far longer than with sideways moves, creating unfair advantage
- Evidence: "I made pressing down on a piece that's resting on the stack reset its lock timer, the same way left and right do. It shares their limit of 3 resets per piece (DEC-003)"

### Considered, not done (REQ-005, 2026-09-13)

- Score points when down is pressed on a resting piece - The piece does not move, so scoring is not appropriate. Evidence: "Down on a resting piece scores nothing, because the piece doesn't move."

## DEC-010 - Preview shows only next piece

- Date: 2026-09-13
- REQ: REQ-006
- Status: accepted
- Chose: Display only the next piece in the preview panel
- Why: User stated that showing three upcoming pieces turns the game into a planning exercise and crowds the panel
- Rejected: Show all 3 upcoming pieces in preview - Turns the game into a planning exercise and crowds the panel
- Evidence: "Three upcoming pieces is too much information — it turns the game into a planning exercise and it crowds the panel. Show only the next piece."

## DEC-011 - Internal queue remains 3 pieces

- Date: 2026-09-13
- REQ: REQ-006
- Status: accepted
- Chose: Keep game queue at 3 pieces internally while displaying only 1 in preview
- Why: Earlier rule DEC-007 requires 3-piece queue; only the display was changed per the user's request about the panel
- Rejected: Reduce internal queue to 1 piece - Violates existing rule DEC-007 requiring 3-piece queue padding
- Evidence: "I didn't shrink the queue to 1, since your request only covers what the panel shows."

### Considered, not done (REQ-006, 2026-09-13)

- Shrink the game queue from 3 to 1 piece - User request only covered what the preview panel shows, not internal game mechanics. Evidence: "I didn't shrink the queue to 1, since your request only covers what the panel shows."

## DEC-012 - Level progression from setLevel continues counting

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Level gains on crossing multiples of 10 lines, counted from current level—so setLevel(5) with 3 lines, reaching 10 lines gives level 6, not a fresh count of 10
- Why: User specified leveling carries on from the level set by setLevel, not restarting; later changes must maintain cumulative line counting
- Rejected: Start a fresh count of 10 lines from the moment setLevel is called - Violates the requirement that leveling carries on from the set level
- Evidence: "Levelling from lines carries on from there, and the level still never goes down."

## DEC-013 - Hold key binding

- Date: 2026-09-13
- REQ: REQ-007
- Status: accepted
- Chose: Hold action is triggered by C, Shift, or c key
- Why: User specified exact keys; later code or tests must recognize these inputs for hold
- Rejected: Alternative key bindings - Would contradict the stated input keys
- Evidence: "Hold: it is on C or Shift."

### Considered, not done (REQ-007, 2026-09-13)

- Allow setLevel to set a level below 1 - Implementation clamps to Math.max(1, ...) but this follows user intent that level is '1 or more'. Evidence: "setLevel itself can set any level of 1 or more, lower included."
- Reset piece hold flag on new game instead of on piece lock - Not explicitly stated; implementation chose to reset holdUsed on lock() to allow one hold per falling piece, which is the stated mechanic. Evidence: "Only one hold per piece: after holding, a second hold is refused until a piece locks."

## DEC-014 - Pause must not bypass the locking rule

- Date: 2026-09-13
- REQ: REQ-009
- Status: accepted
- Chose: Lock delay count and restart cap are preserved across pause; resume completes the interrupted gravity interval so toggling pause cannot hold off a gravity step or lock
- Why: The prompt explicitly states this constraint must be maintained when implementing pause, ensuring game mechanics integrity
- Rejected: Reset lock delay or restart cap on pause - Would allow pausing as a workaround to avoid locking penalty; Stop the gravity timer without tracking elapsed time and continue from zero on resume - Would allow repeatedly tapping pause to indefinitely delay a gravity step or piece lock
- Evidence: "Pausing must not become a way around the locking rule we settled on."

### Considered, not done (REQ-009, 2026-09-13)

- Render ghost cells only when a piece is actively falling (not on landing) - The implementation renders ghost cells to match the board once the piece has landed, so getState().ghost correctly reflects current board state. Evidence: "once the piece has landed, its cells aren't marked as ghost, so `getState().ghost` matches the board"
- Pause toggled only via button - Pause is also bound to the P key for keyboard convenience. Evidence: "Pause is on the button and the P key."

## DEC-015 - Browser shortcuts always pass through

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Ctrl, Cmd, and Alt key combinations pass to the browser; Ctrl+R reloads the page
- Why: Keyboard control implementation must not intercept OS/browser shortcuts. Ctrl, Cmd, Alt combinations are reserved for the browser.
- Rejected: Intercept Ctrl+R to start a new game - Would override browser's page reload function, preventing user from reloading
- Evidence: "if (e.ctrlKey || e.metaKey || e.altKey) return;"

## DEC-016 - Held P and R do not repeat their action

- Date: 2026-09-13
- REQ: REQ-010
- Status: accepted
- Chose: Holding down P or R produces no additional repeats; only the initial keypress is processed
- Why: Pause and restart are single-action commands (toggling and resetting respectively). Repeated triggers during a hold serve no purpose and would be confusing.
- Rejected: Allow held P or R to trigger multiple times - Pause would toggle rapidly when held; restart would repeatedly reset the board
- Evidence: "if (e.repeat && (action === "pause" || action === "restart")) return;"

### Considered, not done (REQ-010, 2026-09-13)

- Play the game to verify all functionality works end-to-end - Assistant verified by reading code against requirements and rules; no manual gameplay testing performed. Evidence: "I checked for breakage by reading the code against each earlier requirement and every rule in force."
- Resolve REQ-008 (player's scoring report bug) - Bug cannot be reproduced despite investigation; left open for later diagnosis. Evidence: "Left open: REQ-008, the player's scoring report. I still can't reproduce it."
