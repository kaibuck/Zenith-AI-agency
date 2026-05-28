# Zenith AI Receptionist

A production-ready AI receptionist system for local businesses. Handles phone calls and SMS, qualifies leads, books appointments on Google Calendar, and sends confirmation texts — all automatically.

## Features

- **Phone calls** via SignalWire — AI speaks naturally using Amazon Polly voices
- **SMS conversations** — full back-and-forth text qualification
- **Lead collection** — name, service, preferred time, phone number
- **Google Calendar booking** — creates events automatically with reminders
- **Confirmation texts** — customer confirmation + owner notification
- **Admin dashboard** — leads table, conversation logs, live stats, settings editor
- **Multi-business ready** — change 5 settings to white-label for a new client

---

## Quick Start

### 1. Clone & Install

```bash
git clone <repo>
cd zenith-ai-receptionist
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials (see [Configuration](#configuration)).

### 3. Run the Server

```bash
npm start
# or for auto-restart during development:
npm run dev
```

Visit `http://localhost:3000/admin` for the dashboard.

### 4. Expose to the Internet (for SignalWire webhooks)

SignalWire needs a public URL to POST to. Use [ngrok](https://ngrok.com) for local testing:

```bash
ngrok http 3000
# Copy the https URL, e.g. https://abc123.ngrok.io
```

Set `BASE_URL=https://abc123.ngrok.io` in `.env`.

### 5. Configure SignalWire

In your [SignalWire dashboard](https://signalwire.com):

1. Go to **Phone Numbers** → select your number
2. Set **Voice webhook** to: `https://your-domain.com/webhook/voice` (POST)
3. Set **SMS webhook** to: `https://your-domain.com/webhook/sms` (POST)

---

## Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `SIGNALWIRE_PROJECT_ID` | SignalWire Project ID |
| `SIGNALWIRE_API_TOKEN` | SignalWire API token |
| `SIGNALWIRE_SPACE` | e.g. `your-space.signalwire.com` |
| `SIGNALWIRE_PHONE_NUMBER` | Your SignalWire phone number |
| `OPENAI_API_KEY` | OpenAI API key (GPT-4o) |
| `ADMIN_PASSWORD` | Password for the admin dashboard |
| `SESSION_SECRET` | Random 32-char string for session security |

### Optional (for Calendar)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/auth/google/callback` |
| `GOOGLE_REFRESH_TOKEN` | Obtained via OAuth flow (see below) |
| `GOOGLE_CALENDAR_ID` | Calendar to book on (default: `primary`) |

### Business Settings

Edit `src/config/business.js` or use **Admin → Settings** (settings saved to DB override the config file):

```javascript
module.exports = {
  name: "My Business",
  phone: "+15551234567",       // SignalWire number
  ownerPhone: "+15559876543",  // Gets booking notifications
  timezone: "America/Chicago",
  hours: {
    monday: { open: "09:00", close: "17:00" },
    saturday: { open: "10:00", close: "15:00" },
    sunday: null,  // null = closed
  },
  services: [
    { name: "Service A", duration: 60, price: 85 },
    { name: "Service B", duration: 90, price: 120 },
  ],
};
```

---

## Google Calendar Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable **Google Calendar API**
3. Create **OAuth 2.0 credentials** (Web application)
4. Add `http://localhost:3000/auth/google/callback` as an authorized redirect URI
5. Copy Client ID and Secret into `.env`
6. Start the server, go to **Admin → Settings → Connect Google Calendar**
7. Authorize the app — copy the refresh token from the page that appears
8. Add `GOOGLE_REFRESH_TOKEN=...` to `.env` and restart

The system works without Google Calendar (appointments are still saved to the database and confirmation texts still send).

---

## Architecture

```
src/
├── server.js               # Express app, routes, middleware
├── config/
│   └── business.js         # Business config (services, hours, etc.)
├── db/
│   └── database.js         # SQLite schema setup (better-sqlite3)
├── routes/
│   ├── voice.js            # POST /webhook/voice  (SignalWire voice)
│   ├── sms.js              # POST /webhook/sms    (SignalWire SMS)
│   └── admin.js            # /api/admin/*         (dashboard API)
├── services/
│   ├── ai.js               # OpenAI GPT-4o conversations
│   ├── booking.js          # Orchestrates calendar + SMS on booking
│   ├── calendar.js         # Google Calendar API
│   ├── conversation.js     # Stateful session management (SQLite)
│   ├── leads.js            # Lead CRUD operations
│   └── sms.js              # SignalWire REST SMS sender + templates
└── public/
    ├── index.html          # Admin dashboard
    ├── style.css           # Clean modern UI
    └── app.js              # Dashboard JavaScript
```

### Conversation Flow (Voice)

```
1. Call arrives → SignalWire POSTs to /webhook/voice
2. AI generates greeting (GPT-4o)
3. <Gather input="speech"> collects caller's response
4. Each turn: speech → OpenAI → LAML response
5. AI collects: name → service → preferred time → confirms phone
6. When complete: books Google Calendar, sends confirmation SMS, notifies owner
7. Thanks caller and hangs up
```

### Conversation Flow (SMS)

```
1. SMS arrives → SignalWire POSTs to /webhook/sms
2. STOP/CANCEL → opt-out handling
3. AI responds via LAML <Message>
4. Same collection flow as voice
5. Books appointment on completion
```

---

## Deployment

### Railway / Render / Fly.io

```bash
# Set environment variables in the platform dashboard
# Then deploy:
railway up
# or
fly deploy
```

### Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
CMD ["node", "src/server.js"]
```

### Environment for Production

```env
NODE_ENV=production
BASE_URL=https://your-app.railway.app
GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/google/callback
```

---

## Duplicating for a New Business Client

To deploy a second business client:

1. **Copy** this repo or use the same codebase with a different `.env`
2. **Change** in `.env` or Admin Settings:
   - `BUSINESS_NAME`
   - `SIGNALWIRE_PHONE_NUMBER` (get a new SignalWire number)
   - `OWNER_PHONE`
   - Services, hours in Admin → Settings
3. **Point** the new SignalWire number webhooks at the new deployment URL
4. Done — the AI will use the new business name, services, and hours automatically

---

## Admin Dashboard

Visit `/admin` (password from `ADMIN_PASSWORD` env var).

| Feature | Location |
|---------|----------|
| Total leads, today's bookings, conversion rate | Dashboard |
| All leads with status, conversation log | Leads |
| Mark as booked/contacted/lost | Leads → click row |
| Send manual SMS | Leads → click row → Send SMS |
| Edit business name, hours, services | Settings |
| Connect Google Calendar | Settings |
| View SMS templates | SMS Templates |

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook/voice` | SignalWire voice webhook |
| POST | `/webhook/sms` | SignalWire SMS webhook |
| GET | `/health` | Health check |
| GET | `/auth/google/callback` | Google OAuth2 callback |
| POST | `/api/admin/login` | Dashboard login |
| GET | `/api/admin/stats` | Lead stats |
| GET | `/api/admin/leads` | List leads |
| PATCH | `/api/admin/leads/:id` | Update lead status/notes |
| DELETE | `/api/admin/leads/:id` | Delete lead |
| POST | `/api/admin/leads/:id/sms` | Send manual SMS |
| GET | `/api/admin/settings` | Get business settings |
| PUT | `/api/admin/settings` | Save business settings |

---

## Troubleshooting

**"SignalWire credentials missing"** → Check `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN`, `SIGNALWIRE_SPACE` in `.env`

**Calendar events not creating** → Verify `GOOGLE_REFRESH_TOKEN` is set. Visit Admin → Settings → Connect Google Calendar to re-authorize.

**Voice webhook not receiving calls** → Ensure ngrok is running and the URL in SignalWire dashboard matches exactly.

**AI responses look wrong** → Check `OPENAI_API_KEY` is valid and has GPT-4o access.
