const { google } = require('googleapis');

const calendar = google.calendar('v3');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const TIME_ZONE = process.env.MEETING_TIMEZONE || 'America/New_York';
const MEETING_MINUTES = parseInt(process.env.MEETING_DURATION_MINUTES || '30', 10);
const DAY_START_HOUR = parseInt(process.env.MEETING_DAY_START_HOUR || '9', 10);
const DAY_END_HOUR = parseInt(process.env.MEETING_DAY_END_HOUR || '17', 10);

// ─── Auth ────────────────────────────────────────────────────────────────────
// Uses an OAuth refresh token for the calendar owner. Run `npm run google-auth` once to get it.
function getAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

// ─── Time helpers ────────────────────────────────────────────────────────────
// Wall-clock parts of a Date in the meeting time zone (no external tz library needed).
function localParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return { weekday: get('weekday'), hour: parseInt(get('hour'), 10) % 24, minute: parseInt(get('minute'), 10) };
}

function formatForSpeech(date) {
  return date.toLocaleString('en-US', {
    timeZone: TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function isBusinessSlot(start) {
  const end = new Date(start.getTime() + MEETING_MINUTES * 60 * 1000);
  const s = localParts(start);
  const e = localParts(end);
  if (s.weekday === 'Sat' || s.weekday === 'Sun') return false;
  if (s.hour < DAY_START_HOUR) return false;
  const endMinutes = e.hour * 60 + e.minute;
  return endMinutes <= DAY_END_HOUR * 60 && endMinutes > s.hour * 60 + s.minute;
}

// ─── Availability ────────────────────────────────────────────────────────────
async function getBusyIntervals(auth, timeMin, timeMax) {
  const response = await calendar.freebusy.query({
    auth,
    requestBody: { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id: CALENDAR_ID }] }
  });
  const busy = response.data.calendars[CALENDAR_ID]?.busy || [];
  return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

function overlaps(start, end, busy) {
  return busy.some((b) => start < b.end && end > b.start);
}

// Returns up to `limit` open slots, starting no sooner than `minLeadHours` from now.
async function findOpenSlots({ from, days = 7, limit = 3, minLeadHours = 2 } = {}) {
  const auth = getAuth();
  const step = 30 * 60 * 1000;
  const earliest = Date.now() + minLeadHours * 60 * 60 * 1000;
  let cursor = Math.max(earliest, from ? new Date(from).getTime() : 0);
  cursor = Math.ceil(cursor / step) * step;
  const windowEnd = new Date(cursor + days * 24 * 60 * 60 * 1000);

  const busy = await getBusyIntervals(auth, new Date(cursor), windowEnd);
  const slots = [];
  for (let t = cursor; t < windowEnd.getTime() && slots.length < limit; t += step) {
    const start = new Date(t);
    const end = new Date(t + MEETING_MINUTES * 60 * 1000);
    if (isBusinessSlot(start) && !overlaps(start, end, busy)) {
      slots.push({ start: start.toISOString(), spoken: formatForSpeech(start) });
      t += step; // leave a gap so the offered options aren't back-to-back
    }
  }
  return slots;
}

async function isSlotFree(startIso) {
  const start = new Date(startIso);
  if (isNaN(start.getTime()) || !isBusinessSlot(start)) return false;
  const end = new Date(start.getTime() + MEETING_MINUTES * 60 * 1000);
  const busy = await getBusyIntervals(getAuth(), start, end);
  return !overlaps(start, end, busy);
}

// ─── Booking ─────────────────────────────────────────────────────────────────
async function createEvent(details) {
  const start = new Date(details.startDateTime);
  const end = details.endDateTime
    ? new Date(details.endDateTime)
    : new Date(start.getTime() + MEETING_MINUTES * 60 * 1000);

  const event = {
    summary: details.summary,
    location: details.location,
    description: details.description,
    start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
    attendees: details.attendeeEmail ? [{ email: details.attendeeEmail, displayName: details.attendeeName }] : [],
    conferenceData: details.addMeetLink
      ? { createRequest: { requestId: `zenith-${start.getTime()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } }
      : undefined,
    reminders: { useDefault: true }
  };

  const response = await calendar.events.insert({
    auth: getAuth(),
    calendarId: CALENDAR_ID,
    conferenceDataVersion: details.addMeetLink ? 1 : 0,
    sendUpdates: details.attendeeEmail ? 'all' : 'none',
    requestBody: event
  });

  return { ...response.data, spokenTime: formatForSpeech(start) };
}

async function deleteEvent(eventId) {
  await calendar.events.delete({ auth: getAuth(), calendarId: CALENDAR_ID, eventId });
}

module.exports = {
  getAuth,
  findOpenSlots,
  isSlotFree,
  createEvent,
  deleteEvent,
  formatForSpeech
};
