const { google } = require('googleapis');

const calendar = google.calendar('v3');

async function checkAvailability(auth, start, end) {
  // In a real implementation, this would use freebusy.query or events.list
  // For now, it's a placeholder.
  return true;
}

async function createEvent(auth, details) {
  const event = {
    summary: `Zenith HVAC/Plumbing: ${details.customerName}`,
    location: details.serviceAddress,
    description: `Service: ${details.serviceType}. Phone: ${details.customerPhone}`,
    start: {
      dateTime: details.startDateTime,
      timeZone: 'America/New_York', // Should be configurable
    },
    end: {
      dateTime: details.endDateTime,
      timeZone: 'America/New_York',
    },
    reminders: {
      useDefault: true,
    },
  };

  const response = await calendar.events.insert({
    auth,
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    resource: event,
  });

  return response.data;
}

async function deleteEvent(auth, eventId) {
  await calendar.events.delete({
    auth,
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    eventId: eventId,
  });
}

module.exports = {
  checkAvailability,
  createEvent,
  deleteEvent
};
