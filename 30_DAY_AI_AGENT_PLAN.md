# 30-Day Plan: 0 → 5 Paying Clients Selling AI Agents

*Based on Liam Ottley's "How to Build & Sell AI Agents in 2026"*

> **How to use this file**: Everything in code blocks below (system prompts,
> JSON bodies, scripts, messages) is ready to copy-paste into the relevant
> tool (n8n, Retell, Lovable, etc.). Account creation, clicking through
> dashboards, and connecting credentials inside those tools' own UIs has to
> be done by you — no AI assistant can do that part for you. Real API keys
> and passwords should live in your own password manager / `.env`, never in
> this file.

## 💰 $1,000 Budget

| Tool | Cost |
| --- | --- |
| OpenAI API credits | $20 |
| Hostinger VPS (self-host n8n) | $5/mo |
| Retell AI | $0 free tier |
| Airtable | $0 |
| Twilio trial | $0 |
| Lovable | $25/mo |
| Stripe | $0 |
| Calendly | $0 |
| **Total** | **~$50** |
| **Reserve** | **~$950** |

---

## WEEK 1 — DAYS 1–7: FOUNDATIONS + BUILD DEMOS

### Day 1 — Accounts + AI Agent Foundations

Create every account first. Keep every key in a notes doc / password manager.

- **n8n.io** — sign up for the free 14-day cloud trial. After trial, move to
  self-hosted on Hostinger (code `LIAMOTTLEY` for 10% off).
- **OpenAI** — platform.openai.com → Billing → add $20 → API Keys → create
  key → copy immediately (you only see it once).
- **Retell AI** — retellai.com → sign up free.
- **Airtable** — sign up free → create a base called "Leads" and one called
  "Pipeline".
- **Telegram** — download the app, create an account.
- **Twilio** — sign up free → save Account SID and Auth Token from the
  dashboard.
- **Lovable** — lovable.dev → sign up → $25/mo.
- **Stripe** — sign up → connect your bank account.
- **Calendly** — sign up free → create "15-Min Demo Call" → copy the link.
- **Google Account** — needed for Calendar/Sheets.

Save in your notes doc:
- OpenAI API key
- Twilio Account SID + Auth Token
- Airtable API key (airtable.com/account → generate)
- Airtable Base ID (airtable.com/api → click your base → ID starts with `app`)

**Concepts:**

An **AI agent** is an LLM (e.g. GPT) given tools to take action in the real
world. On its own an LLM just generates text; connect it to tools — "save
this lead to Airtable", "book this appointment to Google Calendar" — and it
becomes an agent that does things autonomously. The LLM decides when to use
which tool based on the conversation.

**n8n** is the automation platform that wires it all together (visual,
no-code). Every workflow has:
- **Trigger** — event that starts the workflow (chat message, webhook, schedule)
- **Nodes** — steps that process/act on data
- **Connections** — lines passing data between nodes

Core AI nodes:
- **AI Agent node** — the brain; has memory, can use tools, loops until done
- **OpenAI Chat Model node** — connects to GPT, plugs into the AI Agent
- **Simple Memory node** — short-term conversation memory
- **HTTP Request node** — lets the agent call any external API

**Prompt engineering rules:**
1. Give the agent a clear identity and role first
2. List its goals as numbered steps
3. Add explicit rules at the bottom for edge cases
4. Keep it focused — more specific is better
5. Tell it exactly when to use each tool and what triggers that

---

### Day 2 — Build 1: Telegram Expense Tracker

**What it does**: Snap a photo of a receipt, send to a Telegram bot, AI
extracts vendor/amount/date and logs it to a Google Sheet.

**Step 1 — Create a Telegram Bot**
1. Telegram → search `@BotFather` → start chat
2. `/newbot`
3. Name it (e.g. "Receipt Tracker")
4. Username ending in "bot" (e.g. `myreceipttracker_bot`)
5. Save the **Bot Token**

**Step 2 — Google Sheets**
1. sheets.google.com → new sheet called "Expenses"
2. Row 1 headers: `Date`, `Vendor`, `Amount`, `Category`, `Notes`

