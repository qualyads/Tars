#!/usr/bin/env node
/**
 * Local Claude Server v1.0
 * รันบน Mac เพื่อให้ LINE ใช้ Claude Max (ฟรี!)
 *
 * วิธีใช้:
 * 1. รัน: node local-claude-server.js
 * 2. Expose ด้วย: npx localtunnel --port 3457 --subdomain oracle-tars
 * 3. ตั้ง LOCAL_TUNNEL_URL บน Railway
 *
 * @version 1.0.0
 */

import express from 'express';
import { execSync } from 'child_process';
import cors from 'cors';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3457;
const LOCK_FILE = '/tmp/oracle-local-claude.lock';

// Lock file to prevent duplicate instances
function checkAndCreateLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      try {
        process.kill(lockData.pid, 0);
        console.log(`Already running (PID: ${lockData.pid}). Exiting.`);
        process.exit(0);
      } catch (e) {
        fs.unlinkSync(LOCK_FILE);
      }
    } catch (e) {
      fs.unlinkSync(LOCK_FILE);
    }
  }

  fs.writeFileSync(LOCK_FILE, JSON.stringify({
    pid: process.pid,
    startedAt: new Date().toISOString()
  }));

  const cleanup = () => {
    try {
      const data = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      if (data.pid === process.pid) fs.unlinkSync(LOCK_FILE);
    } catch (e) {}
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
}

checkAndCreateLock();

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'local-claude-server',
    version: '1.0.0',
    provider: 'claude-max',
    uptime: process.uptime()
  });
});

// Chat endpoint - receives messages and returns Claude Max response
app.post('/chat', async (req, res) => {
  const { message, system, context } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  console.log(`[LOCAL-CLAUDE] Received: ${message.substring(0, 50)}...`);

  try {
    // Build prompt with system + context
    let fullPrompt = '';
    if (system) {
      fullPrompt += `<system>\n${system}\n</system>\n\n`;
    }
    if (context) {
      fullPrompt += `<context>\n${context}\n</context>\n\n`;
    }
    fullPrompt += message;

    // Call Claude CLI using subprocess
    const response = await callClaudeCLI(fullPrompt);

    console.log(`[LOCAL-CLAUDE] Response: ${response.substring(0, 50)}...`);

    res.json({
      text: response,
      provider: 'claude-max-local',
      model: 'claude-max'
    });

  } catch (error) {
    console.error('[LOCAL-CLAUDE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Call Claude CLI (Terminal only - FREE with Claude Max)
 * Uses haiku model for faster responses
 */
async function callClaudeCLI(prompt) {
  console.log('[LOCAL-CLAUDE] Using Claude CLI (haiku)...');

  try {
    // Escape double quotes in prompt
    const escapedPrompt = prompt.replace(/"/g, '\\"');

    // Create clean env without API keys (use Claude Max subscription instead)
    const cleanEnv = { ...process.env };
    delete cleanEnv.ANTHROPIC_API_KEY;  // Remove to use Claude Max
    delete cleanEnv.OPENAI_API_KEY;

    // Use execSync with proper PATH
    const result = execSync(
      `claude --model haiku --print -p "${escapedPrompt}"`,
      {
        cwd: '/Users/tanakitchaithip/Desktop/Oracle/main/tools/oracle-agent',
        encoding: 'utf8',
        timeout: 90000,
        maxBuffer: 10 * 1024 * 1024,
        shell: '/bin/zsh',
        env: {
          ...cleanEnv,
          HOME: '/Users/tanakitchaithip',
          PATH: '/Users/tanakitchaithip/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'
        }
      }
    );

    console.log('[LOCAL-CLAUDE] Got response from CLI');
    return result.trim();
  } catch (error) {
    console.error('[LOCAL-CLAUDE] CLI error:', error.message);
    if (error.stdout) console.error('[LOCAL-CLAUDE] Stdout:', error.stdout.toString());
    throw error;
  }
}

// Alternative: Direct API call if ANTHROPIC_API_KEY is available from Claude Max
app.post('/chat/api', async (req, res) => {
  const { messages, system, model = 'claude-sonnet-4-20250514' } = req.body;

  // Check if we have API key from environment
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(400).json({
      error: 'ANTHROPIC_API_KEY not set. Use /chat endpoint for CLI mode.'
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: system || '',
        messages: messages || [{ role: 'user', content: req.body.message }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    res.json({
      text: data.content[0]?.text || '',
      provider: 'anthropic-api-local',
      model
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LINE Webhook endpoint - receives LINE webhook and responds via Claude Max
app.post('/webhook', async (req, res) => {
  console.log('[LOCAL-CLAUDE] Received webhook');

  const events = req.body.events || [];

  // Respond immediately to LINE
  res.status(200).send('OK');

  // Process events in background
  for (const event of events) {
    if (event.type === 'message' && event.message?.type === 'text') {
      const userMessage = event.message.text;
      const replyToken = event.replyToken;

      console.log(`[LOCAL-CLAUDE] LINE message: ${userMessage.substring(0, 50)}...`);

      try {
        // Get response from Claude CLI
        const response = await callClaudeCLI(userMessage);

        // Reply to LINE
        await replyToLine(replyToken, response);

        console.log(`[LOCAL-CLAUDE] Replied via LINE`);
      } catch (error) {
        console.error('[LOCAL-CLAUDE] Webhook error:', error.message);
        await replyToLine(replyToken, `ขออภัย เกิดข้อผิดพลาด: ${error.message}`);
      }
    }
  }
});

// Reply to LINE
async function replyToLine(replyToken, text) {
  // Support both naming conventions
  const LINE_TOKEN = process.env.LINE_CHANNEL_TOKEN || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!LINE_TOKEN) {
    console.error('[LOCAL-CLAUDE] LINE_CHANNEL_TOKEN not set');
    return;
  }

  // Truncate if too long
  const maxLength = 5000;
  if (text.length > maxLength) {
    text = text.substring(0, maxLength - 3) + '...';
  }

  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_TOKEN}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [{
          type: 'text',
          text: text + '\n\n🟢 claude-max'
        }]
      })
    });
  } catch (error) {
    console.error('[LOCAL-CLAUDE] LINE reply error:', error.message);
  }
}

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                                                              ║');
  console.log('║   🤖 LOCAL CLAUDE SERVER v1.0                                ║');
  console.log('║   Using Claude Max (FREE!)                                   ║');
  console.log('║                                                              ║');
  console.log(`║   Local:  http://localhost:${PORT}                            ║`);
  console.log('║                                                              ║');
  console.log('║   Next steps:                                                ║');
  console.log('║   1. Expose with: npx localtunnel --port 3457                ║');
  console.log('║   2. Set LOCAL_TUNNEL_URL on Railway                         ║');
  console.log('║                                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
});
