const Leads = require('./leads');
const calendarSvc = require('./calendar');
const smsSvc = require('./sms');
const business = require('../config/business');

/**
 * Parses a natural-language preferred time string into an ISO 8601 datetime.
 * Falls back to next business day at 10:00 AM if parsing fails.
 */
function parsePreferredTime(preferredTimeStr) {
  if (!preferredTimeStr) return null;

  // Try to parse common date strings
  const now = new Date();
  const parsed = new Date(preferredTimeStr);

  if (!isNaN(parsed.getTime()) && parsed > now) {
    return parsed.toISOString();
  }

  // Heuristic: if string contains "tomorrow", set to tomorrow at 10 AM
  const lower = preferredTimeStr.toLowerCase();
  if (lower.includes('tomorrow')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  }

  // Fallback: next weekday at 10 AM
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

/**
 * Completes a booking: creates/updates the lead, creates calendar event, sends SMS.
 *
 * @param {Object} leadData  - {name, service, preferredTime, phone}
 * @param {string} channel   - 'voice' | 'sms'
 * @param {number} [leadId]  - existing lead ID to update
 * @returns {Promise<{lead, calendarEvent, startISO}>}
 */
async function completeBooking(leadData, channel = 'voice', leadId = null) {
  const { name, service, preferredTime, phone } = leadData;

  let lead;
  if (leadId) {
    lead = Leads.findById(leadId);
  }
  if (!lead) {
    lead = Leads.create(phone, channel);
    leadId = lead.id;
  }

  const startISO = parsePreferredTime(preferredTime);

  // Update lead record
  Leads.update(leadId, {
    name,
    service,
    preferred_time: preferredTime,
    status: 'booked',
  });

  // Book calendar event
  let calendarEvent = null;
  try {
    calendarEvent = await calendarSvc.createAppointment({
      customerName: name,
      customerPhone: phone,
      service,
      startISO,
    });

    if (calendarEvent?.id) {
      Leads.update(leadId, {
        appointment_id: calendarEvent.id,
        appointment_start: startISO,
      });
    }
  } catch (err) {
    console.error('[Booking] Calendar error:', err.message);
  }

  // Format human-readable time for SMS
  const friendlyTime = preferredTime || 'your scheduled time';

  // Send confirmation to customer
  try {
    await smsSvc.sendConfirmation(phone, name, service, friendlyTime);
  } catch (err) {
    console.error('[Booking] Confirmation SMS error:', err.message);
  }

  // Notify business owner
  try {
    await smsSvc.notifyOwner(name, service, friendlyTime, phone);
  } catch (err) {
    console.error('[Booking] Owner notification SMS error:', err.message);
  }

  const updatedLead = Leads.findById(leadId);
  return { lead: updatedLead, calendarEvent, startISO };
}

module.exports = { completeBooking, parsePreferredTime };
