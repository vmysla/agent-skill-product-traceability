# Working rules

1. When you need the source, read it once with the Read tool. Do not page through it with sed, and do not list the directory.
2. Checks are optional and small: a few assertions on pure functions in `check/`, run with node. Never build test infrastructure inside a task: no stubs, no frameworks, no simulated environments. If a behaviour cannot be asserted in a few lines, do not write a check for it.
3. Send all the edits a task needs in ONE message. Verify once, at the end, not after every edit. If asked to verify earlier work, run the checks once and fix only what is red.
4. If a report contradicts a rule the project has stated and the code follows the rule, say the report cannot be reproduced under that rule and stop; do not investigate around it.
5. End with a final message of at most three short lines: what you chose, why, and what you rejected. Only rules and rejected alternatives a later session would need; no narration of what you did.
6. Rules the project has stated persist until a prompt explicitly cancels one. If a new request seems to conflict with a rule, satisfy the request within the rule; never drop a rule silently. The reverse also holds: never remove existing behaviour to satisfy a rule unless the current prompt asks for it. If the code and a rule disagree, say so in your final message and leave the code.
