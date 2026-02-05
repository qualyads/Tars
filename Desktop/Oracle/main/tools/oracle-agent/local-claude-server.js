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
import { spawn } from 'child_process';
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
 * Call Claude CLI and get response
 * Uses 'claude' command which is part of Claude Max subscription
 */
async function callClaudeCLI(prompt) {
  return new Promise((resolve, reject) => {
    // Use claude CLI with --print flag for non-interactive mode
    const claude = spawn('claude', ['--print', '-p', prompt], {
      cwd: process.env.HOME,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `Claude CLI exited with code ${code}`));
      }
    });

    claude.on('error', (err) => {
      reject(new Error(`Failed to start Claude CLI: ${err.message}`));
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      claude.kill();
      reject(new Error('Claude CLI timeout'));
    }, 60000);
  });
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