**Step 3 — n8n workflow** ("Telegram Expense Tracker")
1. Telegram Trigger node → Credentials → paste Bot Token → Updates: `message`
2. AI Agent node after the trigger
3. OpenAI Chat Model → connect to AI Agent → Model: `gpt-4o` (needed for image reading)
4. Simple Memory → connect to AI Agent
5. AI Agent system prompt:

```
You are an expense tracking assistant. When the user
sends a receipt image or text:
1. Extract: vendor name, total amount, date, and category
   (Food, Transport, Office, Software, Other)
2. If it's an image, read all visible text to find these
3. Format the data cleanly
4. Save it using the save_expense tool
5. Reply: "Got it! Logged [amount] at [vendor] on [date]"

If you can't read something clearly, make your best
guess and note it.
```

6. Google Sheets node after AI Agent → Credentials: sign in with Google →
   Operation: Append Row → Spreadsheet: Expenses
7. Map columns `Date`, `Vendor`, `Amount`, `Category` via `{{ }}` expressions
8. Telegram node at the end → Operation: Send Message → Chat ID:
   `={{ $('Telegram Trigger').item.json.message.chat.id }}` → Text:
   `={{ $json.output }}`
9. Save → Activate

**Test**: message the bot "Lunch at Chipotle $14.50 today" (should reply +
log to Sheets), then send a real receipt photo.

---

### Day 3 — Airtable Setup + Start Lead Gen Chatbot

**Airtable "Leads" base**
- Rename table to "Website Leads"
- Columns: `Name`, `Email`, `Phone`, `Message`, `Business`, `Date Captured`

**Airtable "Pipeline" base**
- Rename table to "Prospects"
- Columns: `Business Name`, `Owner Name`, `Phone`, `Email`,
  `Niche` (single select: HVAC / Plumber / Electrician / Roofer / Dentist /
  Chiropractor / Auto Repair / Lawyer / Real Estate / Med Spa), `City`,
  `Status` (single select: New / Contacted / Demo Sent / Call Booked /
  Closed / Dead), `Notes`, `Date Contacted`, `Follow Up Date`

**Lead Gen Chatbot** (n8n workflow "Lead Gen Chatbot")
1. Chat Trigger node → toggle ON "Make Chat Publicly Available" → Mode:
   Hosted Chat → copy the Chat URL (save it!)
2. AI Agent node after Chat Trigger
3. OpenAI Chat Model → Model: `gpt-4o-mini`
4. Simple Memory → Context Window: 10

---

### Day 4 — Finish the Lead Gen Chatbot

**System prompt** (swap "Mike's HVAC" / Boston for the real client later):

```
You are a friendly assistant for Mike's HVAC, a heating
and cooling company in Boston, MA.

Your job:
1. Greet the visitor warmly
2. Answer questions about: AC repair, furnace installation,
   heat pumps, maintenance plans
3. When they seem interested, collect:
   - Full name
   - Email address
   - Phone number
   - What service they need
4. Once you have all 4, say: "Perfect! Someone from our
   team will call you within 2 hours."
5. Save their info using the save_lead tool immediately.

Rules:
- Keep every response to 2-3 sentences max
- Be warm and human, never robotic
- Never make up prices. Say: "Our tech gives you an exact
  quote on-site, no charge for the visit."
```

**`save_lead` tool (HTTP Request node)**
- AI Agent → Tools → add HTTP Request
- Name: `save_lead`
- Description: "Save lead info after collecting name, email, phone, and
  service. Call this immediately once you have all four."
- Method: `POST`
- URL: `https://api.airtable.com/v0/YOUR_BASE_ID/Website%20Leads`
- Headers: `Authorization: Bearer YOUR_AIRTABLE_API_KEY`,
  `Content-Type: application/json`
- Body (JSON):

```json
{
  "fields": {
    "Name": "={{ $json.name }}",
    "Email": "={{ $json.email }}",
    "Phone": "={{ $json.phone }}",
    "Message": "={{ $json.service }}",
    "Business": "Mike's HVAC",
    "Date Captured": "={{ $now.toISO() }}"
  }
}
```

Save → Activate.

