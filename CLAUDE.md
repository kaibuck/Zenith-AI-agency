# Zenith AI Agency — Agent Build Playbook

This repo is the template for the AI voice/SMS agent backend Zenith builds and
sells to service businesses (HVAC, plumbing, etc.). The current code
(`index.js`) is a working example for "Zenith HVAC & Plumbing": Twilio voice +
SMS, Google Calendar booking, Vapi/Retell AI voice agent, reminders, and
opt-out handling.

When the user says **"build an agent for [business name]"**, follow the
workflow below.

## Workflow: "Build an agent for X"

1. **Discovery** — Confirm with the user: business name, services offered,
   hours, owner contact (for internal SMS notifications), and any special
   booking rules (e.g. closed weekends).

2. **Pick the stack** — Reuse the proven stack unless there's a good reason
   not to:
   - Twilio (voice + SMS)
   - Google Calendar (via Apps Script webhook, see `addCalendarEvent` in
     `index.js`)
   - Vapi or Retell for the AI voice agent
   - `team-db` (sqlite) for appointments/state

   If a new requirement needs a different/extra service, research 2-3
   options and present a short comparison (cost, ease of integration,
   reliability) — don't just pick one silently.

3. **Cost & signup approval gate (hard stop)** — Before creating any new
   account, enabling any paid tier, or doing anything that could incur a
   charge:
   - List exactly what needs to be signed up for and any cost involved
     (including free-tier limits that might get exceeded).
   - Wait for explicit approval. If something costs money and isn't
     approved yet, build everything else and leave that integration stubbed
     out / behind a TODO.

4. **Account creation & credentials** — I can't drive a browser, so the user
   creates accounts themselves using the signup links I provide. They then
   generate the relevant **API key/token** (not their account login password)
   from each service's dashboard and give that to me.
   - All real credentials go in `.env` (already gitignored — never in
     CLAUDE.md, code, or commits).
   - Update `.env.example` with new placeholder keys whenever a new
     integration is added, so the credential list stays a clear checklist.

5. **Implementation** — Wire up the new business following the existing
   patterns in `index.js` (voice flow, webhooks, reminders, opt-out). Keep
   the same structure so future agents stay easy to maintain.

6. **Test & handoff** — Use `test_webhooks.js` as a model for smoke-testing
   new endpoints before calling it done.

## Hard rules

- **Never** write real passwords, API keys, or other secrets into tracked
  files (CLAUDE.md, source code, commit messages). Only `.env`.
- **Never** create a new third-party account or enable a paid feature
  without explicit user approval first.
- Default to free tiers; flag clearly if a build is likely to need a paid
  plan.
- The agent doesn't need the user's personal account passwords — only
  per-service API keys/tokens, which are narrower and revocable.

## Credential checklist (current integrations)

See `.env.example` for the full list. Today this includes:
- `VAPI_API_KEY`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` /
  `GOOGLE_CALENDAR_ID`
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER`
- `OWNER_PHONE_NUMBER`
