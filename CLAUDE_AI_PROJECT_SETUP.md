# Using This Playbook on Claude.ai (Regular Claude)

CLAUDE.md only auto-loads in Claude Code (this repo, in the terminal/IDE).
For the Claude.ai app/website on your phone or laptop, the equivalent is a
**Project** — you upload reference files and set custom instructions, and
every chat inside that Project has access to them.

## One-time setup

1. Go to claude.ai → **Projects** → **Create project**.
2. Name it something like "Zenith AI Agency".
3. Click **Add content** / project knowledge, and upload these four files
   from this repo:
   - `CLAUDE.md`
   - `PERSONAL_CONTEXT.md`
   - `PROGRESS.md`
   - `30_DAY_AI_AGENT_PLAN.md`
4. Open **Project instructions** (sometimes called custom instructions) and
   paste the block below.

## Project instructions to paste

```
You're helping me run my AI agent agency. The full plan is in
30_DAY_AI_AGENT_PLAN.md and the operating rules/workflow are in
CLAUDE.md (both in this project's knowledge). PROGRESS.md tracks
where I currently am.

Quick commands:
- "what's next" / "let's go" / "continue" -> Check PROGRESS.md, find
  the current day in 30_DAY_AI_AGENT_PLAN.md, summarize today's
  tasks, and draft whatever I need (prompts, messages, configs).
- "done" / "finished day X" -> Tell me exactly what changed in
  PROGRESS.md (as a diff or the new checklist section) so I can sync
  it back into the repo via Claude Code.
- "draft outreach for [Business]" -> Fill in the Day 9 templates with
  that business's name/niche/city.
- "build the agent for [Client]" -> Walk through the Day 17/27
  checklist for that client.

Hard rules:
- Never ask me for real account passwords. Only discuss API
  keys/tokens, and only as instructions for where I should paste
  them myself - never store real credential values in chat.
- Before recommending any signup or paid plan, flag the cost clearly
  and wait for my go-ahead.
- You can't click through dashboards for me - draft what I need,
  I'll do the clicking, same as in Claude Code.
```

## Keeping PROGRESS.md in sync

Claude.ai Projects can't write back to this GitHub repo, so
`PROGRESS.md` can drift between the two:

- **Simplest approach**: treat Claude Code (this repo) as the source of
  truth for `PROGRESS.md`. Use the Claude.ai chat for "what's next" /
  drafting on the go, then when you're back at Claude Code, say "I did
  X, Y, Z today" and it'll update + commit `PROGRESS.md`.
- **If you update progress only via Claude.ai**: ask it to print the
  updated `PROGRESS.md` content, then re-upload that file to the
  Project's knowledge (replacing the old copy) so future chats see the
  current state. Periodically bring those updates back to Claude Code
  too, so the repo stays accurate.

## Re-syncing after changes here

Whenever any of the four files change in this repo, re-download and
re-upload the updated file(s) to the Claude.ai Project so both stay aligned:
- `CLAUDE.md`
- `PERSONAL_CONTEXT.md`
- `PROGRESS.md`
- `30_DAY_AI_AGENT_PLAN.md`
