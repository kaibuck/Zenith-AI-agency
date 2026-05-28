const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'receptionist.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    phone       TEXT    NOT NULL,
    name        TEXT,
    service     TEXT,
    preferred_time TEXT,
    status      TEXT    NOT NULL DEFAULT 'new',
    channel     TEXT    NOT NULL DEFAULT 'voice',
    conversation_log TEXT NOT NULL DEFAULT '[]',
    appointment_id   TEXT,
    appointment_start TEXT,
    appointment_end   TEXT,
    notes       TEXT,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT    NOT NULL UNIQUE,
    phone      TEXT    NOT NULL,
    channel    TEXT    NOT NULL DEFAULT 'sms',
    messages   TEXT    NOT NULL DEFAULT '[]',
    state      TEXT    NOT NULL DEFAULT 'greeting',
    lead_data  TEXT    NOT NULL DEFAULT '{}',
    lead_id    INTEGER REFERENCES leads(id),
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS business_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_leads_phone      ON leads(phone);
  CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_conv_session     ON conversations(session_id);
  CREATE INDEX IF NOT EXISTS idx_conv_phone       ON conversations(phone);
`);

// Triggers to auto-update updated_at
db.exec(`
  CREATE TRIGGER IF NOT EXISTS leads_updated_at
    AFTER UPDATE ON leads
    BEGIN UPDATE leads SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

  CREATE TRIGGER IF NOT EXISTS conversations_updated_at
    AFTER UPDATE ON conversations
    BEGIN UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
`);

module.exports = db;
