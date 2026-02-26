/**
 * Google OAuth2 Setup Script
 *
 * Usage:
 *   node google-oauth.js              # default account (info@visionxbrain.com)
 *   node google-oauth.js vxb          # second account (vxb.visionxbrain@gmail.com)
 *   node google-oauth.js <account>    # any account alias
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Account alias from CLI arg
const accountAlias = process.argv[2] || 'default';

// Load .env if exists
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '.env') });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:3000/oauth/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/indexing',
  'https://www.googleapis.com/auth/pubsub'
].join(' ');

// Add login_hint for specific accounts
const ACCOUNT_HINTS = {
  default: 'info@visionxbrain.com',
  vxb: 'vxb.visionxbrain@gmail.com'
};

const loginHint = ACCOUNT_HINTS[accountAlias] || '';
const envSuffix = accountAlias === 'default' ? '' : `_${accountAlias.toUpperCase()}`;
const tokenFile = accountAlias === 'default' ? 'google-token.json' : `google-token-${accountAlias}.json`;

let authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`;

if (loginHint) {
  authUrl += `&login_hint=${encodeURIComponent(loginHint)}`;
}

console.log(`\n🔐 Google OAuth2 Setup [${accountAlias}]${loginHint ? ` (${loginHint})` : ''}\n`);
console.log('เปิด URL นี้ใน browser:\n');
console.log(authUrl);
console.log('\n⏳ รอ callback...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:3000`);

  if (url.pathname === '/oauth/callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>❌ Error: ${error}</h1>`);
      server.close();
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>❌ No code received</h1>');
      return;
    }

    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code'
        })
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>❌ Token Error: ${tokens.error_description || tokens.error}</h1>`);
        server.close();
        return;
      }

      console.log('✅ Tokens received!');
      console.log('  Account:', accountAlias, loginHint ? `(${loginHint})` : '');
      console.log('  Access Token:', tokens.access_token?.substring(0, 20) + '...');
      console.log('  Refresh Token:', tokens.refresh_token ? '✅ Got it!' : '❌ Missing!');
      console.log('  Scopes:', tokens.scope);

      // Save to .env
      const envPath = path.join(__dirname, '.env');
      let envContent = fs.readFileSync(envPath, 'utf8');

      const envKey = `GOOGLE_REFRESH_TOKEN${envSuffix}`;

      if (envContent.includes(envKey)) {
        envContent = envContent.replace(
          new RegExp(`${envKey}=.*`),
          `${envKey}=${tokens.refresh_token || ''}`
        );
      } else {
        envContent += `\n# Google OAuth2 - ${accountAlias} (${loginHint})\n${envKey}=${tokens.refresh_token || ''}\n`;
      }

      fs.writeFileSync(envPath, envContent);
      console.log(`\n💾 Saved ${envKey} to .env!`);

      // Save full token data
      const tokenPath = path.join(__dirname, 'data', tokenFile);
      fs.writeFileSync(tokenPath, JSON.stringify({
        account: loginHint || accountAlias,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: Date.now() + (tokens.expires_in * 1000),
        scope: tokens.scope,
        createdAt: new Date().toISOString()
      }, null, 2));
      console.log(`💾 Saved to data/${tokenFile}`);

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #e0e0e0;">
          <h1>✅ OAuth2 สำเร็จ!</h1>
          <p>Account: ${loginHint || accountAlias}</p>
          <p>Saved to: ${envKey}</p>
          <p style="color: #4ade80;">กลับไปที่ Terminal ได้เลย</p>
        </body>
        </html>
      `);

      setTimeout(() => {
        server.close();
        console.log('\n🎉 Done!');
        process.exit(0);
      }, 2000);

    } catch (err) {
      console.error('❌ Error:', err);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>❌ Error: ${err.message}</h1>`);
      server.close();
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3000, () => {
  console.log('🌐 Server listening on http://localhost:3000');
  import('child_process').then(({ exec }) => {
    exec(`open "${authUrl}"`);
  });
});
