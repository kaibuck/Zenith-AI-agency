const db = require('../db/database');
const business = require('../config/business');

const Conversations = {
  /**
   * Gets or creates a conversation session.
   * sessionId = CallSid for voice, From phone for SMS.
   */
  getOrCreate(sessionId, phone, channel) {
    this._purgeExpired();

    const existing = db.prepare('SELECT * FROM conversations WHERE session_id = ?').get(sessionId);
    if (existing) {
      // Refresh expiry on activity
      db.prepare(`UPDATE conversations SET expires_at = datetime('now', '+${business.sessionTimeoutSeconds} seconds') WHERE session_id = ?`)
        .run(sessionId);
      return {
        ...existing,
        messages: JSON.parse(existing.messages),
        leadData: JSON.parse(existing.lead_data),
      };
    }

    const expiresAt = new Date(Date.now() + business.sessionTimeoutSeconds * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

    db.prepare(`
      INSERT INTO conversations (session_id, phone, channel, messages, state, lead_data, expires_at)
      VALUES (?, ?, ?, '[]', 'greeting', '{}', ?)
    `).run(sessionId, phone, channel, expiresAt);

    return { session_id: sessionId, phone, channel, messages: [], state: 'greeting', leadData: {}, lead_id: null };
  },

  save(sessionId, messages, state, leadData, leadId = null) {
    db.prepare(`
      UPDATE conversations
      SET messages = ?, state = ?, lead_data = ?, lead_id = ?
      WHERE session_id = ?
    `).run(
      JSON.stringify(messages),
      state,
      JSON.stringify(leadData),
      leadId,
      sessionId
    );
  },

  get(sessionId) {
    const row = db.prepare('SELECT * FROM conversations WHERE session_id = ?').get(sessionId);
    if (!row) return null;
    return { ...row, messages: JSON.parse(row.messages), leadData: JSON.parse(row.lead_data) };
  },

  delete(sessionId) {
    db.prepare('DELETE FROM conversations WHERE session_id = ?').run(sessionId);
  },

  _purgeExpired() {
    db.prepare("DELETE FROM conversations WHERE expires_at < datetime('now')").run();
  },
};

module.exports = Conversations;
