require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');

const voiceRoutes = require('./routes/voice');
const smsRoutes   = require('./routes/sms');
const adminRoutes = require('./routes/admin');
const calendarSvc = require('./services/calendar');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ─── Sessions (admin dashboard) ───────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'zenith-ai-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests',
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});

// ─── Static Admin Dashboard ───────────────────────────────────────────────────
app.use('/admin', express.static(path.join(__dirname, 'public')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/webhook/voice', webhookLimiter, voiceRoutes);
app.use('/webhook/sms',   webhookLimiter, smsRoutes);
app.use('/api/admin',     adminLimiter,   adminRoutes);

// ─── Google OAuth2 callback ───────────────────────────────────────────────────
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing code parameter');

    const tokens = await calendarSvc.exchangeCode(code);
    res.send(`
      <h2>Google Calendar Connected!</h2>
      <p>Copy the refresh token below and add it to your <code>.env</code> file as <code>GOOGLE_REFRESH_TOKEN</code>:</p>
      <pre style="background:#f4f4f4;padding:16px;border-radius:6px;word-break:break-all">${tokens.refresh_token || 'No refresh token returned — ensure access_type=offline was set'}</pre>
      <p>Then restart the server.</p>
    `);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Zenith AI Receptionist',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Root → redirect to admin dashboard
app.get('/', (req, res) => res.redirect('/admin'));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🤖 Zenith AI Receptionist running on port ${PORT}`);
  console.log(`   Admin dashboard : http://localhost:${PORT}/admin`);
  console.log(`   Voice webhook   : http://localhost:${PORT}/webhook/voice`);
  console.log(`   SMS webhook     : http://localhost:${PORT}/webhook/sms`);
  console.log(`   Health check    : http://localhost:${PORT}/health\n`);
});

module.exports = app;
