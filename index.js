require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const twilio = require('twilio');
const { execSync } = require('child_process');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Helper function to interact with team-db
function queryTeamDb(sql) {
  try {
    const output = execSync(`team-db "${sql.replace(/"/g, '\\"')}"`).toString();
    return JSON.parse(output);
  } catch (err) {
    console.error('team-db error:', err.message);
    return null;
  }
}

// Google Calendar Client
const calendar = google.calendar('v3');

// Twilio Client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * 1. Retell Tool Call: Check Availability
 */
app.post('/retell/check-availability', async (req, res) => {
  try {
    const { preferredDateTime, appointmentDate, appointmentTime } = req.body;
    const input = preferredDateTime || `${appointmentDate || ''} ${appointmentTime || ''}`.trim();
    console.log(`[Retell AI] Checking availability for: ${input}`);

    // If no date provided, default to a generic "available" response
    if (!input) {
      return res.json({
        isAvailable: true,
        message: "Please let me know what date and time you were thinking of.",
        suggestedSlots: "We are available all next week."
      });
    }

    const date = new Date(input);
    const dayOfWeek = isNaN(date.getTime()) ? 1 : date.getUTCDay(); // Default to Monday if unparseable

    let isAvailable = true;
    let message = "That time works perfectly.";
    let suggestedSlots = "";

    // Zenith HVAC is closed on weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      isAvailable = false;
      message = "I am sorry, we are actually closed on weekends.";
      suggestedSlots = "We have availability this coming Monday, Tuesday, and Wednesday between 9 AM and 5 PM. Which of those days would work better for you?";
    }

    res.json({
      isAvailable: isAvailable,
      message: message,
      suggestedSlots: suggestedSlots
    });
  } catch (err) {
    console.error('Error in retell/check-availability:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const axios = require('axios'); // Ensure axios is available or use another fetch method

/**
 * 2. Retell Tool Call: Book Appointment (Live during call)
 */
app.post('/retell/book-appointment', async (req, res) => {
  try {
    const { customerName, customerPhone, appointmentDate, appointmentTime, serviceAddress, serviceType, preferredDateTime } = req.body;
    const finalDateTime = preferredDateTime || `${appointmentDate || ''} ${appointmentTime || ''}`.trim();
    const phone = customerPhone || "Customer-Phone-Not-Provided";

    console.log(`[Retell AI] Booking confirmed for ${customerName} at ${finalDateTime}`);

    // 1. Trigger Google Apps Script Calendar Bridge
    const calendarScriptUrl = 'https://script.google.com/macros/s/AKfycbzfWBHqm6A9og62Mlskc5yDhxJCUilwq2J6dSVuAz52KHRHQkLxVFWbR0J8Y4w4e_an/exec';
    
    try {
      const response = await axios.post(calendarScriptUrl, {
        customerName,
        customerPhone: phone,
        appointmentDate: finalDateTime, // Send the combined string if separate ones aren't clear
        serviceAddress,
        serviceType
      });
      console.log('[Calendar] Apps Script response:', response.data);
    } catch (err) {
      console.error('[Calendar] Failed to trigger Apps Script:', err.message);
    }

    // 2. Persistent Store (team-db)
    const eventId = `retell-event-${Date.now()}`;
    queryTeamDb(`INSERT OR REPLACE INTO appointments (phone, event_id, customer_name, appointment_date, appointment_time, service_address, service_type, reminder_sent, owner_notified) VALUES ('${phone}', '${eventId}', '${customerName}', '${finalDateTime}', '', '${serviceAddress}', '${serviceType}', 0, 0)`);

    // 3. Send SMS to Owner
    if (process.env.OWNER_PHONE_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: `New Zenith Booking (Live): ${customerName} wants ${serviceType} on ${finalDateTime}. Address: ${serviceAddress}. Phone: ${phone}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: process.env.OWNER_PHONE_NUMBER
        });
        console.log(`[Twilio] Notification sent to owner: ${process.env.OWNER_PHONE_NUMBER}`);
      } catch (err) {
        console.error('Failed to send SMS to owner:', err.message);
      }
    }

    // 4. Send SMS to Customer
    if (phone !== "Customer-Phone-Not-Provided") {
      try {
        await twilioClient.messages.create({
          body: `Hi ${customerName}, your ${serviceType} appointment with Zenith is confirmed for ${finalDateTime}. We'll see you at ${serviceAddress}. Reply 'OPT OUT' to cancel.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone
        });
        console.log(`[Twilio] Confirmation sent to customer: ${phone}`);
      } catch (err) {
        console.error('Failed to send SMS to customer:', err.message);
      }
    }

    res.json({
      status: "success",
      message: "The appointment has been booked, added to your calendar, and confirmation texts have been sent."
    });
  } catch (err) {
    console.error('Error in retell/book-appointment:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * 3. Retell Webhook (End of Call Analysis)
 */
app.post('/retell/webhook', async (req, res) => {
  try {
    const { event_type, call } = req.body;
    console.log(`[Retell AI] Webhook received: ${event_type}`);

    if (event_type === 'call_analyzed') {
      const analysis = call.call_analysis.custom_analysis_data;
      if (!analysis) {
        console.log('[Retell AI] No custom analysis data found.');
        return res.sendStatus(204);
      }

      const customerName = analysis.customerName || 'Valued Customer';
      const customerPhone = call.from_number; // Call object provides this
      const serviceType = analysis.serviceType || 'HVAC/Plumbing Service';
      const appointmentDate = analysis.appointmentDate;
      const appointmentTime = analysis.appointmentTime;
      const serviceAddress = analysis.serviceAddress || 'Address not provided';

      if (!appointmentDate || !appointmentTime) {
        console.log('[Retell AI] Booking details incomplete, skipping automation.');
        return res.sendStatus(204);
      }

      console.log(`[Retell AI] Processing booking for ${customerName} at ${appointmentDate} ${appointmentTime}`);

      // 1. Create Google Calendar Event via Apps Script
      const calendarScriptUrl = 'https://script.google.com/macros/s/AKfycbzfWBHqm6A9og62Mlskc5yDhxJCUilwq2J6dSVuAz52KHRHQkLxVFWbR0J8Y4w4e_an/exec';
      try {
        await axios.post(calendarScriptUrl, {
          customerName,
          customerPhone,
          appointmentDate: `${appointmentDate} ${appointmentTime}`,
          serviceAddress,
          serviceType
        });
        console.log('[Calendar] Booking request sent to Apps Script via Webhook.');
      } catch (err) {
        console.error('[Calendar] Failed to trigger Apps Script via Webhook:', err.message);
      }

      const eventId = `retell-event-${Date.now()}`;
      
      // PERSISTENT STORE (team-db)
      queryTeamDb(`INSERT OR REPLACE INTO appointments (phone, event_id, customer_name, appointment_date, appointment_time, service_address, service_type, reminder_sent, owner_notified) VALUES ('${customerPhone}', '${eventId}', '${customerName}', '${appointmentDate}', '${appointmentTime}', '${serviceAddress}', '${serviceType}', 0, 0)`);

      // 2. Send SMS to Owner
      if (process.env.OWNER_PHONE_NUMBER) {
        try {
          await twilioClient.messages.create({
            body: `New Zenith (Retell AI) Booking: ${customerName} wants ${serviceType} on ${appointmentDate} at ${appointmentTime}. Address: ${serviceAddress}. Phone: ${customerPhone}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: process.env.OWNER_PHONE_NUMBER
          });
          console.log(`[Twilio] Notification sent to owner: ${process.env.OWNER_PHONE_NUMBER}`);
        } catch (err) {
          console.error('Failed to send SMS to owner:', err.message);
        }
      }

      // 3. Send SMS to Customer
      try {
        await twilioClient.messages.create({
          body: `Hi ${customerName}, your ${serviceType} appointment with Zenith is confirmed for ${appointmentDate} at ${appointmentTime}. We'll see you at ${serviceAddress}. Reply 'OPT OUT' to cancel.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: customerPhone
        });
        console.log(`[Twilio] Confirmation sent to customer: ${customerPhone}`);
      } catch (err) {
        console.error('Failed to send SMS to customer:', err.message);
      }
    }

    res.sendStatus(204); // Retell expects 2xx and no body
  } catch (err) {
    console.error('Error in retell/webhook:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Helper to delete event from Google Calendar via Apps Script bridge
 */
async function deleteCalendarEvent(booking) {
  const calendarScriptUrl = 'https://script.google.com/macros/s/AKfycbzfWBHqm6A9og62Mlskc5yDhxJCUilwq2J6dSVuAz52KHRHQkLxVFWbR0J8Y4w4e_an/exec';
  try {
    console.log(`[Calendar] Attempting to delete event for ${booking.customer_name} on ${booking.appointment_date}`);
    await axios.post(calendarScriptUrl, {
      action: 'delete',
      customerName: booking.customer_name,
      customerPhone: booking.phone,
      appointmentDate: booking.appointment_date
    });
    console.log('[Calendar] Deletion request sent to Apps Script.');
  } catch (err) {
    console.error('[Calendar] Failed to trigger deletion in Apps Script:', err.message);
  }
}

/**
 * 3. Twilio SMS Webhook (Inbound)
 * Handles customer 'OPT OUT' cancellations.
 */
app.post('/twilio/sms', async (req, res) => {
  try {
    const { Body, From } = req.body;
    console.log(`[Twilio] Inbound SMS from ${From}: ${Body}`);

    if (Body.trim().toUpperCase() === 'OPT OUT') {
      const results = queryTeamDb(`SELECT * FROM appointments WHERE phone = '${From}'`);
      const booking = results && results.length > 0 ? results[0] : null;

      if (booking) {
        console.log(`[Twilio] Opt-out received. Cancelling appointment for ${From}`);
        
        // 1. Delete from Calendar
        await deleteCalendarEvent(booking);

        // 2. Notify Owner
        if (process.env.OWNER_PHONE_NUMBER) {
          try {
            await twilioClient.messages.create({
              body: `Zenith Notification: Appointment for ${booking.customer_name} on ${booking.appointment_date} has been CANCELED by the customer.`,
              from: process.env.TWILIO_PHONE_NUMBER,
              to: process.env.OWNER_PHONE_NUMBER
            });
            console.log(`[Twilio] Cancellation alert sent to owner.`);
          } catch (err) {
            console.error('Failed to notify owner of cancellation:', err.message);
          }
        }

        // Clean up store
        queryTeamDb(`DELETE FROM appointments WHERE phone = '${From}'`);
        
        res.send('<Response><Sms>Your Zenith appointment has been canceled successfully. We hope to serve you another time.</Sms></Response>');
      } else {
        console.log(`[Twilio] No active booking found for ${From}`);
        res.send('<Response><Sms>We couldn\'t find an active appointment for this number. If you need assistance, please call us back.</Sms></Response>');
      }
    } else {
      res.sendStatus(200);
    }
  } catch (err) {
    console.error('Error in twilio-sms:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * 4. Periodic Reminder System
 * Checks for appointments starting in roughly 3 hours.
 */
async function checkReminders() {
  const twoHoursInMs = 2 * 60 * 60 * 1000;
  const threeHoursInMs = 3 * 60 * 60 * 1000;
  const fifteenMinsInMs = 15 * 60 * 1000;

  try {
    console.log('[Reminders] Checking for upcoming appointments...');
    const now = new Date();

    // Fetch all pending appointments where reminder hasn't been sent
    const appointments = queryTeamDb(`SELECT * FROM appointments WHERE reminder_sent = 0`);
    if (!appointments || appointments.length === 0) return;

    for (const appt of appointments) {
      try {
        // Attempt to parse appointment_date (YYYY-MM-DD) and appointment_time (e.g. "2 PM")
        let apptDateStr = `${appt.appointment_date} ${appt.appointment_time}`.trim();
        // Assume America/New_York if no timezone specified
        if (!apptDateStr.includes('GMT') && !apptDateStr.includes('Z')) {
           apptDateStr += ' GMT-0400'; // Eastern Daylight Time (approx)
        }
        const apptDate = new Date(apptDateStr);

        if (isNaN(apptDate.getTime())) {
           console.log(`[Reminders] Skipping appointment for ${appt.phone} - unparseable date: ${apptDateStr}`);
           continue;
        }

        const timeDiff = apptDate.getTime() - now.getTime();

        // Send reminder if appointment is between 2 and 4 hours away (roughly 3 hours)
        if (timeDiff > 0 && timeDiff <= (threeHoursInMs + fifteenMinsInMs) && timeDiff >= twoHoursInMs) {
           console.log(`[Reminders] Sending 3-hour reminder to ${appt.phone}`);

           await twilioClient.messages.create({
             body: `Reminder: Your Zenith ${appt.service_type} appointment is in 3 hours at ${appt.appointment_time}. See you soon!`,
             from: process.env.TWILIO_PHONE_NUMBER,
             to: appt.phone
           });

           queryTeamDb(`UPDATE appointments SET reminder_sent = 1 WHERE phone = '${appt.phone}'`);
        }
      } catch (err) {
        console.error(`[Reminders] Failed to process reminder for ${appt.phone}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Reminders] Error in reminder cycle:', err.message);
  }
}

/**
 * 5. Owner Daily Summary (7 AM)
 */
async function checkOwnerNotifications() {
  try {
    const options = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' };
    const todayStr = new Date().toLocaleDateString('en-CA', options); // Format: YYYY-MM-DD
    const currentHour = parseInt(new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }));

    // Only send summary during the 7 AM hour
    if (currentHour !== 7) return;

    // Check if summary already sent today
    const state = queryTeamDb(`SELECT value FROM system_state WHERE key = 'last_daily_summary_date'`);
    if (state && state.length > 0 && state[0].value === todayStr) {
      return; // Already sent
    }

    console.log(`[Owner Summary] Generating 7 AM daily summary for ${todayStr}...`);
    
    // Fetch all appointments for today
    const appointments = queryTeamDb(`SELECT * FROM appointments WHERE appointment_date LIKE '${todayStr}%'`);
    
    if (appointments && appointments.length > 0) {
      let summary = `Zenith Daily Schedule (${todayStr}):\n`;
      appointments.forEach((appt, index) => {
        summary += `${index + 1}. ${appt.customer_name} - ${appt.appointment_time || 'No Time'} - ${appt.service_type} - ${appt.service_address}\n`;
      });

      if (process.env.OWNER_PHONE_NUMBER) {
        await twilioClient.messages.create({
          body: summary,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: process.env.OWNER_PHONE_NUMBER
        });
        console.log('[Owner Summary] Daily summary sent to owner.');
      }
    } else {
      console.log('[Owner Summary] No appointments scheduled for today.');
    }

    // Mark as sent
    queryTeamDb(`INSERT OR REPLACE INTO system_state (key, value) VALUES ('last_daily_summary_date', '${todayStr}')`);

  } catch (err) {
    console.error('[Owner Summary] Error in owner summary cycle:', err.message);
  }
}

// Run checks every 15 minutes
setInterval(async () => {
  await checkReminders();
  await checkOwnerNotifications();
}, 15 * 60 * 1000);

// Root route for health check
app.get('/', (req, res) => {
  res.send('Zenith AI Agency - HVAC Dispatcher Backend - ACTIVE');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zenith Retell AI Backend listening on port ${PORT}`);
});
