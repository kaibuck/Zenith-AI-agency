const express = require('express');
const axios = require('axios');
const { findLeads } = require('./leadFinder');
const store = require('./leadStore');
const meetingCalendar = require('./calendar');

// ============================================================================
//  OUTBOUND LEAD AGENT
//  1. Find leads (Google Places)  2. Call them (Vapi AI voice)  3. Book a meeting (Google Calendar)
// ============================================================================

const config = {
  agencyName: process.env.AGENCY_NAME || 'Zenith AI Agency',
  callerName: process.env.AGENT_CALLER_NAME || 'Alex',
  ownerName: process.env.OWNER_NAME || 'our founder',
  pitch: process.env.AGENCY_PITCH ||
    'We set up AI receptionists that answer every call 24/7, book jobs straight into your calendar, and text customers reminders, so you never lose a lead to voicemail.',
  meetingPurpose: process.env.MEETING_PURPOSE || 'a 30-minute demo call',
  defaultQuery: process.env.LEAD_SEARCH_QUERY || 'HVAC contractor',
  defaultLocation: process.env.LEAD_SEARCH_LOCATION || '',
  timeZone: process.env.MEETING_TIMEZONE || 'America/New_York',
  callStartHour: parseInt(process.env.CALL_START_HOUR || '9', 10),
  callEndHour: parseInt(process.env.CALL_END_HOUR || '17', 10),
  maxAttempts: parseInt(process.env.MAX_CALL_ATTEMPTS || '2', 10),
  maxCallsPerDay: parseInt(process.env.MAX_CALLS_PER_DAY || '50', 10),
  callsPerRun: parseInt(process.env.CALLS_PER_RUN || '3', 10),
  publicUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  modelProvider: process.env.VAPI_MODEL_PROVIDER || 'anthropic',
  model: process.env.VAPI_MODEL || 'claude-sonnet-5-5',
  doNotCall: new Set((process.env.DNC_NUMBERS || '').split(',').map((n) => store.normalizePhone(n.trim())).filter(Boolean))
};

const NO_ANSWER_REASONS = ['customer-did-not-answer', 'customer-busy', 'voicemail', 'silence-timed-out'];
const FINAL_STATUSES = ['booked', 'not_interested', 'do_not_call', 'failed'];

// ─── Guards ──────────────────────────────────────────────────────────────────
function localNow() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: config.timeZone, weekday: 'short', hour: 'numeric', hour12: false })
    .formatToParts(new Date());
  return {
    weekday: parts.find((p) => p.type === 'weekday').value,
    hour: parseInt(parts.find((p) => p.type === 'hour').value, 10) % 24
  };
}

function withinCallingHours() {
  const { weekday, hour } = localNow();
  return weekday !== 'Sat' && weekday !== 'Sun' && hour >= config.callStartHour && hour < config.callEndHour;
}

function callsMadeToday() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: config.timeZone });
  return store.getLeads().reduce((count, lead) => count + lead.calls.filter((c) =>
    c.type === 'dialed' && new Date(c.at).toLocaleDateString('en-CA', { timeZone: config.timeZone }) === today
  ).length, 0);
}

function isCallable(lead) {
  if (config.doNotCall.has(lead.phone)) return false;
  if (lead.status === 'new') return true;
  if (lead.status !== 'no_answer' && lead.status !== 'callback') return false;
  if (lead.attempts >= config.maxAttempts) return false;
  const last = lead.lastCalledAt ? new Date(lead.lastCalledAt).getTime() : 0;
  return Date.now() - last > 20 * 60 * 60 * 1000; // retry no sooner than the next day
}

