# 30-Day Plan: 0 → 5 Paying Clients Selling AI Agents

*Built from Liam Ottley's video, exactly as he shows it — nothing added,
nothing removed.*

> **How to use this file**: Everything in code blocks below (system prompts,
> JSON bodies, API endpoints, scripts) is ready to copy-paste into the
> relevant tool (Relevance AI, n8n, Voiceflow, Agentive, etc.). Account
> creation and clicking through dashboards has to be done by you. Real API
> keys and passwords go in your own password manager / `.env`, never in this
> file.

## What This Plan Builds

The plan contains 4 builds across 4 platforms:

| Build | What It Is | Platform |
| --- | --- | --- |
| Build 1 | Sales Co-Pilot for sales reps | Relevance AI + Firecrawl |
| Build 2 | Automated Lead Qualification Agent | n8n + OpenAI + Gmail + Airtable |
| Build 3 | Website and Phone Lead Gen Agent | Voiceflow |
| Build 4 | WhatsApp Lead Gen Agent | Agentive (agentivehq.com) + Airtable |

## 💰 $1,000 Budget — Video Tools Only

| Tool | Cost |
| --- | --- |
| OpenAI API credits | $20 (platform.openai.com) |
| Relevance AI | $0 free plan |
| Firecrawl | $0 free plan (firecrawl.dev) |
| n8n cloud trial | $0 for 14 days (n8n.io) |
| Hostinger VPS for n8n after trial | $5/mo — code `LIAMOTTLEY` for 10% off |
| Voiceflow | $0 free plan (voiceflow.com) |
| Agentive | $0 (agentivehq.com) |
| Airtable | $0 free plan |
| Gmail / Google account | $0 |
| **Total (first month)** | **~$25** |
| **Reserve** | **~$975** |

---

## WEEK 1 — DAYS 1–7: FOUNDATIONS + BUILD ALL FOUR DEMOS

### Day 1 — Create All Accounts + Understand the Building Blocks

Create every account first. Every login and API key goes in a notes
doc/password manager immediately.

- **Relevance AI** — relevanceai.com — sign up free
- **n8n** — n8n.io — sign up for free 14-day cloud trial
- **Voiceflow** — voiceflow.com — sign up free
- **Agentive** — agentivehq.com — sign up free
- **OpenAI** — platform.openai.com → Billing → add $20 → API Keys → Create
  New Secret Key → copy immediately (you never see it again)
- **Firecrawl** — firecrawl.dev → sign up → API Keys → create one → save it
- **Airtable** — airtable.com → sign up free → create a base called "Leads"
  and another called "Pipeline"
- **Google account** — needed for Gmail and Google Sheets
- **Hostinger** — hostinger.com/liamn8n, code `LIAMOTTLEY` for 10% off —
  only needed after your 14-day n8n trial ends

Save in your notes doc:
- OpenAI API key
- Firecrawl API key
- Airtable API key (airtable.com/account → generate)
- Airtable Base ID (airtable.com/api → click your Leads base → ID starts
  with `app`)

**What you're building, and why it works:**

An AI agent is a digital worker that understands instructions and takes
actions to complete tasks. Just like a business has employees for different
tasks, an AI agent is a digital employee you build to do whatever you want —
it costs far less than a human, never needs sick days, and never causes
problems with coworkers.

Every AI agent has five parts:
1. **Brain** — the LLM (e.g. GPT)
2. **Prompt** — instructions on how to behave
3. **Memory** — so it remembers the conversation
4. **Knowledge** — optional external data (company docs, FAQs, etc.)
5. **Tools** — what let it actually take action instead of just chatting

As a builder, your main focus is **prompting, knowledge, and tools** — the
brain and memory are mostly handled automatically by the platforms.

Tools work through APIs: every action online is a request/response between
computers. GET requests pull information, POST requests send information.
AI agents use these same APIs as their "buttons" to take real action in the
real world instead of just talking.

