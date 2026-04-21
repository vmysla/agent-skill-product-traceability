# Product Traceability — a Claude Code skill

> **Every prompt. Every diff. Every decision. Captured, linked, versioned —
> automatically.**

Product Traceability is an always-active [Claude Code](https://claude.com/claude-code)
skill that turns AI-assisted development into an auditable, continuously
documented process.

Install it once and, in every project you open, Claude will keep four living
artifacts in sync with reality:

| File | Role |
|------|------|
| `requirements.md` | Living Product Requirements Document — the single source of truth for what the app does **right now**. |
| `change.log` | Append-only, dated history of what changed and why (Keep-a-Changelog style). |
| `decisions.md` | Decision records + rationale for the non-obvious calls. |
| `traceability-matrix.md` | Requirement ↔ prompt ↔ implementation ↔ decision ↔ changelog ↔ verification. |

No manual documentation. No context loss across sessions, models, or tools.
No more "what did the AI actually change last week?"

---

## Why

AI-native development moves fast. Diffs pile up, prompts disappear into
scrollback, decisions get lost between sessions, and six months later nobody
— human or agent — remembers why the code looks the way it does.

Product Traceability closes the loop between **intent → implementation →
documentation** by treating traceability as a runtime concern, not a ritual.

- **For engineers:** a PRD and changelog you never have to write.
- **For product:** a synchronized view of what was asked for vs what shipped.
- **For compliance / review:** a full audit trail of AI-assisted changes.
- **For future agents:** durable context across models and sessions.

---

## How it works

The skill ships with three [Claude Code hooks](https://docs.claude.com/en/docs/claude-code/hooks)
that fire automatically on every human interaction:

```
┌───────────────────────────────────────────────────────────────────┐
│  SessionStart      → seed missing trace files from templates      │
│                      + log session-start marker                   │
│                                                                   │
│  UserPromptSubmit  → inject the always-active traceability rule   │
│                      into the turn + append prompt to session log │
│                                                                   │
│  Stop              → if code changed but trace files didn't,      │
│                      block the stop and ask Claude to finish      │
└───────────────────────────────────────────────────────────────────┘
```

The hooks work with **every model, every subagent, every tool** Claude Code
runs, because they operate at the harness level — not the prompt level.

Per-project trace breadcrumbs are also written to
`./.product-traceability/sessions/YYYY-MM-DD.md`, giving you raw prompts
alongside the curated PRD.

---

## Install

```bash
git clone https://github.com/vmysla/agent-skill-product-traceability.git
cd agent-skill-product-traceability
./install.sh
```

That's it. The installer:

1. Copies the skill to `~/.claude/skills/product-traceability/`
2. Installs hook scripts to `~/.claude/hooks/product-traceability/`
3. Merges the three hook registrations into `~/.claude/settings.json`
   (idempotent — safe to re-run)

**Requirements:** `bash`, `python3` (ships on macOS; `apt install python3`
on Debian/Ubuntu). Works on macOS and Linux. No Claude Code restart needed
for new sessions.

### Verify

Open any project in Claude Code and ask Claude to "add a hello world
endpoint". You should see:

- `requirements.md`, `change.log`, `decisions.md`, `traceability-matrix.md`
  appear in the project root (if they weren't there already).
- `change.log` gains a new dated entry.
- `requirements.md` gains a Features bullet.
- `.product-traceability/sessions/YYYY-MM-DD.md` records the prompt.

### Uninstall

```bash
./uninstall.sh
```

Removes the skill, hooks, and settings entries. Project trace files are
**left in place** — they are your data.

---

## Where the data lives

Everything is **per-project, in the project's own repo**. The skill does not
maintain a central database — each project owns its own traceability.

For every project you open in Claude Code, these files are created and kept
in sync in the project root:

| Path | Purpose | Committed by default? |
|------|---------|------------------------|
| `requirements.md` | Living PRD | ✅ yes — commit it |
| `change.log` | Dated change history | ✅ yes — commit it |
| `decisions.md` | Decision records with rationale | ✅ yes — commit it |
| `traceability-matrix.md` | Requirement ↔ artifact map | ✅ yes — commit it |
| `.product-traceability/sessions/YYYY-MM-DD.md` | Raw prompt log per session | ✅ yes — commit it |

The four top-level files are the curated, human-readable audit trail — you
almost certainly want them in the repo.

The `.product-traceability/` directory is the **raw session log**: it
captures the original user prompts verbatim (timestamped, with session IDs)
so that future agents can reconstruct exactly what was asked. It is also
committed by default, so your git history contains a complete record of
every AI-assisted interaction.

### Turning off the raw session log

If you prefer not to commit raw prompts (e.g. they may contain sensitive
project context, credentials typed in by mistake, or you just find them
noisy), add this single line to the project's `.gitignore`:

```gitignore
.product-traceability/
```

The hook will keep writing session logs locally (so the files exist for
your own reference), but git will stop tracking them. The four top-level
trace files (`requirements.md`, `change.log`, `decisions.md`,
`traceability-matrix.md`) are unaffected — they stay in the repo.

To stop writing session logs entirely, simply delete the
`.product-traceability/` directory and add it to `.gitignore`; the next
`UserPromptSubmit` hook will recreate it, but it will be ignored by git.

---

## What each file looks like

### `requirements.md` — living PRD

```markdown
# Product Requirements

## Overview
Real-time collaborative whiteboard with presence and chat.

## Features
- **Real-Time Notifications** — WebSocket push for mentions. _(Status: Implemented)_
  - Source: session 2026-04-15 · "Add real-time notifications using WebSockets."
  - Artifacts: `server/notifications_service.ts`, `client/useNotifications.ts`

## Configuration
- `NOTIF_WS_URL` — WebSocket endpoint; defaults to `wss://api.local/notif`.

## Dependencies
- `socket.io` 4.x — transport
- Redis — pub/sub fan-out

## Architecture
Client opens a single WS per session. Server fans out via Redis pub/sub.

## Constraints
- Mobile Safari closes sockets after 30s idle; client must auto-reconnect.
```

### `change.log` — append-only history (Keep a Changelog)

```markdown
## [Unreleased]

### Added
- Real-time notifications using WebSockets.

### Updated
- Revised notification settings in the PRD.

## 2026-04-21

- Added WebSocket notification channel: replaces 30s polling.
- Updated PRD with NOTIF_WS_URL config and retry constraint.
```

### `decisions.md` — rationale

```markdown
## 2026-04-21 — WebSockets over SSE for notifications

**Context:** Real-time delivery needed for mentions.
**Decision:** WebSockets via `socket.io`.
**Rationale:** Bidirectional channel already required for presence.
**Consequences:** New dependency on Redis for pub/sub fan-out.
**Related:** requirements.md §Features/Real-Time Notifications
```

### `traceability-matrix.md` — the map

| Requirement | Prompt excerpt | Implementation | Decision | Changelog | Verification |
|-------------|----------------|----------------|----------|-----------|--------------|
| Real-Time Notifications | "Add real-time notifications using WebSockets." | `notifications_service.ts` | 2026-04-21 | 2026-04-21 Added | `tests/notifications.test.ts` |

---

## Traceability model

| Artifact | Description |
|----------|-------------|
| Requirement | Product feature or capability requested |
| Prompt | Instruction given to an AI agent |
| Implementation | Generated or modified code and assets |
| Decision | Rationale behind changes |
| Changelog Entry | Summary of updates |
| Session | Context of interactions and outputs |
| Verification | Tests, evaluations, or approvals |

---

## Example commands

Once installed, these prompts "just work":

- *"Update the PRD based on this session."*
- *"Generate a changelog from today's work."*
- *"Document what was requested and implemented."*
- *"Link these changes to their originating requirements."*
- *"Summarize updates across all agents and models."*
- *"Create a traceability matrix for this feature."*
- *"Sync documentation with the latest code changes."*

---

## Integrations

The skill is intentionally file-first (Markdown in your repo). That means it
slots into whatever you already use:

- **Version Control:** GitHub, GitLab, Bitbucket — trace files are diffable
- **Documentation:** Notion, Confluence, Google Docs — publish from Markdown
- **Project Management:** Jira, Linear, Asana, Trello — link from `requirements.md`
- **AI Platforms:** OpenAI, Anthropic, Google Gemini — model-agnostic by design
- **Agent Frameworks:** MCP-compatible systems
- **Developer Tools:** Codex, Claude Code, Cursor, Windsurf

---

## Repository layout

```
agent-skill-product-traceability/
├── README.md                              this file
├── SKILL.md                               skill overview (repo-level)
├── LICENSE
├── install.sh                             installer
├── uninstall.sh                           uninstaller
├── skill/
│   └── product-traceability/
│       ├── SKILL.md                       the skill definition (with frontmatter)
│       ├── rules/
│       │   └── product-traceability.md    always-active rule (injected by hook)
│       └── templates/
│           ├── requirements.md
│           ├── change.log
│           ├── decisions.md
│           └── traceability-matrix.md
└── hooks/
    ├── session-start.sh
    ├── user-prompt-submit.sh
    └── stop.sh
```

---

## Success criteria

- Documentation remains synchronized with implementation.
- Every change is traceable to its originating request.
- Context persists across sessions, models, and tools.
- Requirements, code, and decisions stay aligned.
- No manual documentation is required.
- Outputs are structured, versioned, and auditable.

---

## License

MIT. See [LICENSE](LICENSE).
