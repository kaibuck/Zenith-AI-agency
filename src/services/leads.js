const db = require('../db/database');

const Leads = {
  create(phone, channel = 'voice') {
    const stmt = db.prepare(`
      INSERT INTO leads (phone, channel, status) VALUES (?, ?, 'new')
    `);
    const result = stmt.run(phone, channel);
    return this.findById(result.lastInsertRowid);
  },

  findById(id) {
    return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  },

  findByPhone(phone) {
    return db.prepare('SELECT * FROM leads WHERE phone = ? ORDER BY created_at DESC LIMIT 1').get(phone);
  },

  update(id, fields) {
    const allowed = ['name', 'service', 'preferred_time', 'status', 'conversation_log',
                     'appointment_id', 'appointment_start', 'appointment_end', 'notes'];
    const sets = [];
    const values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) {
        sets.push(`${k} = ?`);
        values.push(typeof v === 'object' ? JSON.stringify(v) : v);
      }
    }
    if (!sets.length) return;
    values.push(id);
    db.prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  appendLog(id, role, content) {
    const lead = this.findById(id);
    if (!lead) return;
    const log = JSON.parse(lead.conversation_log || '[]');
    log.push({ role, content, ts: new Date().toISOString() });
    this.update(id, { conversation_log: log });
  },

  list({ limit = 50, offset = 0, status } = {}) {
    if (status) {
      return db.prepare(`
        SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(status, limit, offset);
    }
    return db.prepare(`
      SELECT * FROM leads ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(limit, offset);
  },

  stats() {
    const total = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
    const booked = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'booked'").get().c;
    const pending = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status IN ('new','contacted')").get().c;
    const todayBooked = db.prepare(`
      SELECT COUNT(*) as c FROM leads
      WHERE status = 'booked' AND date(created_at) = date('now')
    `).get().c;
    const rate = total > 0 ? Math.round((booked / total) * 100) : 0;
    return { total, booked, pending, todayBooked, conversionRate: rate };
  },

  recentActivity(limit = 20) {
    return db.prepare(`
      SELECT id, phone, name, service, status, channel, created_at
      FROM leads ORDER BY created_at DESC LIMIT ?
    `).all(limit);
  },

  deleteExpiredConversations() {
    db.prepare("DELETE FROM conversations WHERE expires_at < datetime('now')").run();
  },
};

module.exports = Leads;