---

### Day 2 — Build 1: Sales Co-Pilot on Relevance AI

**What it does**: A sales rep uses this before a call. They enter a company
URL and a prospect's LinkedIn URL. The agent researches both automatically,
then generates a pre-call strategy report with angles to close that person.
(Liam builds this for a hypothetical company, "Big Boy Recruits".)

#### Step 1 — Research Company Tool

1. relevanceai.com → log in → **Tools** → **Create New Tool**
2. Name: `Research Company`
3. Description: "Takes in a company URL, scrapes the website, then returns
   an AI-generated summary"
4. Add Input — type: Text — name: `company_url`
   - Description: "A URL for a company to be researched. Must be in format
     `https://...`"
5. Add Step → search "Firecrawl web scraper"
   - URL field: `{{company_url}}`
   - Uncheck "single URL only" (crawls multiple pages instead of just the
     front page)
   - Set number of pages to 5 (keeps it fast)
6. Add Step → LLM
   - Relevance AI Settings → API Keys → add your OpenAI key
   - Model: GPT-4o Mini (cheap and fast)
   - Prompt:

```
Please take this website content and summarize it into a
300-word summary that clearly outlines what the company
does, where they are based, their values, and anything
helpful for a sales rep who will soon be on a call with
them. Break it into key areas: Overview, Products and
Services, Team.
```

   - Insert the Firecrawl output into the prompt via the variable selector
     (curly brackets button)
7. Save → Run → test with a real URL (e.g. `https://morningside.ai`). You
   should get a clean written summary. If not, open the failed step and read
   the error.

#### Step 2 — Research Prospect Tool

1. Create New Tool → name: `Research Prospect`
2. Description: "Takes in a LinkedIn URL, scrapes the profile, returns a
   summary of the prospect"
3. Add Input — type: Text — name: `linkedin_url`
   - Description: "The LinkedIn URL of the prospect"
4. Add Step → search "LinkedIn" → select "Get LinkedIn Profile"
   - Pass in `{{linkedin_url}}`
5. Add LLM step:

```
Take this LinkedIn profile data and write a 200-word
summary of this person including their name, current
role, experience, and anything useful for a sales rep
about to get on a call with them.
```

   - Insert the LinkedIn data via the variable selector
6. Save → Run → test with your own LinkedIn URL

#### Step 3 — Pre-Call Report Generator Tool

1. Create New Tool → name: `Pre-Call Report`
2. Description: "Takes in company and prospect summaries and generates a
   pre-call strategy report"
3. Add two Inputs, both type Long Text:
   - `prospect_summary` — "Summary of the prospect from their LinkedIn"
   - `company_summary` — "Summary of the company from their website"
4. Add LLM step — use a smarter model (GPT-4o or O3 Mini) since this is
   strategy work:

```
You are a sales strategy expert. Given the prospect
and company information below, generate a pre-call
report for a sales rep that includes:
- Overview of the company and prospect
- Key business challenges they likely face
- How our services map to their needs
- Suggested talking points
- Anticipated objections and how to handle them
- Recommended angle to close this person

Prospect: {{prospect_summary}}
Company: {{company_summary}}
```

5. Save

#### Step 4 — Sales Co-Pilot Agent

1. Relevance AI → **Agents** → **Create New Agent**
2. Name: `Sales Co-Pilot`
3. Core Instructions:

```
You are a sales co-pilot assistant helping sales reps
prepare for calls. You have three tools:
1. Research Company — use when given a company URL
2. Research Prospect — use when given a LinkedIn URL
3. Pre-Call Report — use after researching both to
   generate a strategy report

When given a company URL and LinkedIn URL, run all
three tools in sequence automatically and deliver
the final pre-call report. Do not wait for approval
between steps.
```

4. Connect all three tools in the Tools section
5. Model: GPT-4o Mini
6. Set all three tools to **Auto Run** (no stop-and-ask between steps)
7. Click **Share** → enable Chat UI → copy the link

