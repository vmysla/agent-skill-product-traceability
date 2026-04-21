# Product Traceability (Always Active)

This rule is injected into every user turn by the `UserPromptSubmit` hook
installed alongside this skill. It guarantees that Claude never forgets
traceability, regardless of model, subagent, or tool.

After every task that modifies code, configuration, or project structure,
you MUST update the following files in the project root:

1. `requirements.md` — living PRD (current state, not history)
2. `change.log` — append-only, dated history (newest at top)
3. `decisions.md` — rationale for non-obvious choices
4. `traceability-matrix.md` — requirement ↔ prompt ↔ artifact map

If any of these files does not exist, create it from the templates bundled
with the `product-traceability` skill.

## Minimum content per update

- `requirements.md`: ensure Features / Configuration / Dependencies /
  Architecture / Constraints reflect the change.
- `change.log`: prepend a dated entry naming the feature/file/behavior
  that changed and why, or add it under `[Unreleased]` grouped by
  Added / Updated / Removed.
- `decisions.md`: append a record only when a non-obvious decision was
  made.
- `traceability-matrix.md`: update the row for the affected requirement
  (or add one) pointing at the prompt, implementation, decision,
  changelog entry, and verification.

## Do not skip

- Do not defer the update to the next turn.
- Do not assume git history is a substitute — these files are the audit
  trail for AI-assisted work specifically.
- Do not rewrite historical entries; append corrections instead.
