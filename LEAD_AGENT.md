# Outbound Lead Agent

Finds local businesses, calls them with an AI voice agent, and books meetings on your Google Calendar.

```
Google Places (find leads) → data/leads.json → Vapi outbound call (AI) → Google Calendar (free/busy + invite + Meet link) → SMS to you
```

## Setup

1. **Google Places**: enable "Places API (New)" in Google Cloud and set `GOOGLE_PLACES_API_KEY`.
2. **Google Calendar**: enable the Calendar API. Create an OAuth client (Web) with redirect URI
   `http://localhost:5555/oauth2callback`, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
   then run `npm run google-auth` and paste the printed `GOOGLE_REFRESH_TOKEN` into `.env`.
3. **Vapi**: import your Twilio number into Vapi (Phone Numbers), copy its ID into `VAPI_PHONE_NUMBER_ID`,
   and set `VAPI_API_KEY`. Check that `VAPI_MODEL_PROVIDER` / `VAPI_MODEL` is a model Vapi lists.
4. Deploy, then set `PUBLIC_BASE_URL` (HTTPS) and `ADMIN_API_KEY`. Fill in the pitch settings in `.env.example`.

## Use it

```bash
H="x-api-key: $ADMIN_API_KEY"
# 1. Find leads
curl -X POST $URL/leads/find -H "$H" -H 'content-type: application/json' \
  -d '{"query":"plumber","location":"Atlanta, GA","maxResults":20}'
# 2. Review them
curl $URL/leads -H "$H"
# 3. Call one first to test it
curl -X POST $URL/leads/<lead-id>/call -H "$H"
# 4. Dial the next batch (respects calling hours, daily cap, retries, do-not-call)
curl -X POST $URL/leads/call -H "$H" -H 'content-type: application/json' -d '{"limit":3}'
# Booked meetings
curl "$URL/leads?status=booked" -H "$H"
```

Set `LEAD_AGENT_AUTORUN=true` to have it find leads and dial on its own every 15 minutes during calling hours.

## On the call

The AI says up front that it's an AI and asks for the owner. If they're interested, it checks your real calendar
availability, gets a name and email, books the meeting with a Google Meet link and an invite, and texts you.
If someone asks not to be called again, the lead is marked `do_not_call` and never dialed again.

## Compliance

AI-voice cold calls are regulated (in the US: the TCPA, with the FCC treating AI voices as "artificial voice", plus
state laws and the National Do Not Call Registry). Scrub your lead list against the DNC registry, avoid calling
mobile numbers without consent, keep the AI disclosure, and check the rules where you operate before turning on autopilot.