This link is what you give to a client — their sales rep opens it, enters a
company URL and LinkedIn URL, and gets a pre-call report in under a minute.

---

### Day 3 — Set Up Airtable for Both Databases

**Leads base**
1. Open your "Leads" base
2. Rename the default table to "Website Leads"
3. Columns: `Name`, `Email`, `Phone`, `Message`, `Business`, `Date Captured`

**Pipeline base ("Prospects" CRM)**
1. Open your "Pipeline" base
2. Rename the default table to "Prospects"
3. Columns:
   - `Business Name` — Single line text
   - `Owner Name` — Single line text
   - `Phone` — Phone number
   - `Email` — Email
   - `Niche` — Single select: HVAC, Plumber, Electrician, Roofer, Auto
     Repair, Dentist, Chiropractor, Lawyer, Real Estate, Med Spa
   - `City` — Single line text
   - `Status` — Single select: New, Contacted, Demo Sent, Call Booked,
     Closed, Dead
   - `Notes` — Long text
   - `Date Contacted` — Date
   - `Follow Up Date` — Date

---

### Day 4 — Build 2: Automated Lead Qualification Agent (n8n)

**What it does**: Someone fills out a form on your website. n8n triggers,
researches their company using the Relevance AI tool from Day 2, and sends
the data to an AI agent that decides if they're qualified. Qualified →
notify the sales rep. Not qualified → automated rejection email. No human
needed.

#### Step 1 — Workflow + form

1. n8n → Create Workflow → name: `Lead Qualification Agent`
2. Add an **n8n Form Trigger** node
3. Form name: "Work With Us"
4. Fields:
   - "What is your name?" — required
   - "What is your email?" — type Email — required
   - "What is your company website?" — required — placeholder `https://...`
   - "Tell us about your inquiry" — type Text Area
5. Test Step → submit with test data → confirm output appears

#### Step 2 — Research the company via Relevance AI

1. Add HTTP Request node after the form trigger
2. Method: POST
3. URL: from Relevance AI → open "Research Company" tool → API tab → copy
   endpoint URL
4. n8n: switch Body from Fixed to Expression mode
5. JSON body:

```json
{
  "params": {
    "company_url": "{{ $json['What is your company website?'] }}"
  }
}
```

6. Run with real form data — you should see the company research summary in
   the output panel. If it fails, check the Relevance AI endpoint URL and
   that your Relevance API key is in the request headers.

#### Step 3 — AI Agent node

1. Add an **AI Agent** node after the HTTP Request — set to **Tools Agent**
   mode
2. Language Model → add OpenAI Chat Model node → Credentials → Create New →
   paste OpenAI API key → name it "n8n"
3. Model: O3 Mini (better for decision-making)
4. System prompt:

```
You are a lead qualification agent. A company has
submitted a contact form. Research on their company
has been done and is provided below.

Your job is to decide if they are a qualified lead
based on these criteria:
- They are a software or tech company
- They have between 10 and 500 employees
- They appear to be growing and hiring

If they ARE qualified: use the notify_sales_rep tool
If they are NOT qualified: use the send_rejection tool

Always make a decision. Never ask for more information.
```

#### Step 4 — Gmail rejection email tool

1. AI Agent → Tools → add Gmail node
2. Credentials → Create New → sign in with Google → allow access
3. Operation: Send Email
4. To: switch to Expression → map to the email from the form
5. Subject: "Thanks for your interest"
6. Body (Expression mode):

```
Hi {{ $json["What is your name?"] }},

Thank you for reaching out. After reviewing your
inquiry we do not believe we are the right fit
for your needs at this time.

We wish you all the best and hope we can help
in the future.

Best,
Big Boy Recruits
```

7. Name this tool: `send_rejection`

#### Step 5 — Qualified lead notification

