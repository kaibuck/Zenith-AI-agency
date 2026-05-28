const express = require('express');
const router = express.Router();
const business = require('../config/business');
const aiSvc = require('../services/ai');
const Conversations = require('../services/conversation');
const Leads = require('../services/leads');
const bookingSvc = require('../services/booking');
const smsSvc = require('../services/sms');

/**
 * Wraps a text message in SignalWire/Twilio-compatible LAML for SMS.
 */
function smsLAML(message) {
  const escaped = String(message)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escaped}</Message>
</Response>`;
}

/**
 * POST /webhook/sms
 *
 * Handles inbound SMS from SignalWire.
 * Conversation state is keyed by the sender's phone number (From).
 */
router.post('/', async (req, res) => {
  res.type('text/xml');

  const from = req.body.From || req.body.from || '';
  const body = (req.body.Body || req.body.body || '').trim();

  if (!from) {
    return res.send(smsLAML(`Hello! Thank you for contacting ${business.name}. How can we help you?`));
  }

  // ── Opt-out / stop ────────────────────────────────────────────────────────
  const upperBody = body.toUpperCase();
  if (['STOP', 'CANCEL', 'UNSUBSCRIBE', 'OPT OUT', 'OPTOUT'].includes(upperBody)) {
    Conversations.delete(from);
    return res.send(smsLAML(`You've been unsubscribed from ${business.name} messages. Reply START to re-subscribe.`));
  }
  if (['START', 'SUBSCRIBE', 'UNSTOP'].includes(upperBody)) {
    return res.send(smsLAML(`Welcome back! You're now subscribed to messages from ${business.name}. How can we help?`));
  }

  try {
    const conv = Conversations.getOrCreate(from, from, 'sms');

    // ── New conversation ──────────────────────────────────────────────────────
    if (conv.messages.length === 0) {
      const lead = Leads.create(from, 'sms');

      let greeting;
      try {
        greeting = await aiSvc.generateGreeting('sms');
      } catch (aiErr) {
        console.error('[SMS] Greeting AI error:', aiErr.message);
        greeting = `Hi! Thanks for reaching out to ${business.name}. How can we help you today?`;
      }

      conv.messages.push({ role: 'assistant', content: greeting });
      Conversations.save(from, conv.messages, 'greeting', {}, lead.id);
      Leads.appendLog(lead.id, 'assistant', greeting);

      // Also append user's first message so the AI has context next turn
      conv.messages.push({ role: 'user', content: body });
      const result = await aiSvc.processConversation(conv.messages, {}, 'sms');
      conv.messages.push({ role: 'assistant', content: result.message });

      Leads.appendLog(lead.id, 'user', body);
      Leads.appendLog(lead.id, 'assistant', result.message);

      if (result.action === 'book') {
        await bookingSvc.completeBooking(result.collected, 'sms', lead.id);
        Conversations.save(from, conv.messages, 'booked', result.collected, lead.id);
      } else {
        Conversations.save(from, conv.messages, 'collecting', result.collected, lead.id);
      }

      return res.send(smsLAML(result.message));
    }

    // ── Existing conversation ─────────────────────────────────────────────────
    conv.messages.push({ role: 'user', content: body });
    if (conv.lead_id) Leads.appendLog(conv.lead_id, 'user', body);

    const result = await aiSvc.processConversation(conv.messages, conv.leadData, 'sms');
    conv.messages.push({ role: 'assistant', content: result.message });
    if (conv.lead_id) Leads.appendLog(conv.lead_id, 'assistant', result.message);

    if (result.action === 'book') {
      await bookingSvc.completeBooking(result.collected, 'sms', conv.lead_id);
      Conversations.save(from, conv.messages, 'booked', result.collected, conv.lead_id);
      return res.send(smsLAML(result.message));
    }

    if (result.action === 'fallback') {
      Conversations.delete(from);
      await smsSvc.sendFallback(from);
      return res.send(smsLAML(smsSvc.templates.fallbackText()));
    }

    Conversations.save(from, conv.messages, conv.state, result.collected, conv.lead_id);
    return res.send(smsLAML(result.message));

  } catch (err) {
    console.error('[SMS webhook] Error:', err.message);
    return res.send(smsLAML(`Thank you for contacting ${business.name}. We'll be in touch shortly!`));
  }
});

module.exports = router;
