const express = require('express');
const router = express.Router();
const db = require('../db/database');
const Leads = require('../services/leads');
const smsSvc = require('../services/sms');
const calendarSvc = require('../services/calendar');
const { requireAuth } = require('../middleware/auth');
const business = require('../config/business');

// ─── Auth ─────────────────────────────────────────────────────────────────────

router.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';

  if (password === adminPassword) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ authenticated: true });
});

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

router.get('/stats', requireAuth, (req, res) => {
  try {
    res.json(Leads.stats());
  } catch (err) {
    console.error('[Admin] Stats error:', err.message);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

router.get('/activity', requireAuth, (req, res) => {
  try {
    const activity = Leads.recentActivity(20);
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load activity' });
  }
});

// ─── Leads ────────────────────────────────────────────────────────────────────

router.get('/leads', requireAuth, (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const leads = Leads.list({ status, limit: Number(limit), offset: Number(offset) });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load leads' });
  }
});

router.get('/leads/:id', requireAuth, (req, res) => {
  try {
    const lead = Leads.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    lead.conversation_log = JSON.parse(lead.conversation_log || '[]');
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load lead' });
  }
});

router.patch('/leads/:id', requireAuth, (req, res) => {
  try {
    const allowed = ['status', 'notes', 'name', 'service', 'preferred_time'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    const lead = Leads.update(req.params.id, updates);
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

router.delete('/leads/:id', requireAuth, async (req, res) => {
  try {
    const lead = Leads.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Cancel calendar event if booked
    if (lead.appointment_id) {
      try {
        await calendarSvc.deleteAppointment(lead.appointment_id);
      } catch (e) {
        console.error('[Admin] Calendar delete error:', e.message);
      }
    }

    db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// ─── Send Manual SMS ──────────────────────────────────────────────────────────

router.post('/leads/:id/sms', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const lead = Leads.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    await smsSvc.sendSMS(lead.phone, message);
    Leads.appendLog(lead.id, 'manual_sms', message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

// ─── Business Settings ────────────────────────────────────────────────────────

router.get('/settings', requireAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM business_settings').all();
    const settings = {};
    for (const r of rows) settings[r.key] = JSON.parse(r.value);

    // Merge with defaults from config
    const merged = {
      name: business.name,
      tagline: business.tagline,
      phone: business.phone,
      ownerPhone: business.ownerPhone,
      ownerEmail: business.ownerEmail,
      timezone: business.timezone,
      hours: business.hours,
      services: business.services,
      urgentKeywords: business.urgentKeywords,
      voice: business.voice,
      ...settings,
    };
    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.put('/settings', requireAuth, (req, res) => {
  try {
    const upsert = db.prepare(`
      INSERT INTO business_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);

    const updateMany = db.transaction((data) => {
      for (const [key, value] of Object.entries(data)) {
        upsert.run(key, JSON.stringify(value));
      }
    });

    updateMany(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ─── Google Calendar Auth ─────────────────────────────────────────────────────

router.get('/calendar/auth-url', requireAuth, (req, res) => {
  try {
    const url = calendarSvc.getAuthUrl();
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Calendar auth not configured' });
  }
});

router.get('/calendar/upcoming', requireAuth, async (req, res) => {
  try {
    const events = await calendarSvc.listUpcoming(20);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// ─── SMS Templates Preview ───────────────────────────────────────────────────

router.get('/sms-templates', requireAuth, (req, res) => {
  res.json({
    confirmation: smsSvc.templates.confirmationText('{name}', '{service}', '{dateTime}'),
    ownerNotification: smsSvc.templates.ownerNotificationText('{name}', '{service}', '{dateTime}', '{phone}'),
    reminder: smsSvc.templates.reminderText('{name}', '{service}', '{dateTime}'),
    fallback: smsSvc.templates.fallbackText(),
  });
});

module.exports = router;