1. Create a **second** n8n workflow: `Qualified Lead Notification`
2. Add a Webhook trigger node → Method: POST → copy the Webhook URL
3. Add a Gmail node → send yourself an email when a qualified lead comes in
   - Subject: "New Qualified Lead"
   - Body: map the company research, person's name, and email from the
     webhook data
4. Save → Activate this second workflow
5. Back in the main "Lead Qualification Agent" workflow → AI Agent → add an
   HTTP Request as a tool
   - Name: `notify_sales_rep`
   - Method: POST, URL: the Webhook URL from step 2
6. Save → Activate the main workflow

**Test**: submit the form with a real company URL. Watch n8n Executions —
each step should fire in sequence. Qualified → notification email. Not
qualified → submitter gets the rejection email. If anything fails, click the
red node in Executions and read the error.

---

### Day 5 — Build 3: Website and Phone Agent on Voiceflow

**What it does**: An agent that lives on a business website as a chat
widget — answers questions from a knowledge base, generates instant quotes
via a custom tool, and captures leads. The same agent then connects to a
phone number so people can call and get the same experience.

#### Step 1 — Create the project

1. voiceflow.com → sign in → Create Project
2. Name: `Lead Gen Agent`
3. Project type: Chat Assistant

#### Step 2 — Knowledge base

1. Left panel → Knowledge Base → Add Knowledge
2. Upload documents about the business: services, FAQs, pricing ranges, and
   anything customers commonly ask about
3. Voiceflow indexes these automatically so the agent can search/pull from
   them

#### Step 3 — Conversation flow

1. Click the **Start** block on the canvas
2. Add a **Speak** block (opening greeting):

```
Hi! I am the virtual assistant for [Business Name].
How can I help you today?
```

3. Add a **Capture** block to listen for user input
4. Add an **Intent** block after it with three intents:
   - **Ask Question** — user wants info about services
   - **Get Quote** — user wants a price estimate
   - **Leave Contact Info** — user wants a callback

#### Step 4 — Ask Question path

1. Connect "Ask Question" → **AI Step** block
2. Toggle on **Knowledge Base** (searches uploaded docs)
3. Prompt:

```
Answer the user's question using the knowledge base.
Keep the answer to 2 to 3 sentences. Be warm and clear.
```

4. After the AI Step, add a **Speak** block that reads the answer back
5. Loop back to the Capture block

#### Step 5 — Get Quote path

1. Connect "Get Quote" → **Capture** block (capture service + relevant
   details)
2. Add an **API** block after it → POST to an n8n webhook
3. In n8n: create a new workflow `Quote Calculator` → Webhook trigger node →
   Set node to calculate the quote from the inputs → Respond to Webhook node
   returns the price
4. Paste that webhook URL into the Voiceflow API block
5. Add a **Speak** block after it:

```
Based on what you have described, the estimated
price for that service is {quote_price}. Would you
like to schedule an appointment or have someone
reach out to you?
```

#### Step 6 — Leave Contact Info path

1. Connect "Leave Contact Info" → series of **Capture** blocks:
   - Capture name — "What is your name?"
   - Capture email — "What is your email address?"
   - Capture phone — "What is the best number to reach you?"
   - Capture service — "What service are you interested in?"
2. Add an **API** block that POSTs all four fields to Airtable:
   - Method: POST
   - URL: `https://api.airtable.com/v0/YOUR_BASE_ID/Website%20Leads`
   - Header: `Authorization: Bearer YOUR_AIRTABLE_API_KEY`
   - Header: `Content-Type: application/json`
   - Body:

```json
{
  "fields": {
    "Name": "{name}",
    "Email": "{email}",
    "Phone": "{phone}",
    "Message": "{service}",
    "Business": "[Client Business Name]"
  }
}
```

3. Final **Speak** block:

```
Perfect! Someone from our team will be in touch
within 2 hours. Is there anything else I can help
you with today?
```

#### Step 7 — Publish as a website widget

