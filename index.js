require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const twilio = require('twilio');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// In-memory data store for the demo (Phone -> Event ID)
// In production, use a database or Make Data Store/Google Sheets
const appointmentStore = {};

// Google Calendar Mock/Client
const calendar = google.calendar('v3');
const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Twilio Client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * 1. Check Availability (Vapi Tool Call)
 */
app.post('/vapi/check-availability', async (req, res) => {
  const { preferredDateTime } = req.body.message.toolCalls[0].function.arguments;
  console.log(`Checking availability for: ${preferredDateTime}`);

  // MOCK LOGIC: In a real app, you'd check Google Calendar here.
  // For now, we'll return a fixed response or simulate a check.
  
  const isAvailable = Math.random() > 0.3; // 70% availability for demo
  const suggestedSlots = [
    "Monday at 9:00 AM",
    "Tuesday at 2:00 PM",
    "Wednesday at 11:00 AM"
  ];

  res.json({
    results: [
      {
        toolCallId: req.body.message.toolCalls[0].id,
        result: {
            isAvailable,
            suggestedSlots: isAvailable ? [] : suggestedSlots
        }
      }
    ]
  });
});

/**
 * 2. End of Call Report (Vapi Webhook)
 */
app.post('/vapi/end-of-call', async (req, res) => {
  const report = req.body.message;
  if (report.type !== 'end-of-call-report') {
    return res.sendStatus(200);
  }

  const { customerName, customerPhone, serviceType, appointmentDate, appointmentTime, serviceAddress } = report.analysis.structuredData;

  console.log(`Booking appointment for ${customerName} at ${appointmentDate} ${appointmentTime}`);

  // 1. Create Google Calendar Event (Mocked)
  const eventId = `mock-event-${Date.now()}`;
  appointmentStore[customerPhone] = {
    eventId,
    customerName,
    appointmentDate,
    appointmentTime,
    serviceAddress
  };

  // 2. Send SMS to Owner
  try {
    await twilioClient.messages.create({
      body: `New Zenith Booking: ${customerName} wants ${serviceType} on ${appointmentDate} at ${appointmentTime}. Address: ${serviceAddress}. Phone: ${customerPhone}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.OWNER_PHONE_NUMBER
    });
  } catch (err) {
    console.error('Failed to send SMS to owner', err.message);
  }

  // 3. Send SMS to Customer
  try {
    await twilioClient.messages.create({
      body: `Hi ${customerName}, your ${serviceType} appointment with Zenith is confirmed for ${appointmentDate} at ${appointmentTime}. We'll see you at ${serviceAddress}. Reply 'OPT OUT' to cancel.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: customerPhone
    });
  } catch (err) {
    console.error('Failed to send SMS to customer', err.message);
  }

  res.sendStatus(200);
});

/**
 * 3. Twilio SMS Webhook (Cancellation)
 */
app.post('/twilio/sms', async (req, res) => {
  const { Body, From } = req.body;

  if (Body.toUpperCase() === 'OPT OUT') {
    const booking = appointmentStore[From];
    if (booking) {
      console.log(`Cancelling appointment for ${From}`);
      
      // 1. Delete from Calendar (Mocked)
      // calendar.events.delete({ calendarId: 'primary', eventId: booking.eventId });

      // 2. Notify Owner
      try {
        await twilioClient.messages.create({
          body: `Zenith Notification: Appointment for ${booking.customerName} on ${booking.appointmentDate} has been CANCELED by the customer.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: process.env.OWNER_PHONE_NUMBER
        });
      } catch (err) {
        console.error('Failed to notify owner of cancellation', err.message);
      }

      delete appointmentStore[From];
      
      res.send('<Response><Sms>Your appointment has been canceled successfully.</Sms></Response>');
    } else {
      res.send('<Response><Sms>No active appointment found for this number.</Sms></Response>');
    }
  } else {
    res.sendStatus(200);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zenith Backend listening on port ${PORT}`);
});
