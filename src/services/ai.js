const Anthropic = require('@anthropic-ai/sdk');
const business = require('../config/business');

let _anthropic = null;
function getClient() {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'not-set' });
  }
  return _anthropic;
}

/**
 * Builds the system prompt injected into every conversation.
 * This text is constant per business config and qualifies for prompt caching.
 */
function buildSystemPrompt() {
  const days = Object.entries(business.hours)
    .map(([day, h]) => {
      if (!h) return `  ${day}: Closed`;
      return `  ${day}: ${h.open} – ${h.close}`;
    })
    .join('\n');

  const services = business.services
    .map(s => `  - ${s.name} (${s.duration} min${s.price ? `, $${s.price}` : ', free'})`)
    .join('\n');

  return `You are the AI receptionist for ${business.name}. Your role is to warmly greet callers/texters, answer questions about the business, and book appointments.

BUSINESS INFO:
  Name: ${business.name}
  Tagline: ${business.tagline}
  Phone: ${business.phone}

SERVICES:
${services}

HOURS (${business.timezone}):
${days}

RULES — follow these strictly:
1. Ask only ONE question per response. Never stack questions.
2. Collect information in this order: full name → service needed → preferred day and time → confirm phone number (you may already have it from caller ID).
3. Once you have all four pieces, confirm the booking details and set action to "book".
4. If any urgent keyword is detected (emergency, urgent, pain, asap, etc.) set action to "transfer".
5. Be warm, concise, and professional. Mirror the customer's energy.
6. If you cannot understand the request after two clarification attempts, set action to "fallback".
7. Never make up service names, prices, or hours not listed above.
8. Timezone is ${business.timezone} — always interpret times in that zone.

RESPONSE FORMAT — you MUST respond with valid JSON only. No markdown, no extra text, no code fences. The raw response must be parseable by JSON.parse():
{
  "message": "<natural language response to say/send>",
  "action": "continue | book | transfer | end | fallback",
  "collected": {
    "name": "<string or null>",
    "service": "<exact service name from list or null>",
    "preferredTime": "<human-readable date/time string or null>",
    "phone": "<E.164 format or null>"
  }
}`;
}

/**
 * Processes a conversation turn.
 *
 * @param {Array}  messages  - Full conversation history [{role, content}]
 * @param {Object} leadData  - Already-collected lead data {name, service, preferredTime, phone}
 * @param {string} channel   - 'voice' or 'sms'
 * @returns {Promise<{message, action, collected}>}
 */
async function processConversation(messages, leadData = {}, channel = 'voice') {
  const systemPrompt = buildSystemPrompt();
  const contextNote = `Already collected: ${JSON.stringify(leadData)}. Channel: ${channel}.`;

  // Convert messages to Anthropic format (roles must alternate user/assistant, starting with user)
  const anthropicMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  // Anthropic requires the first message to be from 'user'
  // If conversation starts with an assistant greeting, prepend a dummy user turn
  let finalMessages = anthropicMessages;
  if (finalMessages.length > 0 && finalMessages[0].role === 'assistant') {
    finalMessages = [{ role: 'user', content: '[conversation started]' }, ...finalMessages];
  }

  const response = await getClient().messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 400,
    system: [
      // Large constant block — cache it
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: contextNote },
    ],
    messages: finalMessages,
  });

  const text = response.content[0]?.text || '';

  let parsed;
  try {
    // Strip any accidental markdown fences before parsing
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    parsed = {
      message: `Thank you for contacting ${business.name}. Let me connect you with our team.`,
      action: 'fallback',
      collected: leadData,
    };
  }

  // Merge newly collected data with existing (don't overwrite with null)
  const merged = { ...leadData };
  if (parsed.collected) {
    for (const [k, v] of Object.entries(parsed.collected)) {
      if (v !== null && v !== undefined && v !== '') merged[k] = v;
    }
  }

  return {
    message: parsed.message || '',
    action: parsed.action || 'continue',
    collected: merged,
  };
}

/**
 * Generates a one-shot greeting for new inbound calls/texts.
 */
async function generateGreeting(channel = 'voice') {
  const prompt = channel === 'voice'
    ? `A customer just called ${business.name}. Generate a warm, professional greeting. Introduce the business and ask how you can help. Keep it under 2 sentences. Return plain text only — no JSON.`
    : `A customer just texted ${business.name}. Generate a warm, brief greeting SMS. Introduce the business and ask how you can help. Return plain text only — no JSON.`;

  const response = await getClient().messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 100,
    system: `You are the receptionist for ${business.name}.`,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0]?.text?.trim() || `Thank you for contacting ${business.name}. How can I help you today?`;
}

module.exports = { processConversation, generateGreeting };