1. Click **Publish** (top right) → **Web Chat**
2. Copy the embed code snippet
3. Give it to the client — they paste it before the closing `</body>` tag
4. A chat bubble appears on their site; clicking it opens the agent

#### Step 8 — Connect to a phone number

1. Publish → **Phone**
2. Follow Voiceflow's steps to connect a phone number
3. Once connected, anyone who calls reaches the same agent as the chat
   widget
4. Test by calling — it should greet, answer questions, give quotes, and
   capture info the same way as chat

---

### Day 6 — Build 4: WhatsApp Lead Gen Agent on Agentive

**What it does**: An agent connected to a WhatsApp number. Prospects message
it, it has a natural conversation, captures name/email/phone/service, and
sends all details to your Airtable Leads database automatically.

#### Step 1 — Create the agent

1. agentivehq.com → sign in → Create New Agent
2. Name: `WhatsApp Lead Gen`

#### Step 2 — System prompt

```
You are a friendly lead generation assistant for
[Business Name].

Your job:
1. Greet the person warmly
2. Find out what they need help with
3. Collect their:
   - Full name
   - Email address
   - Phone number
   - What service they are interested in
4. Once you have all four, confirm their details
   back to them and say someone will follow up
   within 2 hours
5. Save their info using the save_lead tool

Rules:
- Keep messages short — this is WhatsApp not email
- Be warm and sound like a real person
- Never make up prices or availability
```

#### Step 3 — Airtable save tool

1. Agentive → Tools/Integrations → add new HTTP Request tool
2. Name: `save_lead`
3. Description: "Save a lead after collecting their name, email, phone, and
   service. Call this the moment you have all four pieces of information."
4. Method: POST
5. URL: `https://api.airtable.com/v0/YOUR_BASE_ID/Website%20Leads` (replace
   `YOUR_BASE_ID`)
6. Headers:
   - `Authorization: Bearer YOUR_AIRTABLE_API_KEY`
   - `Content-Type: application/json`
7. Body:

```json
{
  "fields": {
    "Name": "{{name}}",
    "Email": "{{email}}",
    "Phone": "{{phone}}",
    "Message": "{{service}}",
    "Business": "[Client Business Name]"
  }
}
```

#### Step 4 — Connect to WhatsApp

1. Agentive → Integrations/Connections → find "WhatsApp Business" → Connect
2. Follow the platform steps to link a WhatsApp Business number
3. Anyone who messages that number reaches the agent

**Test**: message the WhatsApp number from your phone, have a real
conversation with fake details. After confirmation, check Airtable —
"Website Leads" should have the new record. If not, check Agentive's
execution/log for the failed step.

---

### Day 7 — Demo Videos + Final Setup

**Demo 1 — Website Agent (Voiceflow)**
1. Open a site with the chat widget embedded (or the Voiceflow test preview)
2. Screen-record a full conversation playing a homeowner asking about a
   service
3. Show the lead appearing in Airtable afterward
4. Edit to 60-90s (CapCut/iMovie, free)

**Demo 2 — WhatsApp Agent (Agentive)**
1. Screen-record your phone while messaging the WhatsApp number
2. Have a natural conversation with fake details
3. Show the Airtable record appearing afterward
4. Edit to 60-90s

Upload both to YouTube as Unlisted, save both links — these go in every
outreach message.

**Pricing (what Liam says businesses will pay):**

| Package | What It Includes | Setup Fee | Monthly |
| --- | --- | --- | --- |
| Starter | Voiceflow website chat agent | $500 | $200/mo |
| Growth | Website agent + WhatsApp agent | $1,000 | $400/mo |
| Full System | Sales Co-Pilot + Lead Qualification + Website + WhatsApp | $2,500 | $800/mo |

**Week 1 checklist before moving to Week 2:**
- [ ] Build 1 — Sales Co-Pilot live and accessible via Relevance AI share link
- [ ] Build 2 — Lead Qualification workflow active in n8n
- [ ] Build 3 — Website agent live in Voiceflow, embed code ready, phone
      number connected
