require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const twilio = require('twilio');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// ─── Database ────────────────────────────────────────────────────────────────
function esc(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/'/g, "''");
}

function queryTeamDb(sql) {
  try {
    const output = execSync(`team-db "${sql.replace(/"/g, '\\"')}"`).toString();
    return JSON.parse(output);
  } catch (err) {
    console.error('team-db error:', err.message);
    return null;
  }
}

// ─── Clients ─────────────────────────────────────────────────────────────────
const calendar = google.calendar('v3');
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const VoiceResponse = twilio.twiml.VoiceResponse;

async function sendSMS(to, body) {
  try {
    await twilioClient.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER, to });
  } catch (error) {
    console.error('SMS error:', error.message);
  }
}

async function addCalendarEvent(details) {
  const calendarScriptUrl = 'https://script.google.com/macros/s/AKfycbzfWBHqm6A9og62Mlskc5yDhxJCUilwq2J6dSVuAz52KHRHQkLxVFWbR0J8Y4w4e_an/exec';
  try {
    const axios = require('axios');
    await axios.post(calendarScriptUrl, {
      customerName: details.customer_name,
      customerPhone: details.customer_phone,
      appointmentDate: details.service_time,
      serviceAddress: details.customer_address,
      serviceType: details.service_type || 'HVAC/Plumbing Service'
    });
    console.log('[Calendar] Event created for', details.customer_name);
  } catch (error) {
    console.error('[Calendar] Error:', error.message);
  }
}

async function deleteCalendarEvent(booking) {
  const calendarScriptUrl = 'https://script.google.com/macros/s/AKfycbzfWBHqm6A9og62Mlskc5yDhxJCUilwq2J6dSVuAz52KHRHQkLxVFWbR0J8Y4w4e_an/exec';
  try {
    const axios = require('axios');
    await axios.post(calendarScriptUrl, {
      action: 'delete',
      customerName: booking.customer_name,
      customerPhone: booking.phone,
      appointmentDate: booking.appointment_date
    });
    console.log('[Calendar] Deletion sent');
  } catch (err) {
    console.error('[Calendar] Delete error:', err.message);
  }
}

// ============================================================================
//  CALL FLOW: Twilio Voice Webhook (Speech-to-Text)
// ============================================================================

// Step 1: Ask for name
app.post('/voice', (req, res) => {
  const twiml = new VoiceResponse();
  const gather = twiml.gather({ input: 'speech', action: '/voice/name', timeout: 3, language: 'en-US' });
  gather.say('Thank you for calling Zenith HVAC and Plumbing. To help us schedule your service, please state your full name after the beep.');
  twiml.say("We didn't catch that. Please try calling again later.");
  res.type('text/xml');
  res.send(twiml.toString());
});

// Step 2: Ask for address
app.post('/voice/name', (req, res) => {
  const twiml = new VoiceResponse();
  const name = req.body.SpeechResult;
  if (name) {
    const gather = twiml.gather({ input: 'speech', action: `/voice/address?name=${encodeURIComponent(name)}`, timeout: 3, language: 'en-US' });
    gather.say(`Thank you, ${name}. Now, please tell us the address where you need service.`);
  } else {
    twiml.redirect('/voice');
  }
  res.type('text/xml');
  res.send(twiml.toString());
});

// Step 3: Ask for time
app.post('/voice/address', (req, res) => {
  const twiml = new VoiceResponse();
  const name = req.query.name;
  const address = req.body.SpeechResult;
  if (address) {
    const gather = twiml.gather({ input: 'speech', action: `/voice/time?name=${encodeURIComponent(name)}&address=${encodeURIComponent(address)}`, timeout: 3, language: 'en-US' });
    gather.say('Got it. What is your preferred date and time for the appointment?');
  } else {
    twiml.say("I'm sorry, I didn't get the address.");
    twiml.redirect(`/voice/name?SpeechResult=${encodeURIComponent(name)}`);
  }
  res.type('text/xml');
  res.send(twiml.toString());
});

