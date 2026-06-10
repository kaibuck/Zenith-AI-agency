# Zenith AI Agency — Operating Manual

This file is the standing brief for every Claude Code session in this repo.
Read it first, then check `PROGRESS.md` to see exactly where things stand.

**The goal**: follow `30_DAY_AI_AGENT_PLAN.md` to go from zero to 5 paying
clients selling AI voice/chat agents to local service businesses (HVAC,
plumbers, dentists, etc.), using n8n + OpenAI + Retell AI + Airtable +
Lovable + Twilio + Stripe + Calendly.

## Reference docs

- **`30_DAY_AI_AGENT_PLAN.md`** — the full day-by-day playbook: every system
  prompt, n8n config, JSON body, and outreach script, ready to copy-paste.
- **`PROGRESS.md`** — live tracker: current day, accounts created, client
  pipeline, notes. Always read/update this.
- **`index.js` / `.env.example`** — an earlier reference build (Twilio +
  Express + Google Calendar for "Zenith HVAC & Plumbing"). Not the primary
  playbook anymore, but useful as a code reference if a client build needs a
  custom backend instead of pure n8n.

## Quick commands — just say these, no need to explain context

| You say | I do |
| --- | --- |
| "what's next" / "let's go" / "continue" | Read `PROGRESS.md`, find the current day in `30_DAY_AI_AGENT_PLAN.md`, summarize today's tasks, and start drafting whatever's needed (prompts, messages, configs). |
| "done" / "finished day X" / "I did [task]" | Update `PROGRESS.md` (check it off, advance the day counter), then tell you what's next. |
| "draft outreach for [Business]" | Fill in the Day 9 message templates with that business's name/niche/city. |
| "build the agent for [Client]" | Walk through the Day 17/27 customization checklist for that client (system prompts, Twilio number, calendar, etc.), producing copy-paste-ready text for each step. |
| "I want to sign up for [Tool]" | Confirm it's in the plan/budget, flag any cost, and once you confirm, mark it as in-progress in `PROGRESS.md`. |
| "I'm stuck on [step]" | Help debug — ask what error/behavior you're seeing, suggest fixes, reference the plan's troubleshooting notes (n8n Executions, Retell Logs, etc.). |

## Hard rules (non-negotiable)

1. **Never write real passwords, API keys, tokens, or other secrets into any
   tracked file** (CLAUDE.md, PROGRESS.md, source code, commit messages).
   Real credentials live in your own password manager and in `.env`
   (gitignored) only.
2. **Never sign up for a new account, enable a paid plan, or do anything
   that could cost money without asking first and getting explicit
   approval.** This includes things that look free now but have usage-based
   costs later (e.g. OpenAI API usage, Twilio per-minute charges past trial).
3. **I can't operate a browser** — I can't click through n8n/Retell/Airtable/
   Stripe dashboards for you. I draft everything you need to paste; you do
   the clicking. (This may change later if a browser-connected setup is
   added — re-confirm rule #1 still applies in that case before relying on
   it.)
4. Default to free tiers everywhere possible; call out clearly if something
   is likely to cross into a paid tier.
5. Keep `PROGRESS.md` up to date as you go — it's what makes "pick up where
   I left off" work.

## How a typical session should go

1. You open a session and say something like "what's next".
2. I read `PROGRESS.md` + the relevant day(s) in `30_DAY_AI_AGENT_PLAN.md`.
3. I tell you, in plain terms, what today's goal is and break it into small
   steps.
4. For each step, I either:
   - draft the exact text/code/prompt you need to paste, or
   - tell you exactly what to click, or
   - flag it as a signup/cost decision and wait for your go-ahead.
5. As you complete things, tell me — I update `PROGRESS.md` so nothing gets
   lost between sessions.

## Client build workflow (Days 17/27 — "build an agent for X")

1. **Discovery**: business name, niche, city, services offered, hours,
   owner contact info, any special rules (e.g. closed weekends).
2. **Customize the chatbot**: update the Day 4 system prompt and `save_lead`
   HTTP body with the client's business name/services.
3. **Customize the voice agent**: duplicate the Retell demo agent, update
   the system prompt (Day 5 template), note that a new Twilio number is
   needed (~$1.15/mo — flag for approval), point the n8n booking workflow at
   the client's Google Calendar.
4. **Test**: 20 test calls/chats — track any bad responses and fix the
   prompts.
5. **Deliver**: draft the Day 18 delivery message + Loom script, and the
   call-forwarding instructions for the client's phone type.
6. **Follow up**: draft the referral ask (Day 22) once they've had the agent
   a few days.
