const axios = require('axios');
const business = require('../config/business');

/**
 * Sends an SMS via the SignalWire REST API.
 * Uses the same Twilio-compatible endpoint that SignalWire exposes.
 */
async function sendSMS(to, body) {
  const projectId = process.env.SIGNALWIRE_PROJECT_ID;
  const token = process.env.SIGNALWIRE_API_TOKEN;
  const space = process.env.SIGNALWIRE_SPACE;
  const from = process.env.SIGNALWIRE_PHONE_NUMBER || business.phone;

  if (!projectId || !token || !space) {
    console.warn('[SMS] SignalWire credentials missing — skipping SMS send');
    console.log(`[SMS MOCK] To: ${to} | Body: ${body}`);
    return null;
  }

  const url = `https://${space}/api/laml/2010-04-01/Accounts/${projectId}/Messages.json`;

  try {
    const res = await axios.post(
      url,
      new URLSearchParams({ From: from, To: to, Body: body }).toString(),
      {
        auth: { username: projectId, password: token },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      }
    );
    console.log(`[SMS] Sent to ${to}: SID ${res.data.sid}`);
    return res.data;
  } catch (err) {
    console.error('[SMS] Send error:', err.response?.data || err.message);
    return null;
  }
}

// ─── SMS Templates ────────────────────────────────────────────────────────────

function confirmationText(name, service, dateTime) {
  return (
    `Hi ${name}! Your ${service} appointment is confirmed for ${dateTime}. ` +
    `We look forward to seeing you! Reply CANCEL to cancel. — ${business.name}`
  );
}

function ownerNotificationText(name, service, dateTime, phone) {
  return (
    `New booking! ${name} booked ${service} for ${dateTime}. ` +
    `Phone: ${phone} — via AI Receptionist`
  );
}

function reminderText(name, service, dateTime) {
  return (
    `Hi ${name}! Reminder: your ${service} appointment is tomorrow at ${dateTime}. ` +
    `See you soon! — ${business.name}`
  );
}

function fallbackText() {
  return (
    `Hi! Thanks for reaching out to ${business.name}. We'll get back to you shortly. ` +
    `For immediate help, call us at ${business.phone}.`
  );
}

function cancellationText(name) {
  return `Hi ${name}, your appointment has been cancelled. We hope to see you soon! — ${business.name}`;
}

async function sendConfirmation(customerPhone, name, service, dateTime) {
  await sendSMS(customerPhone, confirmationText(name, service, dateTime));
}

async function notifyOwner(name, service, dateTime, customerPhone) {
  await sendSMS(business.ownerPhone, ownerNotificationText(name, service, dateTime, customerPhone));
}

async function sendReminder(customerPhone, name, service, dateTime) {
  await sendSMS(customerPhone, reminderText(name, service, dateTime));
}

async function sendFallback(customerPhone) {
  await sendSMS(customerPhone, fallbackText());
}

module.exports = {
  sendSMS,
  sendConfirmation,
  notifyOwner,
  sendReminder,
  sendFallback,
  cancellationText,
  templates: { confirmationText, ownerNotificationText, reminderText, fallbackText },
};
