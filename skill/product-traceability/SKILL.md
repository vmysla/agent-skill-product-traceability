---
name: product-traceability
description: Always-active skill that keeps PRDs, changelogs, decision records, and traceability matrices in sync with every AI-assisted change. Update requirements.md (living PRD), change.log (append-only history), decisions.md (rationale), and traceability-matrix.md (requirement ↔ artifact map) after every task that modifies code, configuration, or project structure.
---

# Product Traceability

You MUST keep the following files in the project root synchronized with the
current state of the project. Update them at the end of every task that
modifies code, configuration, or project structure. If a file does not
exist, create it.

## Files to maintain

### 1. `requirements.md` — Living PRD (single source of truth)

Reflects the **current, complete state** of the application — not a history.

Required sections:

- **Overview** — one-paragraph summary of what the app is and does
- **Features** — all user-facing features and behaviors, each with status
  (Implemented / Planned / Deprecated), originating session date, and
  artifacts (file paths)
- **Configuration** — settings, environment variables, defaults, options
- **Dependencies** — key libraries, services, external systems
- **Architecture** — how components are organized and interact
- **Constraints** — known limitations, invariants, requirements

When a feature is added, add it. When removed, remove it. When behavior
changes, update the description. This file always answers: _"What does this
application do right now?"_

### 2. `change.log` — Append-only history

Record every change with date and a short description of what + why.
Newest entries at the top. Group same-day entries under one date heading.

Use Keep a Changelog style under `[Unreleased]` for grouping by type:

```markdown
## [Unreleased]

### Added
- Real-time notifications via WebSockets.

### Updated
- Revised notification settings in the PRD.

### Removed
- Legacy polling endpoint.

## 2026-04-21

- Added real-time notifications: WebSocket channel for in-app delivery.
- Updated PRD notification config to cover retry + backoff.
```

When cutting a release, promote `[Unreleased]` to a dated + versioned
heading (e.g. `## [1.4.0] — 2026-04-21`).

### 3. `decisions.md` — Decision records with rationale

Append a new record whenever a non-obvious architectural or product
decision is made. Format:

```markdown
## YYYY-MM-DD — Short decision title

**Context:** why this came up
**Decision:** what was chosen
**Rationale:** why it was chosen over alternatives
**Consequences:** tradeoffs, follow-ups, new constraints
**Related:** requirements.md §Section, change.log entry, PR link
```

### 4. `traceability-matrix.md` — Requirement ↔ artifact mapping

Table linking every tracked requirement back to the prompt that produced
it, the implementation artifacts, the decision record, the changelog
entry, and the verification (tests / review).

| Requirement | Prompt excerpt | Implementation | Decision | Changelog | Verification |
|-------------|----------------|----------------|----------|-----------|--------------|
| Real-Time Notifications | "Add real-time notifications using WebSockets." | `notifications_service.ts` | 2026-04-21 | 2026-04-21 Added | `tests/notifications.test.ts` |

Update the row when a requirement ships, is deprecated, or moves files.

## Rules

- Update **all relevant files** after every code / config / structure change.
- If `requirements.md` is already accurate, verify it; no edit needed.
- If a file does not yet exist, create it (use the templates shipped with
  this skill under `~/.claude/skills/product-traceability/templates/`).
- Do not skip this step. A `Stop` hook will remind you.
- Never rewrite historical `change.log` or `decisions.md` entries — append
  corrections as new entries instead.
- Prefer concise, specific language. Name the features, files, and
  behaviors that changed.
- When linking artifacts, use paths relative to the project root.

## Inputs you can draw on

- The user's prompts in this session
- The diffs you produced (Edit / Write tool calls)
- Tool outputs and command results
- Existing `requirements.md`, `change.log`, `decisions.md`,
  `traceability-matrix.md`
- `git log`, `git diff`, open PRs
