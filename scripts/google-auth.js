// One-time helper: run `npm run google-auth`, sign in, and copy the refresh token into .env.
// GOOGLE_REDIRECT_URI must be http://localhost:<port>/oauth2callback and registered on the OAuth client.
require('dotenv').config();
const http = require('http');
const { google } = require('googleapis');

const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5555/oauth2callback';
const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);

const url = auth.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/calendar']
});

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, redirectUri).searchParams.get('code');
  if (!code) return res.end('Waiting for Google sign-in...');
  try {
    const { tokens } = await auth.getToken(code);
    res.end('Done! You can close this tab and return to the terminal.');
    console.log(`\nAdd this to your .env:\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  } catch (err) {
    res.end('Failed to get token. Check the terminal.');
    console.error(err.message);
  }
  server.close();
});

server.listen(new URL(redirectUri).port || 80, () => {
  console.log(`Open this URL and sign in with the Google account that owns the calendar:\n\n${url}\n`);
});