- [ ] Build 4 — WhatsApp agent live in Agentive, saving leads to Airtable
- [ ] Both demo videos uploaded, links saved

> If anything on this list isn't done, fix it before moving to Week 2. Don't
> move forward with broken demos.

---

## WEEK 2 — DAYS 8–14: BUILD PROSPECT LIST + START OUTREACH

### Day 8 — Build Your Prospect List (50 Businesses)

- Google Maps: search `[your city] HVAC`, `[your city] plumber`,
  `[your city] electrician`, `[your city] roofer`, `[your city] auto repair`
- For each: owner name (About page/Facebook/LinkedIn), phone, email (website
  footer), Instagram/Facebook URL
- Add to Airtable Pipeline → Status: New
- 10 per niche, 50 total

> These niches miss the most website and phone inquiries after hours. Every
> missed lead is a $500-$8,000 job gone — that's the pitch.

---

### Day 9 — Write Your Outreach Messages

Write these once. Only swap name, business name, and niche. Send exactly as
written.

**Instagram/Facebook DM:**
```
Hey [Name] — I build AI agents for [niche] businesses
in [city]. The agent sits on your website, answers
questions 24/7, captures leads, and even takes calls.
Made a 90-second demo — mind if I send it?
```

**Cold Email:**
```
Subject: Your leads after hours

Hey [Name],

Quick question — what happens when someone visits your
website at 9pm on a Sunday and wants a quote?

Most [niche] owners say nothing. That lead is gone.

I built an AI agent that answers instantly, handles
their questions, and captures their contact info
automatically. Made a 90-second demo — want me to
send it?

— [Your Name]
```

**Cold Text (to business number):**
```
Hey [Name], this is [Your Name] — I build AI agents
for [niche] businesses in [city]. Quick demo to show
you how it works — want me to send it over?
```

**Follow-up (no reply after 2 days):**
```
Hey [Name] — just making sure this did not get
buried. Happy to send the demo, takes 90 seconds
to watch.
```

**After they say yes to seeing the demo:**
```
Here you go: [your demo video link]. That is a real
AI agent on a website answering questions and
capturing leads automatically. I can set this up
for [Business] in about a week. Want to jump on
a quick 15-min call to see how it would work
specifically for you? [Calendly link]
```

---

### Day 10 — Send First 25 Outreach Messages

- 10 Instagram/Facebook DMs
- 10 cold emails
- 5 cold texts to business numbers
- Log each in Airtable Pipeline → Status: Contacted, Follow Up Date: +2 days
- Send all 25 in one sitting, exactly as written

---

### Day 11 — Send Next 25 + Handle Replies

- Contact remaining 25 prospects with the same messages
- Check Day 10 replies:
  - Positive → send demo link immediately → Status: Demo Sent
  - "How much?" → send pricing + ask for a 15-min call → Status: Call Booked
  - Not interested → Status: Dead

---

### Day 12 — Follow Up on Non-Replies

- Filter Airtable by Follow Up Date = today → send follow-up message
- For anyone who watched the demo but hasn't booked a call:

```
Awesome — I can do a quick 15-min call to show you
exactly how it would work for [Business]. Does
[Day] at [Time] work? Here is my calendar:
[Calendly link]
```

- Update every Airtable record (Status + Notes) after every interaction

---

### Day 13 — Book 3 Demo Calls

For every warm lead not yet booked:
```
I have a few spots open this week for demos.
15 minutes and I will show the agent live. Here
is my calendar: [Calendly link]
```

**Demo call script** (practice out loud):
1. "How many leads do you think you lose from your website after hours or
   on weekends?" — let them talk
2. "What is a typical job worth to you when you book one?" — let them talk
3. "So if this agent captured even 2 extra leads a month that you would have
   missed, it pays for itself many times over right?" — wait for yes