**Test**: open the Chat URL → "My AC stopped working" → answer with fake
info → check the lead appears in Airtable. If not: n8n → Executions → click
the red node → fix (usually wrong Base ID or API key).

**Website embed code** (give to every client — replace `YOUR_N8N_CHAT_URL`):

```html
<script>window.addEventListener('load', function() {
  var btn = document.createElement('div');
  btn.innerHTML = '\u{1F4AC}';
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;\
  width:60px;height:60px;background:#0066ff;border-radius:50%;\
  display:flex;align-items:center;justify-content:center;\
  font-size:24px;cursor:pointer;z-index:9999;';
  document.body.appendChild(btn);
  var iframe = document.createElement('iframe');
  iframe.src = 'YOUR_N8N_CHAT_URL';
  iframe.style.cssText = 'position:fixed;bottom:90px;right:20px;\
  width:380px;height:500px;border:none;border-radius:12px;\
  display:none;z-index:9998;';
  document.body.appendChild(iframe);
  btn.onclick = function() {
    iframe.style.display =
    iframe.style.display==="none"?"block":"none";
  };
});</script>
```

---

### Day 5 — Build the Voice Agent

**Google Calendar**
1. calendar.google.com → "+" next to "Other calendars" → name it
   "Appointments"
2. Settings → Working Hours → Mon–Fri 8am–6pm

**n8n booking workflow** ("Voice Agent — Book Appointment")
1. Webhook node → Method: POST → Authentication: None → copy URL
2. Google Calendar node → Operation: Create Event → Calendar: Appointments
3. Field mapping:
   - Title: `={{ $json.body.caller_name }} — {{ $json.body.service }}`
   - Start: `={{ $json.body.appointment_time }}`
   - End: `={{ DateTime.fromISO($json.body.appointment_time).plus({hours:1}).toISO() }}`
   - Description: `Phone: {{ $json.body.caller_phone }} | Service: {{ $json.body.service }}`
4. Respond to Webhook node → body:

```json
{ "status": "success", "message": "Appointment booked" }
```

5. Save → Activate

**Retell agent** ("Mike's HVAC Receptionist")
- LLM: OpenAI `gpt-4o`, paste OpenAI API key
- System prompt:

```
You are Sarah, the AI receptionist for Mike's HVAC.

1. Greet: "Thank you for calling Mike's HVAC, this is
   Sarah — how can I help you today?"
2. Find out what they need
3. Collect: full name, phone number, service needed,
   preferred day and time
4. Say: "Perfect, let me book that right now" then call
   book_appointment
5. Confirm: "You're all set! Appointment confirmed for
   [day/time]. Anything else?"

Rules:
- Short responses — this is a phone call
- Sound human and warm
- Pricing: "Our tech quotes on-site, no charge for visit"
- Convert appointment time to: YYYY-MM-DDTHH:MM:SS
```

- Functions → Add Function:
  - Name: `book_appointment`
  - Description: "Book after collecting name, phone, service, and time. Call
    this the moment you have all four."
  - Parameters: `caller_name` (string), `caller_phone` (string), `service`
    (string), `appointment_time` (string `YYYY-MM-DDTHH:MM:SS`)
  - Webhook URL: your n8n webhook URL → Method: POST
- Voice: Aria or Joanna
- Response delay: 500ms; End call on silence: ON, 10 seconds

**Connect Twilio**
- Retell → Phone Numbers → Add → Import from Twilio (Account SID + Auth
  Token) → assign number to agent

**Test**: call the Twilio number, have a real conversation, check Google
Calendar for the booking. Debug via Retell → Logs and n8n → Executions. Call
it 15+ times and fix every bad response.

---

### Day 6 — Sales Rep Copilot (Lovable + n8n + Vector Store)

**What it does**: Sales rep types a prospect's question/objection into a
Lovable app; the AI searches a vector-store knowledge base and surfaces the
best answer/rebuttal.

**Step 1 — Knowledge base workflow** ("Sales Copilot Knowledge Base")
1. "When Executed Manually" trigger
2. Edit Fields node → paste your sales knowledge: services + what's
   included, pricing tiers, common objections + answers, case studies
