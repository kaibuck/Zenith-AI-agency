require('dotenv').config();
const twilio = require('twilio');
const { google } = require('googleapis');

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// This would typically query the database/Data Store for appointments 
// starting in 3 hours.

async function sendReminders() {
  console.log('Checking for appointments starting in 3 hours...');
  
  // Logic:
  // 1. Get current time + 3 hours.
  // 2. Query Calendar or DB for events at that time.
  // 3. For each event, send SMS.

  /* MOCK IMPLEMENTATION */
  const mockAppointments = [
    // { phone: '+1234567890', name: 'John Doe', time: '2:00 PM', service: 'Plumbing' }
  ];

  for (const appt of mockAppointments) {
    try {
      await twilioClient.messages.create({
        body: `Reminder: Your Zenith ${appt.service} appointment is in 3 hours (at ${appt.time}). See you soon!`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: appt.phone
      });
      console.log(`Reminder sent to ${appt.phone}`);
    } catch (err) {
      console.error(`Failed to send reminder to ${appt.phone}`, err.message);
    }
  }
}

// In a real server, this might run on a cron job.
// For the demo, we can just export it.
module.exports = { sendReminders };