// ─── Vapi assistant ──────────────────────────────────────────────────────────
function buildAssistant(lead) {
  const now = new Date().toLocaleString('en-US', { timeZone: config.timeZone, dateStyle: 'full', timeStyle: 'short' });
  const serverUrl = `${config.publicUrl}/vapi/outbound`;
  const server = { url: serverUrl, ...(process.env.VAPI_WEBHOOK_SECRET && { secret: process.env.VAPI_WEBHOOK_SECRET }) };

  const systemPrompt = `You are ${config.callerName}, an AI assistant calling on behalf of ${config.agencyName}.
You are making a short, friendly outbound call to ${lead.businessName}${lead.address ? ` (${lead.address})` : ''}.
Current date and time: ${now} (${config.timeZone}).

What ${config.agencyName} does: ${config.pitch}

Your goal: book ${config.meetingPurpose} between the business owner or decision maker and ${config.ownerName}.

Rules:
- You already told them you are an AI assistant in your first message. If asked, always confirm you are an AI. Never claim to be human.
- Keep it brief and conversational: one or two sentences per turn. Do not read lists aloud.
- If you reach a gatekeeper, politely ask for the owner or the best time to reach them. If they give a time, thank them and end the call.
- If they are interested, call check_availability and offer at most two of the returned times. If they suggest a different time, call check_availability with that time.
- Once they agree to a time, ask for the name of the person attending and an email address for the calendar invite, spell the email back to confirm it, then call book_meeting with the exact ISO start time returned by check_availability.
- After booking, confirm the day and time out loud, thank them, and end the call.
- If they say they are not interested, thank them and end the call. Do not push more than once.
- If they ask not to be called again, or to be removed from the list, apologize, call mark_do_not_call, and end the call.
- Never make up prices, guarantees, or facts you were not given. Offer to have ${config.ownerName} cover details on the meeting.`;

  const tool = (name, description, properties, required = []) => ({
    type: 'function',
    function: { name, description, parameters: { type: 'object', properties, required } },
    server
  });

  return {
    name: `${config.agencyName} Outbound`.slice(0, 40),
    firstMessage: `Hi, this is ${config.callerName}, an AI assistant calling from ${config.agencyName}. Am I speaking with the owner of ${lead.businessName}?`,
    firstMessageMode: 'assistant-speaks-first',
    model: {
      provider: config.modelProvider,
      model: config.model,
      messages: [{ role: 'system', content: systemPrompt }],
      tools: [
        tool('check_availability', 'Get open meeting times on the calendar. Optionally pass the time the prospect asked for.', {
          preferredTime: { type: 'string', description: 'ISO 8601 date-time the prospect suggested, if any, e.g. 2026-10-20T14:00:00-04:00' }
        }),
        tool('book_meeting', 'Book the meeting on the calendar once the prospect agrees to a time.', {
          startTime: { type: 'string', description: 'ISO 8601 start time, exactly as returned by check_availability' },
          contactName: { type: 'string', description: 'Name of the person attending' },
          email: { type: 'string', description: 'Email address for the calendar invite' }
        }, ['startTime', 'contactName']),
        tool('mark_do_not_call', 'Use when the prospect asks not to be called again.', {}),
        { type: 'endCall' }
      ]
    },
    server,
    serverMessages: ['tool-calls', 'end-of-call-report'],
    voicemailMessage: process.env.VOICEMAIL_MESSAGE ||
      `Hi, this is ${config.callerName}, an AI assistant from ${config.agencyName}. We help businesses like ${lead.businessName} stop missing calls. We'll try you again another time. Thanks!`,
    endCallMessage: 'Thanks for your time. Have a great day!'
  };
}

