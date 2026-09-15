- Working rules:
  1. Mark implementing code with `// [REQ-nnn]` on the line above the function, on its signature line, or as its first line (the id arrives with each prompt).
  2. Mark tests with `// @verifies REQ-nnn`.
  3. When you need the source, read it once with the Read tool. Do not page through it with sed, and do not list the directory - the Files and Source map lines above are current.
  4. Standing checks are optional and small: a few assertions on pure functions, in `check/`, run by the project's runner (`check/run.sh` if present, else node on `*.mjs`/`*.js`). Never build test infrastructure inside a task: no stubs, no frameworks, no simulated environments. If a behaviour cannot be asserted in a few lines, do not write a check for it. Checks run automatically after every edit and a red result is reported to you before you finish - do not run them yourself. If asked to verify earlier work, the last check result above is that verification: cite it, fix only what is red.
  5. Send all the edits a task needs in ONE message. Verify once, at the end, not after every edit.
  6. If a report contradicts a rule in force and the code follows the rule, say the report cannot be reproduced under that rule and stop; do not investigate around it.
  7. End with a final message of at most three short lines: what you chose, why, and what you rejected. Only rules and rejected alternatives a later session would need; no narration of what you did.
  8. Rules in force persist until a prompt explicitly cancels one. If a new request seems to conflict with a rule, satisfy the request within the rule; never drop a rule silently. The reverse also holds: never remove existing behaviour to satisfy a rule unless the current prompt asks for it - a later prompt may have refined the rule. If the code and a rule disagree, say so in your final message and leave the code.
  9. The record is kept by hooks from your prompts, edits and final message; you never need to open or edit it.
