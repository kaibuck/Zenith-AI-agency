const { google } = require('googleapis');
const business = require('../config/business');

/**
 * Returns an authenticated Google OAuth2 client using a stored refresh token.
 * The refresh token is obtained once via /auth/google and persisted in .env.
 */
function getAuth() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2;
}

const calendar = google.calendar({ version: 'v3' });

/**
 * Creates a calendar event and returns the event object.
 *
 * @param {Object} details
 * @param {string} details.customerName
 * @param {string} details.customerPhone
 * @param {string} details.service        - Service name (must match business.services)
 * @param {string} details.startISO       - ISO 8601 start datetime
 * @param {string} [details.customerEmail]
 */
async function createAppointment(details) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    console.warn('[Calendar] No refresh token — skipping calendar event creation');
    return { id: `mock-${Date.now()}`, htmlLink: null };
  }

  const svc = business.services.find(s => s.name === details.service);
  const durationMins = svc ? svc.duration : 60;

  const start = new Date(details.startISO);
  const end = new Date(start.getTime() + durationMins * 60 * 1000);

  const attendees = [];
  if (details.customerEmail) attendees.push({ email: details.customerEmail });

  const event = {
    summary: `${details.service} — ${details.customerName}`,
    description: `Phone: ${details.customerPhone}\nService: ${details.service}\nBooked via AI Receptionist`,
    start: { dateTime: start.toISOString(), timeZone: business.timezone },
    end:   { dateTime: end.toISOString(),   timeZone: business.timezone },
    attendees,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 1440 }, // 24 hours
        { method: 'popup', minutes: 60 },
      ],
    },
  };

  const auth = getAuth();
  const res = await calendar.events.insert({
    auth,
    calendarId: details.calendarId || business.calendarId,
    resource: event,
    sendUpdates: attendees.length ? 'all' : 'none',
  });

  console.log(`[Calendar] Event created: ${res.data.id}`);
  return res.data;
}

/**
 * Deletes a calendar event by ID.
 */
async function deleteAppointment(eventId, calendarId) {
  if (!process.env.GOOGLE_REFRESH_TOKEN || eventId.startsWith('mock-')) return;
  const auth = getAuth();
  await calendar.events.delete({
    auth,
    calendarId: calendarId || business.calendarId,
    eventId,
  });
  console.log(`[Calendar] Event deleted: ${eventId}`);
}

/**
 * Lists upcoming events for conflict checking.
 */
async function listUpcoming(maxResults = 10) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return [];
  const auth = getAuth();
  const res = await calendar.events.list({
    auth,
    calendarId: business.calendarId,
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
  return res.data.items || [];
}

/**
 * OAuth2 helpers — used by /auth/google routes to obtain initial refresh token.
 */
function getAuthUrl() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
}

async function exchangeCode(code) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

module.exports = { createAppointment, deleteAppointment, listUpcoming, getAuthUrl, exchangeCode };