3. Embeddings OpenAI node (converts text to vectors)
4. In-Memory Vector Store node → Operation: Insert
5. Run once to load the knowledge base

**Step 2 — Query workflow** ("Sales Copilot Query")
1. Webhook node → copy URL
2. Embeddings OpenAI node (embeds incoming question)
3. In-Memory Vector Store → Operation: Search
4. AI Agent node, system prompt:

```
You are a sales assistant. You have been given relevant
context from a knowledge base. Use it to answer the
sales rep's question concisely.

Give the answer in 2-3 sentences max. If it's an
objection, give the rebuttal script directly.
```

5. Connect OpenAI Chat Model → AI Agent
6. Respond to Webhook node → return the AI's answer
7. Save → Activate

**Step 3 — Lovable frontend**

Prompt to paste into Lovable:

```
Build a simple sales assistant dashboard. It should have:
- A text input where I type a customer question or
  objection
- A "Get Answer" button
- A response area that displays the AI's answer
- Clean, minimal dark design
- When submitted, it sends a POST request to:
  [YOUR_N8N_WEBHOOK_URL] with JSON body:
  {"question": "[the input text]"}
- It displays the response.output field from the response
```

Replace `[YOUR_N8N_WEBHOOK_URL]` with your real webhook URL. Test by typing
an objection and clicking "Get Answer".

---

### Day 7 — Demo Videos + Stripe Setup

**Demo 1 — Chatbot** (60-90s)
1. Open the Chat URL
2. Screen-record a full conversation (play a homeowner)
3. Show the lead appearing in Airtable
4. Edit with CapCut/iMovie

**Demo 2 — Voice Agent** (60-90s)
1. Google Calendar full screen
2. Call your Twilio number while recording, have a natural conversation
3. Show the appointment appear on the calendar
4. Edit

Upload both to YouTube as Unlisted, save links.

**Stripe products** (Products → create three, save Payment Links):
- Chatbot Setup — $500 one-time
- Voice Agent Setup — $750 one-time
- Voice Agent Monthly — $300/month recurring

**Week 1 checklist**
- [ ] Telegram expense tracker working and logging to Google Sheets
- [ ] Lead gen chatbot saving leads to Airtable
- [ ] Voice agent answering calls and booking to Google Calendar
- [ ] Sales copilot Lovable app querying knowledge base
- [ ] Both demo videos uploaded and linked
- [ ] All three Stripe payment links saved

---

## WEEK 2 — DAYS 8–14: PROSPECT LIST + OUTREACH

### Day 8 — Build Prospect List (50 Businesses)

- Google Maps: search `"[your city] HVAC"`, `"[your city] plumber"`,
  `"[your city] electrician"`, `"[your city] roofer"`,
  `"[your city] auto repair"`
- For each: owner name, phone, email, Instagram/Facebook
- Add to Airtable Pipeline → Status: New
- 10 per niche, 50 total

> These niches miss the most calls. Every missed call is a $500–$8,000 job —
> that's the pitch.

---

### Day 9 — Outreach Message Templates

**DM (Instagram/Facebook)**
```
Hey [Name] — I build AI phone agents for [niche] businesses
in [city]. Answers calls 24/7, qualifies leads, books jobs
automatically. Made a 90-second demo — mind if I send it?
```

**Cold Email**
```
Subject: Your missed calls after hours

Hey [Name], what happens when someone calls [Business]
at 9pm on a Sunday? Most [niche] owners say voicemail —
and the lead never calls back. That's a $3,000-$5,000
job gone.

I built an AI agent that answers instantly and books the
appointment. Made a 90-second demo — want me to send it?

— [Your Name]
```

**Cold Text**
```
Hey [Name], this is [Your Name] — I build AI phone
agents for [niche] companies in [city]. Quick demo —
want me to send it over?
```

**Follow-up (no reply after 2 days)**
```
Hey [Name] — making sure this didn't get buried.
Happy to send the demo, 90 seconds to watch.
```

**After they say yes**
```
Here you go: [demo video link]. Real AI agent answering
calls and booking to Google Calendar. I can set this up
for [Business] in about a week. Want to jump on a quick
15-min call? [Calendly link]
```

---

### Day 10 — Send First 25 Outreach Messages

