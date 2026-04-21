# Product Traceability

Always-active skill that keeps Product Requirements Documents (PRDs),
changelogs, decision records, and traceability matrices continuously in sync
with every AI-assisted change made in a project.

Install this skill once and every Claude Code session in every project
automatically produces an auditable, versioned record of what was requested,
what was built, and why.

## Overview

Product Traceability ensures that every AI-assisted development activity is
accurately documented and linked to evolving product requirements. It
automatically maintains PRDs, changelogs, and decision records across agents,
models, tools, and sessions.

This skill provides a persistent, auditable source of truth for AI-native
product development.

## Purpose

To continuously track what was requested, what was built, and what changed —
ensuring alignment between intent, implementation, and documentation.

## Core Capabilities

- Automatically updates Product Requirements Documents (`requirements.md`)
- Generates structured and versioned changelogs (`change.log`)
- Tracks prompts, outputs, and implementation decisions (`decisions.md`)
- Maintains continuity across AI agents, models, and sessions
- Links requirements to code, commits, and artifacts
  (`traceability-matrix.md`)
- Produces decision logs and rationale records
- Synchronizes documentation across platforms
- Creates an auditable history of AI-assisted work

## Files Maintained in Every Project

| File | Role | Update cadence |
|------|------|----------------|
| `requirements.md` | Living snapshot of the product (PRD) | Edit in place when behavior changes |
| `change.log` | Append-only, dated history of changes | Prepend a new entry per change |
| `decisions.md` | Architecture / product decisions + rationale | Append when a non-obvious decision is made |
| `traceability-matrix.md` | Requirement → prompt → artifact mapping | Update when features ship or move |

If any of these files do not yet exist in the project root, create them from
the templates bundled with this skill.

## When to Update

Update the relevant files at the end of every task that modifies the
project's code, configuration, or structure. Do not skip this step. If only
`change.log` needs a new entry but `requirements.md` is already accurate,
still verify `requirements.md` and note that no update was needed.

A dedicated `Stop` hook also reminds Claude to finalize these files before
returning control to the user — see the installer for details.

## File Formats

### `requirements.md` — Living PRD

The single source of truth for what the application does **right now**.

```markdown
# Product Requirements

## Overview
One-paragraph summary of what the application is and does.

## Features
- **Feature name**: Description of user-facing behavior. _(Status: Implemented | Planned | Deprecated)_
  - Source: session YYYY-MM-DD · prompt excerpt
  - Artifacts: path/to/file.ts, path/to/other.py

## Configuration
- `ENV_VAR` — default, purpose
- Settings and options

## Dependencies
- External services, libraries, runtimes

## Architecture
High-level description of how components are organized and interact.

## Constraints
Known limitations, invariants, requirements.
```

When a feature is added, add it. When a feature is removed, remove it.
When behavior changes, update the description. This file should always
answer: _"What does this application do right now?"_

### `change.log` — Append-Only History

```markdown
## [Unreleased]

### Added
- Implemented real-time notifications using WebSockets.

### Updated
- Revised notification settings in the PRD.

### Removed
- Dropped legacy polling endpoint.

## 2026-04-21

- Feature X added: short description and why.
- Config Y changed: short description and why.
```

Newest entries at the top. Group same-day entries under one date heading.
When cutting a release, promote `[Unreleased]` to a dated version heading
(Keep a Changelog / SemVer style).

### `decisions.md` — Decision Records

```markdown
## 2026-04-21 — Chose WebSockets over SSE for notifications

**Context:** Real-time delivery needed for in-app notifications.
**Decision:** Use WebSockets via `socket.io`.
**Rationale:** Bidirectional channel already required for presence.
**Consequences:** New dependency on Redis for pub/sub fan-out.
**Related:** requirements.md §Features/Real-Time Notifications
```

### `traceability-matrix.md` — Requirement ↔ Artifact Map

| Requirement | Prompt excerpt | Implementation | Decision | Changelog | Verification |
|-------------|----------------|----------------|----------|-----------|--------------|
| Real-Time Notifications | "Add real-time notifications using WebSockets." | `notifications_service.ts` | 2026-04-21 | 2026-04-21 Added | tests/notifications.test.ts |

## Traceability Model

| Artifact | Description |
|----------|-------------|
| Requirement | Product feature or capability requested |
| Prompt | Instruction given to an AI agent |
| Implementation | Generated or modified code and assets |
| Decision | Rationale behind changes |
| Changelog Entry | Summary of updates |
| Session | Context of interactions and outputs |
| Verification | Tests, evaluations, or approvals |

## Inputs

- User prompts and instructions
- AI-generated code and artifacts
- Agent outputs and session logs
- Existing PRDs and specifications
- Git commits and pull requests
- Project management tickets and tasks

## Outputs

- Updated PRDs and specifications
- Structured changelogs
- Decision and audit logs
- Traceability matrices
- Versioned Markdown or JSON documentation
- Session summaries linked to deliverables

## Integrations

- **Version Control:** GitHub, GitLab, Bitbucket
- **Documentation:** Notion, Confluence, Google Docs
- **Project Management:** Jira, Linear, Asana, Trello
- **AI Platforms:** OpenAI, Anthropic, Google Gemini
- **Agent Frameworks:** MCP-compatible systems
- **Developer Tools:** Codex, Claude Code, Cursor, Windsurf

## Example Commands

- "Update the PRD based on this session."
- "Generate a changelog from today's work."
- "Document what was requested and implemented."
- "Link these changes to their originating requirements."
- "Summarize updates across all agents and models."
- "Create a traceability matrix for this feature."
- "Sync documentation with the latest code changes."

## Success Criteria

- Documentation remains synchronized with implementation
- Every change is traceable to its originating request
- Context persists across sessions, models, and tools
- Requirements, code, and decisions stay aligned
- No manual documentation is required
- Outputs are structured, versioned, and auditable
