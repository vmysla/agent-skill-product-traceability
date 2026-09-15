# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 2.x | Yes |
| 1.x | No. Please upgrade with `./install.sh` |

## What to know before you install

Product Traceability runs code on your machine and talks to your Claude account:

- **Hooks run on every session, prompt and turn.** They are shell and Python scripts
  installed in `~/.claude/hooks/product-traceability/` and registered in
  `~/.claude/settings.json`. Read them before installing; they are short.
- **One model call per turn that changes code.** It runs through your own `claude` CLI, with
  no tools and no project settings, and sends bounded excerpts of the prompt, the agent's
  final message and the diff. Nothing is sent anywhere else.
- **Standing checks run automatically.** In any project with a `check/` folder, its `*.js`
  and `*.mjs` files, or `check/run.sh` if present, run after edits. Be careful when you open
  a repository you do not trust in Claude Code with the plugin installed.
- **The A/B study runs the agent with `--permission-mode bypassPermissions`.** Run it only in
  a virtual machine, a container or a separate user account.

## Reporting a vulnerability

Please do not open a public issue for security problems. Instead, use GitHub's
[private vulnerability reporting](https://github.com/vmysla/agent-skill-product-traceability/security/advisories/new)
or write to Vlad Mysla at [vlad.mysla@gmail.com](mailto:vlad.mysla@gmail.com).

Include what you found, how to reproduce it, and what an attacker could do with it. You
will get a reply as soon as possible, and credit in the release notes if you would like it.