- 10 DMs, 10 cold emails, 5 cold texts — all in one sitting
- Log each in Airtable → Status: Contacted, Follow Up Date: +2 days

---

### Day 11 — Send Next 25 + Handle Replies

- Contact remaining 25 prospects
- Check Day 10 replies:
  - Positive → send demo link → Status: Demo Sent
  - "How much?" → send pricing + ask for a call → Status: Call Booked
  - Not interested → Status: Dead

---

### Day 12 — Follow Up on Non-Replies

- Filter Airtable by Follow Up Date = today → send follow-up
- For warm leads who watched the demo but haven't booked:

```
Awesome — I can do a quick 15-min call to show you
exactly how it'd work for [Business]. Does [Day] at
[Time] work? [Calendly link]
```

- Update every Airtable record after every interaction

---

### Day 13 — Book 3 Demo Calls

For every warm lead not yet booked:
```
I have a few spots open this week for demos. 15 minutes,
I'll show the agent live and we can talk about whether
it makes sense. [Calendly link]
```

**Demo call script** (practice out loud):
1. "How many calls do you think you miss after hours or on weekends?" — let
   them talk
2. "What's a typical job worth to you when you book it?" — let them talk
3. "So if this agent booked you even 2 extra jobs a month it pays for itself
   many times over, right?" — wait for yes
4. "Call this number right now while we're on the phone." — give them your
   demo Twilio number, let them experience it live
5. After they hang up: "That's what I'd build specifically for [Business].
   Setup is $750, then $300 a month. Want to move forward?"
6. If yes: "Perfect — sending you the payment link right now." → send the
   $750 Stripe link

---

### Day 14 — More Outreach + 20 New Prospects

- Add 20 new businesses (try dentists, chiropractors, real estate agents)
- Contact all 20 today
- Handle replies from the week
- Every Airtable record needs a current Status + Follow Up Date

---

## WEEK 3 — DAYS 15–21: CLOSE FIRST 3 CLIENTS

### Day 15 — Run Demo Calls + Close Client #1

Use the Day 13 script. After each call, follow up within 1 hour:
```
Great talking — here's what I'd build for you: AI voice
agent that answers your calls 24/7, collects caller info,
and books jobs to your calendar. Setup is $750 and I can
have it live within 7 days. Payment link: [Stripe link]
```

When payment lands:
```
Got it — I'll have your agent live within 5-7 days. What
services do you want it to know about?
```

---

### Day 16 — Handle Objections

To everyone who said "let me think about it":
```
Hey [Name] — I'm only taking 3 new clients this month
so I can give each build proper attention. If you want
to lock in your spot I can start this week. Otherwise
totally no worries.
```

**Objection scripts:**

- *"Too expensive"* → "What if we start with just the voice agent at $500
  setup? One extra booked job and it's already paid for."
- *"Need to think about it"* → "What's the main thing holding you back?" —
  stop talking, let them answer.
- *"Does it actually work?"* → "Call the demo number right now while we're
  on the phone." — hand them the number.
- *"I already have voicemail"* → "Voicemail captures maybe 20% of callers —
  most people hang up. This answers in 1 second, has a real conversation,
  and books the job. Nothing to listen to or call back."

---

### Day 17 — Build Client #1's Agent

Build immediately the moment someone pays (1-2 hours per client).

**Customize the chatbot**
- n8n → "Lead Gen Chatbot" → AI Agent system prompt → swap business name and
  services