async function callLead(lead) {
  if (!config.publicUrl) throw new Error('PUBLIC_BASE_URL is not set; Vapi needs it to reach the tool webhook.');

  store.updateLead(lead.id, { status: 'calling', attempts: lead.attempts + 1, lastCalledAt: new Date().toISOString() });

  try {
    const response = await axios.post('https://api.vapi.ai/call', {
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      customer: { number: lead.phone, name: lead.businessName?.slice(0, 40), externalId: lead.id },
      assistant: buildAssistant(lead)
    }, { headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` } });

    store.updateLead(lead.id, { lastCallId: response.data.id });
    store.appendCall(lead.id, { type: 'dialed', callId: response.data.id });
    console.log(`[Lead Agent] Calling ${lead.businessName} (${lead.phone}) - call ${response.data.id}`);
    return response.data;
  } catch (err) {
    const reason = err.response?.data?.message || err.message;
    console.error(`[Lead Agent] Call to ${lead.phone} failed:`, reason);
    store.updateLead(lead.id, { status: lead.attempts + 1 >= config.maxAttempts ? 'failed' : 'no_answer' });
    store.appendCall(lead.id, { type: 'dial_error', error: String(reason) });
    throw err;
  }
}

async function dialNext(limit = config.callsPerRun, { ignoreHours = false } = {}) {
  if (!ignoreHours && !withinCallingHours()) return { dialed: [], skipped: 'outside calling hours' };
  const remaining = config.maxCallsPerDay - callsMadeToday();
  if (remaining <= 0) return { dialed: [], skipped: 'daily call limit reached' };

  const queue = store.getLeads().filter(isCallable).slice(0, Math.min(limit, remaining));
  const dialed = [];
  for (const lead of queue) {
    try {
      const call = await callLead(lead);
      dialed.push({ leadId: lead.id, businessName: lead.businessName, callId: call.id });
    } catch (err) { /* already logged and recorded on the lead */ }
  }
  return { dialed };
}

// ─── Tool handlers (called by Vapi mid-call) ────────────────────────────────
function leadFromMessage(message) {
  const call = message.call || {};
  const id = call.customer?.externalId;
  if (id) return store.getLead(id);
  return store.getLeads().find((l) => l.lastCallId === call.id) || null;
}

async function handleTool(name, args, lead, notify) {
  if (name === 'check_availability') {
    if (args.preferredTime && await meetingCalendar.isSlotFree(args.preferredTime)) {
      const start = new Date(args.preferredTime);
      return `That time is open: ${meetingCalendar.formatForSpeech(start)} (startTime ${start.toISOString()}).`;
    }
    const slots = await meetingCalendar.findOpenSlots({ from: args.preferredTime });
    if (slots.length === 0) return 'No open times in the next week. Offer to have someone follow up by email.';
    const prefix = args.preferredTime ? 'That time is not available. ' : '';
    return `${prefix}Open times: ${slots.map((s) => `${s.spoken} (startTime ${s.start})`).join('; ')}.`;
  }

  if (name === 'book_meeting') {
    if (!lead) return 'Could not find this lead record. Tell them someone will follow up by email to confirm.';
    if (!await meetingCalendar.isSlotFree(args.startTime)) {
      const slots = await meetingCalendar.findOpenSlots({ from: args.startTime });
      return `That time was just taken. Offer these instead: ${slots.map((s) => `${s.spoken} (startTime ${s.start})`).join('; ')}.`;
    }
    const event = await meetingCalendar.createEvent({
      startDateTime: args.startTime,
      summary: `${config.agencyName} x ${lead.businessName}`,
      location: 'Google Meet',
      description: [
        `Booked by AI caller.`,
        `Business: ${lead.businessName}`,
        `Contact: ${args.contactName}${args.email ? ` <${args.email}>` : ''}`,
        `Phone: ${lead.phone}`,
        lead.address && `Address: ${lead.address}`,
        lead.website && `Website: ${lead.website}`,
        lead.rating && `Google rating: ${lead.rating} (${lead.reviewCount} reviews)`
      ].filter(Boolean).join('\n'),
      attendeeEmail: args.email,
      attendeeName: args.contactName,
      addMeetLink: true
    });
    store.updateLead(lead.id, {
      status: 'booked',
      contactName: args.contactName,
      email: args.email || null,
      meeting: { eventId: event.id, start: args.startTime, link: event.htmlLink }
    });
    await notify(`New meeting booked by your AI caller: ${lead.businessName} (${args.contactName}, ${lead.phone}) on ${event.spokenTime}.`);
    return `Booked for ${event.spokenTime}.${args.email ? ' A calendar invite is on its way to their email.' : ''}`;
  }

  if (name === 'mark_do_not_call') {
    if (lead) store.updateLead(lead.id, { status: 'do_not_call' });
    return 'Marked as do not call. Apologize and end the call.';
  }

  return `Unknown tool ${name}`;
}

function handleEndOfCall(message, lead) {
  if (!lead) return;
  const reason = message.endedReason || '';
  const summary = message.analysis?.summary || message.summary || null;
  store.appendCall(lead.id, {
    type: 'ended',
    callId: message.call?.id,
    endedReason: reason,
    summary,
    transcript: message.artifact?.transcript || message.transcript || null,
    recordingUrl: message.artifact?.recordingUrl || message.recordingUrl || null
  });

  const current = store.getLead(lead.id);
  if (FINAL_STATUSES.includes(current.status)) return;
  const noAnswer = NO_ANSWER_REASONS.some((r) => reason.includes(r));
  let status = noAnswer ? 'no_answer' : 'callback';
  if (status === 'callback' && /not interested|no thanks|not a fit/i.test(summary || '')) status = 'not_interested';
  if (current.attempts >= config.maxAttempts && status !== 'callback') status = noAnswer ? 'failed' : status;
  store.updateLead(lead.id, { status });
}

// ─── Router ──────────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!process.env.ADMIN_API_KEY) return res.status(503).json({ error: 'Set ADMIN_API_KEY to use lead agent endpoints.' });
  if (req.get('x-api-key') !== process.env.ADMIN_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function createLeadAgent({ notify = async () => {} } = {}) {
  const router = express.Router();

  // Find new leads and save them. Body: { query, location, maxResults }
  router.post('/leads/find', requireAdmin, async (req, res) => {
    try {
      const { query = config.defaultQuery, location = config.defaultLocation, maxResults = 20 } = req.body || {};
      const found = await findLeads({ query, location, maxResults });
      const added = store.addLeads(found);
      res.json({ found: found.length, added: added.length, leads: added });
    } catch (err) {
      console.error('[Lead Agent] Find error:', err.response?.data || err.message);
      res.status(500).json({ error: err.response?.data?.error?.message || err.message });
    }
  });

  router.get('/leads', requireAdmin, (req, res) => {
    res.json(store.getLeads({ status: req.query.status }));
  });

  // Dial the next batch of callable leads. Body: { limit, ignoreHours }
  router.post('/leads/call', requireAdmin, async (req, res) => {
    try {
      res.json(await dialNext(req.body?.limit, { ignoreHours: req.body?.ignoreHours === true }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Call one specific lead now (still respects do-not-call).
  router.post('/leads/:id/call', requireAdmin, async (req, res) => {
    const lead = store.getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (lead.status === 'do_not_call' || config.doNotCall.has(lead.phone)) return res.status(400).json({ error: 'Lead is on the do-not-call list' });
    try {
      res.json(await callLead(lead));
    } catch (err) {
      res.status(502).json({ error: err.response?.data?.message || err.message });
    }
  });

  // Vapi webhook: tool calls during the call + end-of-call report.
  router.post('/vapi/outbound', async (req, res) => {
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    if (secret && req.get('x-vapi-secret') !== secret) return res.status(401).send('Unauthorized');

    const message = req.body?.message || {};
    const lead = leadFromMessage(message);

    if (message.type === 'tool-calls') {
      const results = [];
      for (const toolCall of message.toolCallList || []) {
        let args = toolCall.function?.arguments || {};
        if (typeof args === 'string') { try { args = JSON.parse(args); } catch (e) { args = {}; } }
        try {
          results.push({ toolCallId: toolCall.id, result: await handleTool(toolCall.function?.name, args, lead, notify) });
        } catch (err) {
          console.error(`[Lead Agent] Tool ${toolCall.function?.name} error:`, err.message);
          results.push({ toolCallId: toolCall.id, error: 'The calendar is unavailable right now. Offer to have someone follow up by email.' });
        }
      }
      return res.json({ results });
    }

    if (message.type === 'end-of-call-report') handleEndOfCall(message, lead);
    res.sendStatus(200);
  });

  return router;
}

// Optional autopilot: during calling hours, dial a batch; top up leads when the queue runs dry.
function startAutopilot() {
  if (process.env.LEAD_AGENT_AUTORUN !== 'true') return;
  console.log('[Lead Agent] Autopilot on');
  setInterval(async () => {
    try {
      if (!withinCallingHours()) return;
      if (!store.getLeads().some(isCallable) && config.defaultLocation) {
        store.addLeads(await findLeads({ query: config.defaultQuery, location: config.defaultLocation, maxResults: 20 }));
      }
      await dialNext();
    } catch (err) { console.error('[Lead Agent] Autopilot error:', err.message); }
  }, 15 * 60 * 1000);
}

module.exports = { createLeadAgent, startAutopilot, dialNext, buildAssistant };