4. "Let me pull up the demo right now." — share your screen or send the
   link, walk them through it live
5. "I can set this up for [Business Name] in about a week. Setup is $500 and
   then $200 a month. Want to move forward?"
6. If yes: "Perfect — I will send you the payment link right now." — send
   the Stripe/invoice link immediately while still on the call

---

### Day 14 — More Outreach + 20 New Prospects

- Add 20 new businesses to Airtable Pipeline (try dentists, chiropractors,
  real estate agents)
- Contact all 20 today with the same scripts
- Handle replies from the week
- Every record needs a current Status + Follow Up Date

---

## WEEK 3 — DAYS 15–21: CLOSE YOUR FIRST 3 CLIENTS

### Day 15 — Run Demo Calls + Close Client #1

Use the Day 13 script. After each call, follow up within 1 hour:
```
Great talking — here is what I will build for you:
AI agent on your website that answers questions 24/7,
captures leads automatically, and sends them to a
spreadsheet. Setup is $500 and I can have it live
within 7 days. Here is the payment link: [link]
```

The moment payment lands, text:
```
Got it — I will have your agent live within 5 to 7
days. What services do you want it to know about and
what questions do customers usually ask?
```

---

### Day 16 — Handle Objections

To everyone who said "let me think about it":
```
Hey [Name] — I am only taking 3 new clients this
month so I can give each build proper attention.
If you want to lock in your spot I can start this
week. Otherwise totally no worries.
```

**Objection scripts:**

- *"It is too expensive"* → "What if we just start with the website agent at
  $500 setup? One extra captured lead pays for it already."
- *"I need to think about it"* → "What is the main thing holding you back?"
  — then stop talking, let them tell you the real objection.
- *"Does it actually work?"* → "Let me pull the demo up right now while we
  are on the phone." — show it live.
- *"I already have a contact form"* → "Contact forms capture maybe 30
  percent of visitors — most people leave without filling anything out. This
  one starts a conversation the moment they land, answers their questions,
  and captures their info before they bounce."

---

### Day 17 — Build Client #1's Agent

Build immediately, same day they pay.

**Customize the Voiceflow website agent:**
1. Open your "Lead Gen Agent" project
2. Update the greeting Speak block with the client's real business name
3. Knowledge Base → delete test documents → upload the client's actual
   materials (service list, FAQ, pricing, anything they give you)
4. Update the "Leave Contact Info" path to tag leads with this client's
   business name in the Airtable API call
5. Click Publish, copy the new embed code, give it to the client

**Customize the WhatsApp agent:**
1. Open your "WhatsApp Lead Gen" agent in Agentive
2. Update the system prompt with the client's real business name and actual
   services
3. Update the `save_lead` tool body to tag leads with this client's business
   name
4. Test by messaging the WhatsApp number yourself before handing it over
5. If the client wants their own WhatsApp Business number, walk them through
   the Agentive integration settings

> Each new client build takes ~1-2 hours once you've done it once.

---

### Day 18 — Deliver Client #1 + Ask for a Referral

- Record a Loom (loom.com, free): show their agent on the website answering
  questions, and the lead appearing in Airtable
- Send:

```
[Name] — your agent is live. Here is a quick
walkthrough: [Loom link]. The embed code is ready
to go on your website — just paste it before the
closing body tag. Call me if you want to do it
together on a screen share.

And if you know any other [niche] owners who would
want something like this, I will send you $100
cash for any referral that signs up.
```

---

### Days 19–20 — Close Clients 2 and 3

- Airtable Pipeline → filter Status = Demo Sent or Call Booked — these are
  your only focus
- No-shows → reschedule once
- "Next week" people from last week → follow up now with urgency
- Watched demo, no call booked → send Day 16 urgency message
- Keep adding fresh outreach in parallel: 20 more businesses. Build each new
  client the same day they pay.

---

### Day 21 — Review + Restock Your Pipeline

