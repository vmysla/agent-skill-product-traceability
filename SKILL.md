---
name: product-traceability
description: Always-on product record kept by hooks, not by you. Requirements, decisions and rejections, a requirement-to-artifact map and a change history are compiled from your prompts, edits and final messages and summarised into native memory. You never need to open or edit the record.
---

# Product traceability

Hooks keep the record. Your part is small and is already in memory under
"Product traceability":

1. Each prompt arrives with a requirement id. Mark the code that implements
   it with `// [REQ-nnn]` (on the line above the function, on its signature
   line, or as its first line) and the test that proves it with
   `// @verifies REQ-nnn`.
2. Put standing checks in `check/`. Any `*.mjs` or `*.js` there runs with
   node after every edit (`check/run.sh`, if present, runs instead). A red
   result is reported to you before you finish. Do not run them yourself.
3. Make independent edits in one message.
4. In your final message say what you chose, why, and what you rejected.
   Only rationale stated there, or visible in the diff, enters the record.
5. The record is kept by hooks from your prompts, edits and final message;
   you never need to open or edit it.

What the hooks produce, for humans and for later sessions: a requirements
table with statuses, decisions with what was chosen, why and what was
rejected (each backed by a verbatim quote), a requirement-to-file:function-
to-test matrix with a source map, and a one-line-per-turn change log. A
30-line summary of all of it - check status, source map, requirement
statuses, recent changes, decisions - is written into native memory, which
is the only place you need to look.