// Step 4: Book it
app.post('/voice/time', async (req, res) => {
  const twiml = new VoiceResponse();
  const name = req.query.name;
  const address = req.query.address;
  const time = req.body.SpeechResult;
  const phone = req.body.From;

  if (time) {
    const customerName = esc(name);
    const customerPhone = esc(phone);
    const customerAddress = esc(address);
    const serviceTime = esc(time);
    const eventId = uuidv4();

    // 1. Save to team-db (appointments table, used by reminders & opt-out)
    queryTeamDb(`INSERT INTO appointments (phone, event_id, customer_name, appointment_date, appointment_time, service_address, service_type, reminder_sent, owner_notified) VALUES ('${customerPhone}', '${eventId}', '${customerName}', '', '${serviceTime}', '${customerAddress}', 'HVAC/Plumbing Service', 0, 0)`);

    // 2. Save to bookings table too for backward compat
    queryTeamDb(`INSERT OR IGNORE INTO bookings (id, customer_name, customer_phone, customer_address, service_time, status) VALUES ('${eventId}', '${customerName}', '${customerPhone}', '${customerAddress}', '${serviceTime}', 'booked')`);

    // 3. SMS to Owner
    const ownerMsg = `New lead! Name: ${name}, Phone: ${phone}, Address: ${address}, Time: ${time}`;
    await sendSMS(process.env.OWNER_PHONE_NUMBER, ownerMsg);

    // 4. SMS to Customer
    const customerMsg = `Hi ${name}, your appointment with Zenith HVAC & Plumbing is confirmed for ${time}. We'll see you at ${address}. Reply OPT OUT to cancel.`;
    await sendSMS(phone, customerMsg);

    // 5. Google Calendar via Apps Script
    await addCalendarEvent({ customer_name: name, customer_phone: phone, customer_address: address, service_time: time });

    twiml.say('Thank you! Your appointment has been booked. You will receive a confirmation text. Have a great day!');
    twiml.hangup();
  } else {
    twiml.say("I'm sorry, I didn't get the time.");
    twiml.redirect(`/voice/address?name=${encodeURIComponent(name)}&SpeechResult=${encodeURIComponent(address)}`);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// ============================================================================
//  RETELL AI ENDPOINTS (kept for future AI agent integration)
// ============================================================================

const axios = require('axios');

app.post('/retell/check-availability', async (req, res) => {
  try {
    const { preferredDateTime, appointmentDate, appointmentTime } = req.body;
    const input = preferredDateTime || `${appointmentDate || ''} ${appointmentTime || ''}`.trim();
    console.log(`[Retell AI] Checking availability for: ${input}`);

    if (!input) {
      return res.json({ isAvailable: true, message: "Please let me know what date and time you were thinking of.", suggestedSlots: "We are available all next week." });
    }

    const date = new Date(input);
    const dayOfWeek = isNaN(date.getTime()) ? 1 : date.getUTCDay();
    let isAvailable = true, message = "That time works perfectly.", suggestedSlots = "";

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      isAvailable = false;
      message = "I am sorry, we are actually closed on weekends.";
      suggestedSlots = "We have availability this coming Monday, Tuesday, and Wednesday between 9 AM and 5 PM.";
    }

    res.json({ isAvailable, message, suggestedSlots });
  } catch (err) {
    console.error('Error in retell/check-availability:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/retell/book-appointment', async (req, res) => {
  try {
    const { customerName, customerPhone, appointmentDate, appointmentTime, serviceAddress, serviceType } = req.body;
    const finalDateTime = `${appointmentDate || ''} ${appointmentTime || ''}`.trim();
    const phone = customerPhone || "N/A";

    await addCalendarEvent({ customer_name: customerName, customer_phone: phone, customer_address: serviceAddress, service_time: finalDateTime, service_type: serviceType || 'HVAC/Plumbing Service' });

    const eventId = `retell-${Date.now()}`;
    queryTeamDb(`INSERT OR REPLACE INTO appointments (phone, event_id, customer_name, appointment_date, appointment_time, service_address, service_type, reminder_sent, owner_notified) VALUES ('${esc(phone)}', '${eventId}', '${esc(customerName)}', '${esc(appointmentDate || '')}', '${esc(appointmentTime || '')}', '${esc(serviceAddress || '')}', '${esc(serviceType || 'HVAC/Plumbing Service')}', 0, 0)`);

    await sendSMS(process.env.OWNER_PHONE_NUMBER, `New Zenith Booking: ${customerName} wants ${serviceType || 'service'} on ${finalDateTime}. Address: ${serviceAddress}. Phone: ${phone}`);
    await sendSMS(phone, `Hi ${customerName}, your ${serviceType || 'service'} appointment with Zenith is confirmed for ${finalDateTime}. We'll see you at ${serviceAddress}. Reply OPT OUT to cancel.`);

    res.json({ status: "success", message: "Appointment booked." });
  } catch (err) {
    console.error('Error in retell/book-appointment:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
//  SMS WEBHOOK (Opt-Out / Cancellation)
// ============================================================================

app.post('/twilio/sms', async (req, res) => {
  try {
    const { Body, From } = req.body;
    console.log(`[Twilio SMS] From ${From}: ${Body}`);

    if (Body.trim().toUpperCase() === 'OPT OUT') {
      const results = queryTeamDb(`SELECT * FROM appointments WHERE phone = '${esc(From)}'`);
      const booking = results && results.length > 0 ? results[0] : null;

      if (booking) {
        await deleteCalendarEvent(booking);
        await sendSMS(process.env.OWNER_PHONE_NUMBER, `Zenith: Appointment for ${booking.customer_name} on ${booking.appointment_date || booking.appointment_time} has been CANCELED by the customer.`);
        queryTeamDb(`DELETE FROM appointments WHERE phone = '${esc(From)}'`);
        res.send('<Response><Sms>Your Zenith appointment has been canceled. We hope to serve you another time.</Sms></Response>');
      } else {
        res.send("<Response><Sms>We couldn't find an active appointment for this number.</Sms></Response>");
      }
    } else {
      res.sendStatus(200);
    }
  } catch (err) {
    console.error('Error in twilio-sms:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// ============================================================================
//  REMINDERS & DAILY SUMMARY
// ============================================================================

async function checkReminders() {
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const threeHoursMs = 3 * 60 * 60 * 1000;
  const fifteenMinsMs = 15 * 60 * 1000;

  try {
    const now = new Date();
    const appointments = queryTeamDb(`SELECT * FROM appointments WHERE reminder_sent = 0`);
    if (!appointments || appointments.length === 0) return;

    for (const appt of appointments) {
      try {
        let apptDateStr = `${appt.appointment_date} ${appt.appointment_time}`.trim();
        if (!apptDateStr.includes('GMT') && !apptDateStr.includes('Z')) apptDateStr += ' GMT-0400';
        const apptDate = new Date(apptDateStr);
        if (isNaN(apptDate.getTime())) continue;

        const timeDiff = apptDate.getTime() - now.getTime();
        if (timeDiff > 0 && timeDiff <= (threeHoursMs + fifteenMinsMs) && timeDiff >= twoHoursMs) {
          await sendSMS(appt.phone, `Reminder: Your Zenith ${appt.service_type || 'service'} appointment is in 3 hours at ${appt.appointment_time}. See you soon!`);
          queryTeamDb(`UPDATE appointments SET reminder_sent = 1 WHERE phone = '${esc(appt.phone)}'`);
        }
      } catch (e) { console.error(`Reminder error for ${appt.phone}:`, e.message); }
    }
  } catch (err) { console.error('[Reminders] Error:', err.message); }
}

async function checkOwnerNotifications() {
  try {
    const options = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' };
    const todayStr = new Date().toLocaleDateString('en-CA', options);
    const currentHour = parseInt(new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }));
    if (currentHour !== 7) return;

    const state = queryTeamDb(`SELECT value FROM system_state WHERE key = 'last_daily_summary_date'`);
    if (state && state.length > 0 && state[0].value === todayStr) return;

    const appointments = queryTeamDb(`SELECT * FROM appointments WHERE appointment_date LIKE '${todayStr}%'`);
    if (appointments && appointments.length > 0) {
      let summary = `Zenith Daily Schedule (${todayStr}):\n`;
      appointments.forEach((appt, i) => {
        summary += `${i + 1}. ${appt.customer_name} - ${appt.appointment_time || 'No Time'} - ${appt.service_type} - ${appt.service_address}\n`;
      });
      await sendSMS(process.env.OWNER_PHONE_NUMBER, summary);
    }
    queryTeamDb(`INSERT OR REPLACE INTO system_state (key, value) VALUES ('last_daily_summary_date', '${todayStr}')`);
  } catch (err) { console.error('[Daily Summary] Error:', err.message); }
}

// Run checks every 15 minutes
setInterval(async () => {
  await checkReminders();
  await checkOwnerNotifications();
}, 15 * 60 * 1000);

// ============================================================================
//  HEALTH CHECK
// ============================================================================

app.get('/', (req, res) => {
  res.send('<h1>✅ Zenith HVAC & Plumbing AI Agent is Online</h1>');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zenith Agent listening on port ${PORT}`);
});