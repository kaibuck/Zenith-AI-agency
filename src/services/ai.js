const { OpenAI } = require('openai');
const business = require('../config/business');

let _openai = null;
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'not-set' });
  }
  return _openai;
}

/**
 * Builds the system prompt injected into every conversation.
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

RESPONSE FORMAT (always valid JSON, no markdown, no extra text):
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

  // Inject current lead data so the model knows what's already collected
  const contextNote = `Already collected: ${JSON.stringify(leadData)}. Channel: ${channel}.`;

  const chatMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: contextNote },
    ...messages,
  ];

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: chatMessages,
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 400,
  });

  let parsed;
  try {
    parsed = JSON.parse(response.choices[0].message.content);
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
 * Generates a one-shot greeting for new inbound calls.
 */
async function generateGreeting(channel = 'voice') {
  const prompt = channel === 'voice'
    ? `A customer just called ${business.name}. Generate a warm, professional greeting. Introduce the business and ask how you can help. Keep it under 2 sentences.`
    : `A customer just texted ${business.name}. Generate a warm, brief greeting SMS. Introduce the business and ask how you can help.`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: `You are the receptionist for ${business.name}.` },
      { role: 'user', content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 100,
  });

  return response.choices[0].message.content.trim();
}

module.exports = { processConversation, generateGreeting };