For every "Contacted" record sitting 7+ days without a reply:
```
Hey [Name] — last time I will reach out. Closing
my books this week as my schedule is filling up.
Wanted to give you first shot before I move on.
```

Also revisit every "Dead" record — sometimes a follow-up weeks later
converts.

---

## WEEK 4 — DAYS 22–30: CLOSE CLIENTS 4 AND 5

### Day 22 — Ask Every Current Client for a Referral

Call or text each client personally (not a bulk message):
```
Hey [Name] — hoping the agent has been pulling its
weight. Do you know any other [niche] owners who
would want this? Just send them my number, I will
handle everything, and I will send you $100 cash
if they sign up.
```

---

### Days 23–24 — Expand to New Niches

- Add dentists, personal injury lawyers, and med spas (high lead-capture
  problems, high job values)
- Build a list of 30 businesses across these niches, contact all with the
  same scripts (swap the niche name)

---

### Day 25 — Post in Facebook Groups

- Join 5-10 local business owner groups
- Post once per group (don't spam):

```
Question for business owners — how many leads do
you lose from your website after hours? I have been
building AI agents that answer questions and capture
leads 24/7 automatically. Built one for a local HVAC
company — he said it captured 4 leads in the first
week he would have missed. Happy to show anyone how
it works.
```

- Reply personally to every comment

---

### Day 26 — More Direct Outreach

- Go back through your full Airtable prospect list
- Anyone you messaged but never followed up with a second time → follow up
  now
- Anyone who said "maybe later" more than 2 weeks ago → send one more
  message
- Send 20 fresh outreach messages to new businesses not yet contacted

---

### Day 27 — Build Clients 4 and 5

Same Day 17 process for both. Customize in Voiceflow and Agentive, test
thoroughly, deliver with a Loom same day. Ask for a referral immediately
after delivering.

---

### Day 28 — Ask for Testimonials

```
Hey [Name] — would you mind sending me 2 to 3
sentences about your experience with the agent?
Building out my website and it would mean a lot.
```

Screenshot every positive reply, add to your website the same day.

---

### Day 29 — Close Every Straggler

For every "maybe later" / "next month" reply in Airtable:
```
Hey [Name] — circling back. I have one spot open
this week. Want to move forward?
```

---

### Day 30 — Count Up and Plan Month 2

| Result | Target |
| --- | --- |
| Clients closed | 5 |
| Setup fees collected | $2,500–$5,000 |
| Monthly recurring revenue | $1,000–$2,000/mo |
| Total cash spent (from $1,000) | ~$25 |
| Cash still in reserve | ~$975 |

---

## ⚠️ THE THINGS THAT WILL KILL YOU

- Spending week 1 still learning instead of building. You build on Day 2.
  Period.
- Waiting for the demo to be perfect before sending it. Send it when it
  works, fix it after.
- Only sending DMs and never picking up the phone. Call the business
  directly — most people won't. That's your edge.
- Charging too much too fast. Your first 5 clients are for proof, not
  maximum profit. A locked-in client at $200/mo beats a never-closed deal at
  $1,000/mo every time.
- Targeting large companies. Local businesses with 2-20 employees say yes
  fastest and need this the most.

---

## 📊 Milestone Tracker

| Day | Milestone |
| --- | --- |
| 2 | Sales Co-Pilot live and working on Relevance AI |
| 4 | Lead Qualification agent active and tested in n8n |
| 5 | Voiceflow website agent with chat widget and phone number working |
| 6 | WhatsApp agent live in Agentive and saving leads to Airtable |
| 7 | Both demo videos uploaded to YouTube and links saved |
| 10 | 50 prospects contacted |
| 13 | 3 demo calls booked on your calendar |
| 15 | Client 1 paid, agent built and delivered |
| 20 | Clients 2 and 3 paid and delivered |
| 27 | Clients 4 and 5 paid and delivered |
| 30 | $1,000+ MRR, $2,500+ in setup fees collected |