- HTTP Request body → update `"Business"` value
- Embed code stays the same (Chat URL doesn't change)

**Customize the voice agent**
- Retell → duplicate demo agent → rename "[Client Business] Receptionist"
- Update system prompt: business name, real services, real hours
- Twilio → buy a number in the client's area code (~$1.15/mo)
- Retell → Phone Numbers → connect new number → assign to this agent
- n8n booking workflow → point Google Calendar node to client's calendar
- Test 20 times before delivering

---

### Day 18 — Deliver Client #1 + Ask for Referral

- Record a Loom (free) showing Retell dashboard, call logs, Calendar bookings
- Send:

```
[Name] — your agent is live. Walkthrough: [Loom link].
To activate: forward your business line to [Twilio
number] — 2 minutes in your phone settings. If you
know any other [niche] owners who'd want this, I'll
send you $100 cash for any referral that signs up.
```

**Call forwarding**
- iPhone: Settings → Phone → Call Forwarding → ON → enter Twilio number
- Android: Phone app → Settings → Call Forwarding → Always Forward → enter
  Twilio number

---

### Days 19–20 — Close Clients 2 and 3

- Focus only on "Demo Sent" and "Call Booked" Airtable records
- No-shows → reschedule once
- "Next week" people → follow up now
- Watched demo, no call booked → send Day 16 urgency message
- Keep adding fresh outreach: 20 more businesses, contact all. Build each
  new client the same day they pay.

---

### Day 21 — Review + Restock

For every "Contacted" record sitting 7+ days:
```
Hey [Name] — last time I'll reach out. Closing my books
this week as my schedule is filling up. Wanted to give
you first shot before I move on.
```

Also revisit every "Dead" record — one more message sometimes converts.

---

## WEEK 4 — DAYS 22–30: CLOSE CLIENTS 4 AND 5

### Day 22 — Ask Every Client for a Referral

```
Hey [Name] — hoping the agent has been pulling its
weight. Do you know any other [niche] owners who'd
want this? Just send them my number, I'll handle
everything, and I'll send you $100 if they sign up.
```

---

### Days 23–24 — Expand to New Niches

- Add dentists, personal injury lawyers, med spas (high job value, high
  missed-call rate)
- 30 new prospects, contact all with the same scripts (swap the niche)

---

### Day 25 — Post in Facebook Groups

- Join 5-10 local business owner groups
- Post once per group:

```
Question for business owners — how many calls do you
miss after hours? I've been building AI agents that
answer 24/7 and book appointments automatically. Built
one for a local HVAC company — he said it booked 3 jobs
the first 3 days. Happy to show anyone how it works.
```

- Reply to every comment personally

---

### Day 26 — LinkedIn Outreach

- Build/clean up your LinkedIn profile
- Search local small business owners
- Send 20 connection requests:

```
Hey [Name] — I help local [niche] businesses stop
losing after-hours calls with AI phone agents. Would
love to show you a quick demo.
```

---

### Day 27 — Build Clients 4 and 5's Agents

Same process as Day 17 for both. Customize, test 20 times, deliver with Loom
the same day. Ask for referrals immediately after delivering.

---

### Day 28 — Ask for Testimonials

```
Hey [Name] — would you mind sending me 2-3 sentences
about your experience with the agent? Building out my
website and it would mean a lot.
```

Screenshot every reply, add to your website same day.

---

### Day 29 — Close Every Straggler

For every "maybe later" / "next month" in Airtable:
```
Hey [Name] — circling back. I have one spot open this
week. Want to move forward?
```

---

### Day 30 — Count Up

| Result | Target |
| --- | --- |
| Clients closed | 5 |
| Setup fees collected | $3,750–$5,000 |
| Monthly recurring | $1,500–$2,000/mo |
| Cash spent | ~$50 |
| Cash left | ~$950 |

---

## ⚠️ THE THINGS THAT WILL KILL YOU

- Spending week 1 still learning. Build on Day 2. Period.
- Waiting for the demo to be perfect. Send it when it works.
- Only DMing, never calling. Pick up the phone — most people won't, that's
  your edge.
- Charging too much too fast. First 5 clients are for proof, not profit.
- Targeting big companies. 2-20 employee local businesses say yes fastest.

---

## 📊 Milestone Tracker

| Day | Target |
| --- | --- |
| 2 | Telegram expense tracker working |
| 4 | Lead gen chatbot saving leads to Airtable |
| 5 | Voice agent answering calls and booking |
| 6 | Sales copilot Lovable app working |
| 7 | Demo videos live, Stripe set up |
| 10 | 50 prospects contacted |
| 13 | 3 demo calls booked |
| 15 | Client #1 closed and built |
| 20 | Clients #2 and #3 closed |
| 27 | Clients #4 and #5 closed |
| 30 | $1,500+ MRR, $4K+ cash collected |
