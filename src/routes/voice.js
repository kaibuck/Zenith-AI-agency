const express = require('express');
const router = express.Router();
const business = require('../config/business');
const aiSvc = require('../services/ai');
const Conversations = require('../services/conversation');
const Leads = require('../services/leads');
const bookingSvc = require('../services/booking');

/**
 * Builds a LAML XML response for SignalWire voice.
 * If message is provided it will be spoken, then a Gather starts for the next turn.
 * If hangup is true, the call ends instead.
 */
function buildLAML({ message, action, transferTo } = {}) {
  const voice = business.voice || 'Polly.Joanna';

  if (action === 'transfer' && transferTo) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${escapeXML(message)}</Say>
  <Dial>${escapeXML(transferTo)}</Dial>
</Response>`;
  }

  if (action === 'end' || action === 'booked') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${escapeXML(message)}</Say>
  <Hangup/>
</Response>`;
  }

  // Default: say + gather next input
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="/webhook/voice" method="POST" timeout="5" speechTimeout="auto" language="en-US">
    <Say voice="${voice}">${escapeXML(message)}</Say>
  </Gather>
  <Say voice="${voice}">I didn't catch that. Let me try again.</Say>
  <Redirect method="POST">/webhook/voice</Redirect>
</Response>`;
}

function escapeXML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * POST /webhook/voice
 *
 * Called by SignalWire on every conversation turn:
 * - Initial ring: no SpeechResult → send greeting
 * - Subsequent: SpeechResult present → process with AI
 */
router.post('/', async (req, res) => {
  res.type('text/xml');

  const callSid = req.body.CallSid || req.body.callSid || `call-${Date.now()}`;
  const from    = req.body.From   || req.body.from   || 'unknown';
  const speech  = req.body.SpeechResult || '';
  const callStatus = req.body.CallStatus || '';

  // Clean up completed/failed calls
  if (['completed', 'failed', 'busy', 'no-answer'].includes(callStatus)) {
    Conversations.delete(callSid);
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
  }

  try {
    const conv = Conversations.getOrCreate(callSid, from, 'voice');

    // ── Initial greeting ──────────────────────────────────────────────────────
    if (!speech && conv.messages.length === 0) {
      // Create lead immediately so it's tracked even if AI call fails
      const lead = Leads.create(from, 'voice');

      let greeting;
      try {
        greeting = await aiSvc.generateGreeting('voice');
      } catch (aiErr) {
        console.error('[Voice] Greeting AI error:', aiErr.message);
        greeting = `Thank you for calling ${business.name}. How can I help you today?`;
      }

      const messages = [{ role: 'assistant', content: greeting }];
      Conversations.save(callSid, messages, 'collecting_name', {}, lead.id);
      Leads.appendLog(lead.id, 'assistant', greeting);

      return res.send(buildLAML({ message: greeting, action: 'continue' }));
    }

    // ── Subsequent turns ──────────────────────────────────────────────────────
    if (!speech) {
      // No speech detected — re-prompt
      const msg = `I'm sorry, I didn't hear anything. ${conv.messages.length === 0
        ? `Thank you for calling ${business.name}. How can I help you today?`
        : 'Could you please repeat that?'}`;
      return res.send(buildLAML({ message: msg, action: 'continue' }));
    }

    // Append caller speech
    conv.messages.push({ role: 'user', content: speech });

    // Update lead log
    if (conv.lead_id) Leads.appendLog(conv.lead_id, 'user', speech);

    // Process with AI
    const result = await aiSvc.processConversation(conv.messages, conv.leadData, 'voice');

    // Append AI response
    conv.messages.push({ role: 'assistant', content: result.message });
    if (conv.lead_id) Leads.appendLog(conv.lead_id, 'assistant', result.message);

    // ── Handle actions ────────────────────────────────────────────────────────

    if (result.action === 'book') {
      await bookingSvc.completeBooking(result.collected, 'voice', conv.lead_id);
      Conversations.save(callSid, conv.messages, 'booked', result.collected, conv.lead_id);
      return res.send(buildLAML({ message: result.message, action: 'booked' }));
    }

    if (result.action === 'transfer') {
      Conversations.delete(callSid);
      return res.send(buildLAML({
        message: result.message,
        action: 'transfer',
        transferTo: business.transferPhone,
      }));
    }

    if (result.action === 'end') {
      Conversations.delete(callSid);
      return res.send(buildLAML({ message: result.message, action: 'end' }));
    }

    if (result.action === 'fallback') {
      const fallback = `I'm sorry, I'm having trouble understanding. Let me connect you with our team.`;
      Conversations.delete(callSid);
      return res.send(buildLAML({
        message: fallback,
        action: 'transfer',
        transferTo: business.transferPhone,
      }));
    }

    // Continue collecting information
    Conversations.save(callSid, conv.messages, conv.state, result.collected, conv.lead_id);
    return res.send(buildLAML({ message: result.message, action: 'continue' }));

  } catch (err) {
    console.error('[Voice webhook] Error:', err.message);
    res.send(buildLAML({
      message: `Thank you for calling ${business.name}. We're experiencing a brief technical issue. Please hold while I connect you.`,
      action: 'transfer',
      transferTo: business.transferPhone,
    }));
  }
});

module.exports = router;
