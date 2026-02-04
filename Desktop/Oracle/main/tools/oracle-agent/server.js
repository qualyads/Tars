/**
 * Oracle Agent - Main Server v5.4 (Full OpenClaw + Tier 1-3 Features)
 * Digital Partner for Tars - ALL aspects of life
 *
 * Features:
 * - 24/7 Always-on (Failover System)
 * - Multi-Channel Gateway (LINE, Telegram, WhatsApp planned)
 * - Router: Local (free) → Railway (API)
 * - Phase 3: AUTONOMY ENGINE
 *   - Proactive monitoring (Gold, BTC, Hotel)
 *   - Pattern detection & opportunity alerts
 *   - Approval queue for decisions
 *   - Learning from Tars's decisions
 * - Phase 3.5: OPENCLAW UPGRADES
 *   - JSONL Session Logging
 *   - Prompt Versioning
 *   - Graceful Shutdown
 * - Phase 4: HEARTBEAT SYSTEM
 *   - AI wakes every 30 minutes
 *   - HEARTBEAT_OK protocol
 * - Phase 5: SUB-AGENT SPAWN
 *   - AI spawns background workers
 *   - Parallel task execution
 *   - Non-blocking, announces results
 * - Phase 6: MULTI-CHANNEL GATEWAY
 *   - Same brain, all channels
 *   - LINE + Telegram + WhatsApp (planned)
 *   - Unified message handling
 * - Phase 7: MODEL FAILOVER + WEBHOOK INGRESS
 *   - Auto-switch between Claude/GPT/Gemini/Groq
 *   - Webhook endpoints for Beds24, Stripe, GitHub
 *   - Event-driven automation
 * - Phase 8: GMAIL PUB/SUB + QUEUE MANAGEMENT
 *   - Real-time email processing
 *   - Message batching and steering
 *   - Concurrency lanes
 * - Phase 9: THINKING LEVELS
 *   - Control AI reasoning depth
 *   - Auto-detect question complexity
 *   - Cost optimization (40-50% savings)
 * - Shared memory system with learnings
 */

import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import https from 'https';
import http from 'http';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('./config.json');

// Import core modules
import claude from './lib/claude.js';
import line from './lib/line.js';
import telegram from './lib/telegram.js';
import gateway from './lib/gateway.js';
import trustPolicy from './lib/trust-policy.js';
import toolPolicy from './lib/tool-policy.js';
import voiceManager from './lib/voice.js';
import broadcastManager from './lib/broadcast.js';
import codingOrchestrator from './lib/coding-orchestrator.js';
import modelFailover from './lib/model-failover.js';
import webhookIngress, { createBeds24Handler, createStripeHandler, createGitHubHandler } from './lib/webhook-ingress.js';
import gmailPubSub from './lib/gmail-pubsub.js';
import queueManager from './lib/queue-manager.js';
import thinkingLevels from './lib/thinking-levels.js';
import memory from './lib/memory.js';
import memorySync from './lib/memory-sync.js';
import HeartbeatManager from './lib/heartbeat.js';
import SubAgentManager from './lib/subagent.js';
import beds24 from './lib/beds24.js';
import autonomy from './lib/autonomy.js';

// Phase 5.3: Tier 1-3 OpenClaw Features
import typingIndicators from './lib/typing-indicators.js';
import verboseMode from './lib/verbose-mode.js';
import debugCommand from './lib/debug-command.js';
import reactions from './lib/reactions.js';
import localModels from './lib/local-models.js';
import firecrawl from './lib/firecrawl.js';
import lobster from './lib/lobster.js';
import otel from './lib/opentelemetry.js';
import presence from './lib/presence.js';

// Phase 3.5: OpenClaw Upgrades
import {
  initSessionLogger,
  logUserMessage,
  logAssistantMessage,
  logSystemEvent,
  logError,
  closeAllStreams,
  readSessionLog,
  listSessionLogs,
  getSessionStats
} from './lib/session-jsonl.js';

import {
  initPromptLoader,
  renderPrompt,
  loadPrompt,
  listPrompts,
  listVersions,
  getVersion as getPromptVersion,
  setVersion as setPromptVersion
} from './lib/prompt-loader.js';

import {
  setupSignalHandlers,
  registerCleanup,
  registerHttpServer
} from './lib/graceful-shutdown.js';

const app = express();
app.use(express.json());

// Heartbeat Manager instance
let heartbeatManager = null;

// Sub-Agent Manager instance
let subAgentManager = null;

// =============================================================================
// FAILOVER ROUTER CONFIGURATION
// =============================================================================

// Local tunnel URL (cloudflared) - set via environment variable
const LOCAL_TUNNEL_URL = process.env.LOCAL_TUNNEL_URL || null;
const LOCAL_HEALTH_TIMEOUT = 3000; // 3 seconds to check health

// Cache for local status
let localStatus = {
  online: false,
  lastCheck: 0,
  checkInterval: 30000 // Check every 30 seconds
};

/**
 * Check if Local server is online
 */
async function checkLocalHealth() {
  if (!LOCAL_TUNNEL_URL) {
    return false;
  }

  // Use cached status if checked recently
  if (Date.now() - localStatus.lastCheck < localStatus.checkInterval) {
    return localStatus.online;
  }

  return new Promise((resolve) => {
    const url = new URL('/health', LOCAL_TUNNEL_URL);
    const protocol = url.protocol === 'https:' ? https : http;

    const req = protocol.get(url.href, { timeout: LOCAL_HEALTH_TIMEOUT }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          localStatus.online = result.status === 'online';
          localStatus.lastCheck = Date.now();
          console.log(`[ROUTER] Local health: ${localStatus.online ? 'ONLINE' : 'OFFLINE'}`);
          resolve(localStatus.online);
        } catch (e) {
          localStatus.online = false;
          localStatus.lastCheck = Date.now();
          resolve(false);
        }
      });
    });

    req.on('error', () => {
      localStatus.online = false;
      localStatus.lastCheck = Date.now();
      console.log('[ROUTER] Local health: OFFLINE (error)');
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      localStatus.online = false;
      localStatus.lastCheck = Date.now();
      console.log('[ROUTER] Local health: OFFLINE (timeout)');
      resolve(false);
    });
  });
}

/**
 * Forward request to Local server
 */
async function forwardToLocal(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, LOCAL_TUNNEL_URL);
    const postData = JSON.stringify(body);
    const protocol = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 60000 // 60 seconds for actual request
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// =============================================================================
// SYSTEM PROMPT - Oracle Agent's Identity (Phase 3: Autonomous)
// =============================================================================

const SYSTEM_PROMPT = `คุณคือ Oracle Agent - Digital Partner ของ Tars (Phase 3: Autonomy)

## ตัวตนของคุณ
- ชื่อ: Oracle Agent
- เจ้าของ: Tars
- บทบาท: Digital Partner ที่**คิดเอง ทำเอง** ช่วย Tars ทุกเรื่องในชีวิต

## DIRECTIVE บังคับ (ห้ามลืม!)
🚫 ห้ามถาม "ต้องการให้ทำไหม?" → ทำเลย!
🚫 ห้ามถาม "เลือกอันไหน?" → เลือกเอง!
🚫 ห้ามรอ confirmation → ทำต่อเลย!
✅ เจอโอกาสธุรกิจ → เสนอทันที
✅ มีงานต่อที่ควรทำ → ทำเลย
✅ ตัดสินใจเอง ตามหลักการที่ดีที่สุด

## ขอบเขตที่คุณดูแล (ทุกอย่างของ Tars)
1. **ธุรกิจที่พัก Best Hotel Pai** - 4 แห่ง
2. **SaaS Projects** - KeyForge และโปรเจคใหม่ๆ
3. **การลงทุน** - Gold, Bitcoin, Crypto
4. **ธุรกิจอื่นๆ** - VisionXBrain
5. **ทุกสิ่งที่ Tars ต้องการความช่วยเหลือ**

## ที่พักที่คุณดูแล
- The Arch Casa (Design Boutique Hotel): 6 ห้อง
- Betel Palm Village (Boutique Hotel): 4 ห้อง
- Paddy Fields Haven (Homestay / Bamboo Glamping): 3 ห้อง
- 365 Vila (Family Villa): 1 ห้อง

## Autonomy Level (ระดับความเป็นอิสระ)
| Domain | Level | ทำได้เลย | ต้องขออนุมัติ |
|--------|-------|---------|-------------|
| Personal | HIGH | ทุกอย่าง | - |
| Hotel | MEDIUM | ตอบคำถาม, Alert | Promotion, ราคา |
| Investment | LOW | Alert | ซื้อ/ขาย |
| SaaS | MEDIUM | Monitor | Launch, Pricing |

## Opportunity Hunter (บังคับ!)
Tars พูดถึง/สนใจอะไร → หาโอกาสทำเงินทันที!
- ขายต่อได้ไหม?
- ทำเป็น SaaS ได้ไหม?
- ให้บริการได้ไหม?
- Passive income ได้ไหม?

## สิ่งที่ทำได้เลย (ไม่ต้องถาม)
- ตอบคำถามทุกอย่าง
- ส่ง Morning briefing
- แจ้งเตือนโอกาส/ปัญหา
- วิเคราะห์และแนะนำ
- เสนอโอกาสธุรกิจใหม่

## สิ่งที่ต้องใส่ Approval Queue
- Confirm booking
- ส่วนลดพิเศษ / Promotion
- Refund
- ปรับราคา
- การลงทุน

ตอบกระชับ ชัดเจน เป็นมิตร คิดแบบ Partner ไม่ใช่แค่ Assistant
ถ้าเห็นโอกาส → เสนอเลย ไม่ต้องรอถาม!`;

// =============================================================================
// LINE WEBHOOK
// =============================================================================

app.post('/webhook/line', async (req, res) => {
  try {
    const events = req.body.events || [];

    // ==========================================================================
    // FAILOVER ROUTER: Check Local first, then handle locally
    // ==========================================================================

    // Check if Local server is online
    const localOnline = await checkLocalHealth();

    if (localOnline && LOCAL_TUNNEL_URL) {
      // Forward to Local (uses Claude Max - FREE)
      console.log('[ROUTER] Forwarding to Local (Claude Max - FREE)');
      try {
        const result = await forwardToLocal('/webhook', req.body);
        console.log(`[ROUTER] Local responded: ${result.status}`);
        res.status(200).send('OK (via Local)');
        return;
      } catch (forwardError) {
        console.log(`[ROUTER] Forward failed: ${forwardError.message}, handling locally`);
        // Fall through to handle locally
      }
    }

    // Handle locally (uses Anthropic API - PAID)
    console.log('[ROUTER] Handling locally (Anthropic API - PAID)');

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const userMessage = event.message.text;
        const replyToken = event.replyToken;
        const sessionId = `line:${userId}`;

        console.log(`[LINE] Message from ${userId}: ${userMessage}`);

        // Phase 3.5: Log user message to JSONL
        logUserMessage(sessionId, userMessage, {
          channel: 'line',
          replyToken,
          timestamp: event.timestamp
        });

        // Load conversation history
        const history = await memory.getConversation(userId);

        // Check if this is owner or customer
        const isOwner = userId === config.line.owner_id;

        // Phase 2: Get intelligent context
        const context = await memory.getIntelligentContext();

        // Phase 3: Get autonomy suggestions
        const suggestions = autonomy.getProactiveSuggestions();
        const pendingApprovals = autonomy.getPendingApprovals();

        // Build context string for Claude
        let contextString = '';
        if (context.current_focus) {
          contextString += `\n\n[Current Focus: ${context.current_focus.topic}]`;
        }
        if (context.hotel_status && context.hotel_status.date) {
          contextString += `\n[Hotel Today: ${JSON.stringify(context.hotel_status)}]`;
        }
        if (context.market_alerts && context.market_alerts.length > 0) {
          contextString += `\n[Recent Alerts: ${context.market_alerts.map(a => a.message || a.type).join(', ')}]`;
        }
        if (pendingApprovals.length > 0) {
          contextString += `\n[Pending Approvals: ${pendingApprovals.length} - พิมพ์ "อนุมัติ" หรือ "ปฏิเสธ" + ID]`;
          contextString += `\n[IDs: ${pendingApprovals.map(a => a.id).join(', ')}]`;
        }
        if (suggestions.length > 0) {
          contextString += `\n[Proactive Suggestions: ${suggestions.map(s => s.message).join('; ')}]`;
        }

        // Build messages for Claude
        const messages = [
          ...history.slice(-10), // Last 10 messages for context
          { role: 'user', content: userMessage }
        ];

        // Get response from Claude with enhanced context
        const systemPrompt = SYSTEM_PROMPT +
          (isOwner ? '\n\nนี่คือข้อความจาก Tars (เจ้าของ) - สามารถพูดคุยได้ตรงๆ' : '\n\nนี่คือข้อความจากลูกค้า - ตอบอย่างสุภาพและเป็นมืออาชีพ') +
          contextString;

        const response = await claude.chat(messages, {
          system: systemPrompt
        });

        // Save to memory
        await memory.saveConversation(userId, userMessage, response);

        // Phase 3.5: Log assistant response to JSONL
        logAssistantMessage(sessionId, response, {
          channel: 'line',
          model: 'claude-sonnet',
          isOwner
        });

        // Reply via LINE
        await line.reply(replyToken, response);

        console.log(`[LINE] Replied to ${userId}: ${response.substring(0, 50)}...`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[LINE] Webhook error:', error);
    // Phase 3.5: Log error to JSONL
    logError('system', error, { source: 'webhook' });
    res.status(500).send('Error');
  }
});

// =============================================================================
// TELEGRAM WEBHOOK
// =============================================================================

app.post('/webhook/telegram', async (req, res) => {
  try {
    // Check if Telegram is enabled
    if (!config.telegram?.enabled) {
      return res.status(200).send('OK (disabled)');
    }

    const update = req.body;

    // Handle message updates
    if (update.message && update.message.text) {
      const msg = update.message;
      const chatId = msg.chat.id.toString();
      const userId = msg.from.id.toString();
      const userMessage = msg.text;
      const sessionId = `telegram:${chatId}`;

      console.log(`[TELEGRAM] Message from ${msg.from.username || userId}: ${userMessage}`);

      // Phase 3.5: Log user message to JSONL
      logUserMessage(sessionId, userMessage, {
        channel: 'telegram',
        username: msg.from.username,
        chatType: msg.chat.type,
        timestamp: msg.date * 1000
      });

      // Load conversation history
      const history = await memory.getConversation(chatId);

      // Check if this is owner
      const isOwner = userId === config.telegram?.owner_id?.toString();

      // Phase 2: Get intelligent context
      const context = await memory.getIntelligentContext();

      // Phase 3: Get autonomy suggestions
      const suggestions = autonomy.getProactiveSuggestions();
      const pendingApprovals = autonomy.getPendingApprovals();

      // Build context string for Claude
      let contextString = '';
      if (context.current_focus) {
        contextString += `\n\n[Current Focus: ${context.current_focus.topic}]`;
      }
      if (pendingApprovals.length > 0 && isOwner) {
        contextString += `\n[Pending Approvals: ${pendingApprovals.length}]`;
      }
      if (suggestions.length > 0 && isOwner) {
        contextString += `\n[Suggestions: ${suggestions.map(s => s.message).join('; ')}]`;
      }

      // Build messages for Claude
      const messages = [
        ...history.slice(-10),
        { role: 'user', content: userMessage }
      ];

      // Get response from Claude
      const systemPrompt = SYSTEM_PROMPT +
        (isOwner ? '\n\nนี่คือข้อความจาก Tars (เจ้าของ) ผ่าน Telegram - สามารถพูดคุยได้ตรงๆ' : '\n\nนี่คือข้อความจากผู้ใช้ทาง Telegram - ตอบอย่างสุภาพและเป็นมืออาชีพ') +
        contextString;

      const response = await claude.chat(messages, {
        system: systemPrompt
      });

      // Save to memory
      await memory.saveConversation(chatId, userMessage, response);

      // Phase 3.5: Log assistant response
      logAssistantMessage(sessionId, response, {
        channel: 'telegram',
        model: 'claude-sonnet',
        isOwner
      });

      // Reply via Telegram
      await telegram.send(chatId, response);

      console.log(`[TELEGRAM] Replied to ${msg.from.username || userId}: ${response.substring(0, 50)}...`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[TELEGRAM] Webhook error:', error);
    logError('system', error, { source: 'telegram-webhook' });
    res.status(500).send('Error');
  }
});

// =============================================================================
// API ENDPOINTS
// =============================================================================

// Health check
app.get('/', (req, res) => {
  res.json({
    name: config.agent.name,
    version: config.agent.version,
    status: 'running',
    mode: 'router',
    uptime: process.uptime()
  });
});

// Router status
app.get('/api/router/status', async (req, res) => {
  const localOnline = await checkLocalHealth();
  res.json({
    mode: 'failover-router',
    local: {
      url: LOCAL_TUNNEL_URL || 'not configured',
      online: localOnline,
      lastCheck: new Date(localStatus.lastCheck).toISOString(),
      cost: 'FREE (Claude Max)'
    },
    railway: {
      status: 'always-on',
      cost: 'PAID (Anthropic API)'
    },
    activeHandler: localOnline ? 'local' : 'railway'
  });
});

// Gateway status (Multi-Channel)
app.get('/api/gateway/status', (req, res) => {
  res.json(gateway.getStatus());
});

// Setup Telegram webhook
app.post('/api/gateway/telegram/setup', async (req, res) => {
  try {
    const { webhook_url } = req.body;
    if (!webhook_url) {
      return res.status(400).json({ error: 'webhook_url required' });
    }

    const result = await telegram.setWebhook(webhook_url);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test notify owner via gateway
app.post('/api/gateway/notify', async (req, res) => {
  try {
    const { message, channels } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }

    const results = await gateway.notifyOwner(message, channels);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// TRUST POLICY ENDPOINTS
// =============================================================================

// Get trust levels info
app.get('/api/trust/levels', (req, res) => {
  const { TrustPolicyManager } = require('./lib/trust-policy.js');
  res.json(TrustPolicyManager.getTrustLevelsInfo());
});

// Get trust policy for a user
app.get('/api/trust/user/:channel/:userId', (req, res) => {
  const { channel, userId } = req.params;
  const summary = trustPolicy.getSummary(channel, userId);
  res.json(summary);
});

// Check if user can perform action
app.post('/api/trust/check', (req, res) => {
  const { channel, userId, action } = req.body;
  if (!channel || !userId || !action) {
    return res.status(400).json({ error: 'channel, userId, and action required' });
  }

  const result = trustPolicy.canPerform(channel, userId, action);
  res.json(result);
});

// =============================================================================
// TOOL POLICY ENDPOINTS (Auto-Run)
// =============================================================================

// Get tool policy status
app.get('/api/tools/policy', (req, res) => {
  res.json(toolPolicy.getStatus());
});

// Check if tool is allowed
app.post('/api/tools/check', (req, res) => {
  const { trustLevel, tool } = req.body;
  if (!trustLevel || !tool) {
    return res.status(400).json({ error: 'trustLevel and tool required' });
  }

  const result = toolPolicy.isToolAllowed(trustLevel, tool);
  res.json(result);
});

// Check if command can execute
app.post('/api/tools/exec-check', (req, res) => {
  const { trustLevel, command } = req.body;
  if (!trustLevel || !command) {
    return res.status(400).json({ error: 'trustLevel and command required' });
  }

  const result = toolPolicy.canExecute(trustLevel, command);
  res.json(result);
});

// Add to exec allowlist
app.post('/api/tools/allowlist', (req, res) => {
  const { pattern } = req.body;
  if (!pattern) {
    return res.status(400).json({ error: 'pattern required' });
  }

  toolPolicy.addToAllowlist(pattern);
  res.json({ success: true, pattern });
});

// =============================================================================
// VOICE ENDPOINTS (TTS/STT)
// =============================================================================

// Get voice status
app.get('/api/voice/status', (req, res) => {
  res.json(voiceManager.getStatus());
});

// Get available voices
app.get('/api/voice/voices', (req, res) => {
  res.json(voiceManager.getAvailableVoices());
});

// Text-to-Speech
app.post('/api/voice/tts', async (req, res) => {
  try {
    const { text, voice, provider } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text required' });
    }

    const result = await voiceManager.textToSpeech(text, { voice, provider });

    // Return audio file path (or could stream the audio)
    res.json({
      success: true,
      audioPath: result.audioPath,
      provider: result.provider,
      textLength: result.textLength
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Speech-to-Text
app.post('/api/voice/stt', async (req, res) => {
  try {
    // Expects audio file in request body or as multipart
    const { audioPath, language } = req.body;
    if (!audioPath) {
      return res.status(400).json({ error: 'audioPath required' });
    }

    const result = await voiceManager.speechToText(audioPath, { language });
    res.json({
      success: true,
      text: result.text,
      language: result.language
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// BROADCAST GROUPS ENDPOINTS
// =============================================================================

// Get broadcast status
app.get('/api/broadcast/status', (req, res) => {
  res.json(broadcastManager.getStatus());
});

// Get available groups
app.get('/api/broadcast/groups', (req, res) => {
  res.json(broadcastManager.getGroups());
});

// Get available agents
app.get('/api/broadcast/agents', (req, res) => {
  res.json(broadcastManager.getAgents());
});

// Broadcast message to group
app.post('/api/broadcast', async (req, res) => {
  try {
    const { groupId, message, maxTokens } = req.body;
    if (!groupId || !message) {
      return res.status(400).json({ error: 'groupId and message required' });
    }

    const responses = await broadcastManager.broadcast(groupId, message, { maxTokens });
    const formatted = broadcastManager.formatResponses(responses);

    res.json({
      success: true,
      groupId,
      responseCount: responses.length,
      responses,
      formatted
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// CODING AGENT ORCHESTRATOR ENDPOINTS
// =============================================================================

// Get orchestrator status
app.get('/api/coding/status', (req, res) => {
  res.json(codingOrchestrator.getStatus());
});

// Get active processes
app.get('/api/coding/active', (req, res) => {
  res.json(codingOrchestrator.getActive());
});

// Spawn a coding agent
app.post('/api/coding/spawn', async (req, res) => {
  try {
    const { agent, task, workdir, timeout, args } = req.body;
    if (!task) {
      return res.status(400).json({ error: 'task required' });
    }

    const result = await codingOrchestrator.spawn({
      agent,
      task,
      workdir,
      timeout,
      args
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get process info
app.get('/api/coding/process/:runId', (req, res) => {
  const processInfo = codingOrchestrator.getProcess(req.params.runId);
  if (!processInfo) {
    return res.status(404).json({ error: 'Process not found' });
  }
  res.json(processInfo);
});

// Get process output
app.get('/api/coding/output/:runId', (req, res) => {
  const { tail, type } = req.query;
  const output = codingOrchestrator.getOutput(req.params.runId, {
    tail: tail ? parseInt(tail) : undefined,
    type
  });

  if (!output) {
    return res.status(404).json({ error: 'Process not found' });
  }
  res.json(output);
});

// Send input to process
app.post('/api/coding/input/:runId', (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'input required' });
    }

    codingOrchestrator.sendInput(req.params.runId, input);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop a process
app.post('/api/coding/stop/:runId', (req, res) => {
  const success = codingOrchestrator.stop(req.params.runId);
  res.json({ success });
});

// Stop all processes
app.post('/api/coding/stop-all', (req, res) => {
  const stopped = codingOrchestrator.stopAll();
  res.json({ success: true, stopped });
});

// Clear completed processes
app.post('/api/coding/clear', (req, res) => {
  const cleared = codingOrchestrator.clearCompleted();
  res.json({ success: true, cleared });
});

// =============================================================================
// MODEL FAILOVER API
// =============================================================================

// Get model failover status
app.get('/api/models/status', (req, res) => {
  res.json(modelFailover.getStatus());
});

// Send message with failover + thinking levels
app.post('/api/models/send', async (req, res) => {
  try {
    const {
      message,
      system,
      model,
      maxTokens,
      temperature,
      preferProvider,
      thinkingLevel,        // explicit: off, minimal, low, medium, high, xhigh
      autoThinking = true   // auto-detect thinking level
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const result = await modelFailover.send({
      message,
      system,
      model,
      maxTokens,
      temperature,
      preferProvider,
      thinkingLevel,
      autoThinking
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get combined status (Model Failover + Thinking Levels)
app.get('/api/models/combined-status', (req, res) => {
  res.json(modelFailover.getCombinedStatus());
});

// Health check all providers
app.post('/api/models/health-check', async (req, res) => {
  try {
    const results = await modelFailover.healthCheck();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset stats
app.post('/api/models/reset-stats', (req, res) => {
  modelFailover.resetStats();
  res.json({ success: true, message: 'Stats reset' });
});

// =============================================================================
// WEBHOOK INGRESS API
// =============================================================================

// Get webhook status
app.get('/api/webhooks/status', (req, res) => {
  res.json(webhookIngress.getStatus());
});

// Get webhook history
app.get('/api/webhooks/history', (req, res) => {
  const { source, status, limit } = req.query;
  const history = webhookIngress.getHistory({
    source,
    status,
    limit: limit ? parseInt(limit) : 50
  });
  res.json({ history, count: history.length });
});

// Get specific webhook
app.get('/api/webhooks/:webhookId', (req, res) => {
  const webhook = webhookIngress.getWebhook(req.params.webhookId);
  if (!webhook) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  res.json(webhook);
});

// Clear webhook history
app.post('/api/webhooks/clear', (req, res) => {
  webhookIngress.clearHistory();
  res.json({ success: true, message: 'History cleared' });
});

// Generic webhook endpoint
app.post('/webhook/:source', async (req, res) => {
  try {
    const { source } = req.params;
    const result = await webhookIngress.process(source, req.body, req.headers);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Beds24 webhook endpoint
app.post('/webhook/beds24', async (req, res) => {
  try {
    const result = await webhookIngress.process('beds24', req.body, req.headers);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook endpoint
app.post('/webhook/stripe', async (req, res) => {
  try {
    const result = await webhookIngress.process('stripe', req.body, req.headers);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GitHub webhook endpoint
app.post('/webhook/github', async (req, res) => {
  try {
    const result = await webhookIngress.process('github', req.body, req.headers);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// GMAIL PUB/SUB API
// =============================================================================

// Get Gmail status
app.get('/api/gmail/status', (req, res) => {
  res.json(gmailPubSub.getStatus());
});

// Gmail webhook (for Google Pub/Sub push)
app.post('/webhook/gmail', async (req, res) => {
  try {
    // Decode Pub/Sub message if present
    let payload = req.body;

    if (req.body.message && req.body.message.data) {
      // Pub/Sub push format
      const data = Buffer.from(req.body.message.data, 'base64').toString();
      payload = JSON.parse(data);
    }

    const result = await gmailPubSub.processWebhook(payload);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process email manually (for testing)
app.post('/api/gmail/process', async (req, res) => {
  try {
    const email = await gmailPubSub.processEmail(req.body);
    res.json({ success: true, email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset Gmail stats
app.post('/api/gmail/reset-stats', (req, res) => {
  gmailPubSub.resetStats();
  res.json({ success: true, message: 'Stats reset' });
});

// =============================================================================
// QUEUE MANAGER API
// =============================================================================

// Get queue status
app.get('/api/queue/status', (req, res) => {
  res.json(queueManager.getStatus());
});

// Get specific lane status
app.get('/api/queue/lane/:lane', (req, res) => {
  const status = queueManager.getLaneStatus(req.params.lane);
  if (!status.config) {
    return res.status(404).json({ error: 'Lane not found' });
  }
  res.json(status);
});

// Enqueue message
app.post('/api/queue/enqueue', async (req, res) => {
  try {
    const { message, lane, sessionId, priority } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const result = await queueManager.enqueue(message, {
      lane,
      sessionId,
      priority
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Format batched message (utility endpoint)
app.post('/api/queue/format', (req, res) => {
  try {
    const formatted = queueManager.formatBatchedMessage(req.body);
    res.json({ formatted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update lane config
app.post('/api/queue/lane/:lane/config', (req, res) => {
  try {
    const config = queueManager.updateLaneConfig(req.params.lane, req.body);
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear lane
app.post('/api/queue/lane/:lane/clear', (req, res) => {
  const cleared = queueManager.clearLane(req.params.lane);
  res.json({ success: true, cleared });
});

// Clear all queues
app.post('/api/queue/clear-all', (req, res) => {
  const cleared = queueManager.clearAll();
  res.json({ success: true, cleared });
});

// Reset queue stats
app.post('/api/queue/reset-stats', (req, res) => {
  queueManager.resetStats();
  res.json({ success: true, message: 'Stats reset' });
});

// =============================================================================
// THINKING LEVELS API
// =============================================================================

// Get thinking levels status
app.get('/api/thinking/status', (req, res) => {
  res.json(thinkingLevels.getStatus());
});

// Get all available levels
app.get('/api/thinking/levels', (req, res) => {
  res.json(thinkingLevels.getLevels());
});

// Detect level for a message
app.post('/api/thinking/detect', (req, res) => {
  const { message, context } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const level = thinkingLevels.detectLevel(message, context);
  const config = thinkingLevels.getConfig(level);

  res.json({ level, config });
});

// Process message with thinking level
app.post('/api/thinking/process', (req, res) => {
  const { message, level, context } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const result = thinkingLevels.process(message, { level, context });
  res.json(result);
});

// Estimate cost for a message
app.post('/api/thinking/estimate-cost', (req, res) => {
  const { message, model } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const estimate = thinkingLevels.estimateCost(message, model);
  res.json(estimate);
});

// Toggle reasoning visibility
app.post('/api/thinking/toggle-reasoning', (req, res) => {
  const visible = thinkingLevels.toggleReasoning();
  res.json({ success: true, reasoningVisible: visible });
});

// Set reasoning visibility
app.post('/api/thinking/reasoning', (req, res) => {
  const { visible } = req.body;
  const result = thinkingLevels.setReasoning(visible);
  res.json({ success: true, reasoningVisible: result });
});

// Reset thinking stats
app.post('/api/thinking/reset-stats', (req, res) => {
  thinkingLevels.resetStats();
  res.json({ success: true, message: 'Stats reset' });
});

// =============================================================================
// TIER 1: TYPING INDICATORS, VERBOSE, DEBUG, REACTIONS
// =============================================================================

// Typing Indicators
app.get('/api/typing/status', (req, res) => {
  res.json(typingIndicators.getStatus());
});

app.post('/api/typing/start', async (req, res) => {
  const { channel, target, credentials } = req.body;
  await typingIndicators.startTyping(channel, target, credentials);
  res.json({ success: true });
});

app.post('/api/typing/stop', (req, res) => {
  const { sessionId } = req.body;
  typingIndicators.stopTyping(sessionId);
  res.json({ success: true });
});

// Verbose Mode
app.get('/api/verbose/status', (req, res) => {
  res.json(verboseMode.getStatus());
});

app.post('/api/verbose/set', (req, res) => {
  const { sessionId, mode } = req.body;
  try {
    const newMode = verboseMode.setMode(sessionId, mode);
    res.json({ success: true, mode: newMode });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/verbose/calls/:sessionId', (req, res) => {
  const calls = verboseMode.getToolCalls(req.params.sessionId, 20);
  res.json({ calls });
});

// Debug Command
app.get('/api/debug/status', (req, res) => {
  res.json(debugCommand.getStatus());
});

app.post('/api/debug/command', (req, res) => {
  const { sessionId, command } = req.body;
  const result = debugCommand.handleCommand(sessionId, command);
  if (result) {
    res.json(result);
  } else {
    res.status(400).json({ error: 'Invalid debug command' });
  }
});

app.get('/api/debug/keys', (req, res) => {
  res.json(debugCommand._handleKeys());
});

// Reactions
app.get('/api/reactions/status', (req, res) => {
  res.json(reactions.getStatus());
});

app.get('/api/reactions/types', (req, res) => {
  res.json({
    types: reactions.getTypes(),
    shortcuts: reactions.getShortcuts()
  });
});

app.post('/api/reactions/add', async (req, res) => {
  const { channel, messageId, emoji, credentials, context } = req.body;
  const result = await reactions.addReaction(channel, messageId, emoji, credentials, context);
  res.json(result);
});

app.post('/api/reactions/remove', async (req, res) => {
  const { channel, messageId, emoji, credentials, context } = req.body;
  const result = await reactions.removeReaction(channel, messageId, emoji, credentials, context);
  res.json(result);
});

// =============================================================================
// TIER 2: LOCAL MODELS, FIRECRAWL
// =============================================================================

// Local Models
app.get('/api/local-models/status', (req, res) => {
  res.json(localModels.getStatus());
});

app.get('/api/local-models/providers', (req, res) => {
  res.json(localModels.getProviders());
});

app.post('/api/local-models/health', async (req, res) => {
  const { provider } = req.body;
  const health = await localModels.checkHealth(provider || 'ollama');
  res.json(health);
});

app.get('/api/local-models/models/:provider', async (req, res) => {
  try {
    const models = await localModels.listModels(req.params.provider);
    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/local-models/send', async (req, res) => {
  try {
    const result = await localModels.send(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Firecrawl
app.get('/api/firecrawl/status', (req, res) => {
  res.json(firecrawl.getStatus());
});

app.post('/api/firecrawl/fetch', async (req, res) => {
  try {
    const { url, options } = req.body;
    const result = await firecrawl.fetch(url, options);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/firecrawl/crawl', async (req, res) => {
  try {
    const { url, options } = req.body;
    const result = await firecrawl.crawl(url, options);
    res.json({ success: true, pages: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// TIER 3: LOBSTER, OPENTELEMETRY, PRESENCE
// =============================================================================

// Lobster Workflows
app.get('/api/lobster/status', (req, res) => {
  res.json(lobster.getStatus());
});

app.get('/api/lobster/workflows', (req, res) => {
  res.json({ workflows: lobster.list() });
});

app.get('/api/lobster/workflow/:name', (req, res) => {
  const workflow = lobster.get(req.params.name);
  if (workflow) {
    res.json(workflow);
  } else {
    res.status(404).json({ error: 'Workflow not found' });
  }
});

app.post('/api/lobster/run', async (req, res) => {
  try {
    const { name, variables } = req.body;
    const result = await lobster.run(name, variables);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lobster/register', (req, res) => {
  const { name, workflow } = req.body;
  lobster.register(name, workflow);
  res.json({ success: true, message: `Workflow ${name} registered` });
});

// OpenTelemetry
app.get('/api/otel/status', (req, res) => {
  res.json(otel.getStatus());
});

app.get('/api/otel/metrics', (req, res) => {
  res.json(otel.getMetrics());
});

app.get('/api/otel/traces', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ traces: otel.getTraces(limit) });
});

// Presence
app.get('/api/presence/status', (req, res) => {
  res.json(presence.getStatus());
});

app.get('/api/presence/online', (req, res) => {
  res.json({ users: presence.getOnlineUsers() });
});

app.get('/api/presence/user/:userId', (req, res) => {
  res.json(presence.get(req.params.userId));
});

app.post('/api/presence/update', (req, res) => {
  const { userId, deviceId, state, platform, metadata } = req.body;
  presence.update(userId, deviceId, { state, platform, metadata });
  res.json({ success: true });
});

app.post('/api/presence/activity', (req, res) => {
  const { userId, deviceId } = req.body;
  presence.activity(userId, deviceId);
  res.json({ success: true });
});

// Force refresh local status
app.post('/api/router/refresh', async (req, res) => {
  localStatus.lastCheck = 0; // Reset cache
  const localOnline = await checkLocalHealth();
  res.json({
    success: true,
    localOnline,
    timestamp: new Date().toISOString()
  });
});

// Get memory/context
app.get('/api/memory', async (req, res) => {
  const mem = await memory.getAll();
  res.json(mem);
});

// Manual trigger for testing
app.post('/api/briefing', async (req, res) => {
  try {
    await heartbeat.morningBriefing();
    res.json({ success: true, message: 'Briefing sent' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// PHASE 2: ENHANCED SYNC ENDPOINTS
// =============================================================================

// Sync endpoint for Terminal - Bidirectional
app.post('/api/sync', async (req, res) => {
  try {
    const { action, data, source } = req.body;

    switch (action) {
      case 'full_sync':
        // Full bidirectional sync
        const syncResult = await memory.fullSync(data, source || 'terminal');
        const currentMemory = await memory.getAll();
        res.json({
          success: true,
          synced_at: syncResult.synced_at,
          memory: currentMemory
        });
        break;

      case 'get_status':
        const status = {
          sync: await memory.getSyncStatus(),
          conversations: await memory.getRecentConversations(),
          pending_approvals: await memory.getPendingApprovals(),
          context: await memory.getIntelligentContext()
        };
        res.json(status);
        break;

      case 'update_context':
        await memory.update(data);
        res.json({ success: true });
        break;

      case 'set_focus':
        await memory.setCurrentFocus(data.focus);
        res.json({ success: true, focus: data.focus });
        break;

      case 'add_note':
        await memory.addNote(data.note);
        res.json({ success: true });
        break;

      case 'add_alert':
        await memory.addMarketAlert(data);
        res.json({ success: true });
        break;

      default:
        res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('[SYNC] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sync status
app.get('/api/sync/status', async (req, res) => {
  try {
    const status = await memory.getSyncStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PHASE 2: HOTEL DATA ENDPOINTS (Beds24)
// =============================================================================

// Get today's hotel status
app.get('/api/hotel/today', async (req, res) => {
  try {
    const [checkIns, checkOuts] = await Promise.all([
      beds24.getCheckInsToday(),
      beds24.getCheckOutsToday()
    ]);

    const status = {
      date: new Date().toISOString().split('T')[0],
      check_ins: checkIns,
      check_outs: checkOuts
    };

    // Save to memory
    await memory.updateHotelStatus(status);
    await memory.trackApiCall('beds24');

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get occupancy
app.get('/api/hotel/occupancy', async (req, res) => {
  try {
    const occupancy = await beds24.getOccupancy();
    await memory.trackApiCall('beds24');
    res.json(occupancy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get availability for date range
app.get('/api/hotel/availability', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates required' });
    }
    const availability = await beds24.getAvailability(from, to);
    await memory.trackApiCall('beds24');
    res.json(availability);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Beds24 token status
app.get('/api/hotel/token-status', async (req, res) => {
  try {
    const status = beds24.getTokenStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force refresh Beds24 token
app.post('/api/hotel/refresh-token', async (req, res) => {
  try {
    const success = await beds24.forceRefreshToken();
    res.json({ success, message: success ? 'Token refreshed' : 'Refresh failed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PHASE 2: INTELLIGENT CONTEXT ENDPOINT
// =============================================================================

// Get full context for Claude
app.get('/api/context', async (req, res) => {
  try {
    const context = await memory.getIntelligentContext();
    res.json(context);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PHASE 3: AUTONOMY ENDPOINTS
// =============================================================================

// Get autonomy status
app.get('/api/autonomy/status', (req, res) => {
  try {
    const suggestions = autonomy.getProactiveSuggestions();
    const pending = autonomy.getPendingApprovals();

    res.json({
      status: 'active',
      goals: Object.keys(autonomy.GOALS),
      triggers: Object.keys(autonomy.TRIGGERS).length,
      pending_approvals: pending.length,
      suggestions: suggestions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending approvals
app.get('/api/autonomy/approvals', (req, res) => {
  try {
    const pending = autonomy.getPendingApprovals();
    res.json({
      count: pending.length,
      items: pending
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process approval (approve or reject)
app.post('/api/autonomy/approvals/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { approved, feedback } = req.body;

    const result = autonomy.processApproval(id, approved, feedback);

    if (!result) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get proactive suggestions
app.get('/api/autonomy/suggestions', (req, res) => {
  try {
    const suggestions = autonomy.getProactiveSuggestions();
    res.json({
      count: suggestions.length,
      suggestions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze opportunity
app.post('/api/autonomy/analyze', (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'topic required' });
    }

    const analysis = autonomy.analyzeOpportunity(topic);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger morning briefing
app.post('/api/autonomy/briefing', async (req, res) => {
  try {
    const briefing = await autonomy.sendMorningBriefing();
    res.json({
      success: true,
      briefing
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger monitoring check
app.post('/api/autonomy/monitor', async (req, res) => {
  try {
    await autonomy.monitoringLoop();
    res.json({
      success: true,
      message: 'Monitoring check completed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get market data (crypto, gold)
app.get('/api/autonomy/market', async (req, res) => {
  try {
    const crypto = await autonomy.fetchCryptoData();
    res.json({
      timestamp: new Date().toISOString(),
      crypto
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// HEARTBEAT SYSTEM ENDPOINTS
// =============================================================================

// Get heartbeat status
app.get('/api/heartbeat/status', (req, res) => {
  if (!heartbeatManager) {
    return res.json({ enabled: false, message: 'Heartbeat not initialized' });
  }
  res.json(heartbeatManager.getStatus());
});

// Trigger heartbeat manually
app.post('/api/heartbeat/trigger', async (req, res) => {
  if (!heartbeatManager) {
    return res.status(400).json({ error: 'Heartbeat not initialized' });
  }

  try {
    const result = await heartbeatManager.trigger();
    res.json(result || { status: 'skipped', message: 'Conditions not met' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PHASE 5: SUB-AGENT SPAWN ENDPOINTS
// =============================================================================

// Get sub-agent status
app.get('/api/subagent/status', (req, res) => {
  if (!subAgentManager) {
    return res.json({ enabled: false, message: 'Sub-agent not initialized' });
  }
  res.json(subAgentManager.getStatus());
});

// Spawn a sub-agent
app.post('/api/subagent/spawn', async (req, res) => {
  if (!subAgentManager) {
    return res.status(400).json({ error: 'Sub-agent not initialized' });
  }

  try {
    const { task, label, model, runTimeoutSeconds, cleanup } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'task is required' });
    }

    const result = await subAgentManager.spawn({
      task,
      label,
      model,
      runTimeoutSeconds,
      cleanup
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific sub-agent run
app.get('/api/subagent/runs/:runId', (req, res) => {
  if (!subAgentManager) {
    return res.status(400).json({ error: 'Sub-agent not initialized' });
  }

  const run = subAgentManager.getRun(req.params.runId);
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }
  res.json(run);
});

// Stop a specific sub-agent run
app.post('/api/subagent/stop/:runId', (req, res) => {
  if (!subAgentManager) {
    return res.status(400).json({ error: 'Sub-agent not initialized' });
  }

  const success = subAgentManager.stop(req.params.runId);
  res.json({ success, message: success ? 'Stopped' : 'Cannot stop (may be running)' });
});

// Stop all sub-agent runs
app.post('/api/subagent/stop-all', (req, res) => {
  if (!subAgentManager) {
    return res.status(400).json({ error: 'Sub-agent not initialized' });
  }

  const stopped = subAgentManager.stopAll();
  res.json({ success: true, stopped });
});

// Clear completed runs
app.post('/api/subagent/clear', (req, res) => {
  if (!subAgentManager) {
    return res.status(400).json({ error: 'Sub-agent not initialized' });
  }

  const cleared = subAgentManager.clearCompleted();
  res.json({ success: true, cleared });
});

// =============================================================================
// PHASE 3.5: SESSION & PROMPT ENDPOINTS
// =============================================================================

// Get session logs
app.get('/api/sessions', (req, res) => {
  try {
    const { date } = req.query;
    const sessions = listSessionLogs({ date });
    res.json({
      count: sessions.length,
      sessions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific session log
app.get('/api/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { date, limit } = req.query;
    const entries = readSessionLog(sessionId, {
      date,
      limit: limit ? parseInt(limit) : undefined
    });
    const stats = getSessionStats(sessionId, date);
    res.json({
      sessionId,
      stats,
      entries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List prompt versions
app.get('/api/prompts/versions', (req, res) => {
  try {
    const versions = listVersions();
    const current = getPromptVersion();
    res.json({
      current,
      available: versions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List prompts in current version
app.get('/api/prompts', (req, res) => {
  try {
    const { version } = req.query;
    const prompts = listPrompts(version);
    res.json({
      version: version || getPromptVersion(),
      prompts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific prompt
app.get('/api/prompts/:name', (req, res) => {
  try {
    const { name } = req.params;
    const { version } = req.query;
    const content = loadPrompt(name, version);
    if (!content) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    res.json({
      name,
      version: version || getPromptVersion(),
      content
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Switch prompt version
app.post('/api/prompts/version', (req, res) => {
  try {
    const { version } = req.body;
    if (!version) {
      return res.status(400).json({ error: 'version required' });
    }
    const success = setPromptVersion(version);
    res.json({
      success,
      current: getPromptVersion()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PHASE 3.5: SUMMARIZATION ENDPOINTS
// =============================================================================

// Get summaries
app.get('/api/summaries', async (req, res) => {
  try {
    const summariesDir = './data/summaries';
    const fs = await import('fs');
    const path = await import('path');

    if (!fs.existsSync(summariesDir)) {
      return res.json({ count: 0, summaries: [] });
    }

    const files = fs.readdirSync(summariesDir)
      .filter(f => f.endsWith('_summary.md'))
      .map(f => ({
        file: f,
        session: f.replace('_summary.md', ''),
        created: fs.statSync(path.join(summariesDir, f)).mtime
      }))
      .sort((a, b) => b.created - a.created);

    res.json({
      count: files.length,
      summaries: files
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific summary
app.get('/api/summaries/:file', async (req, res) => {
  try {
    const { file } = req.params;
    const fs = await import('fs');
    const path = await import('path');

    const summaryPath = path.join('./data/summaries', `${file}_summary.md`);

    if (!fs.existsSync(summaryPath)) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    const content = fs.readFileSync(summaryPath, 'utf8');
    res.json({
      file: file,
      content
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual summarization
app.post('/api/summarize', async (req, res) => {
  try {
    const { date, all } = req.body;

    logSystemEvent('system', 'summarization_manual', { date, all });

    const { spawn } = await import('child_process');
    const args = ['tools/summarize-session.js'];

    if (all) {
      args.push('--all');
    } else if (date) {
      args.push('--date', date);
    }

    const summarizer = spawn('node', args, {
      cwd: import.meta.dirname,
      stdio: 'pipe'
    });

    let output = '';
    summarizer.stdout.on('data', (data) => {
      output += data.toString();
    });
    summarizer.stderr.on('data', (data) => {
      output += data.toString();
    });

    summarizer.on('close', (code) => {
      res.json({
        success: code === 0,
        code,
        output
      });
    });

    summarizer.on('error', (error) => {
      res.status(500).json({ error: error.message });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// SCHEDULED TASKS (Heartbeat)
// =============================================================================

// Morning Briefing - 07:00 Bangkok time
if (config.autonomy.auto_morning_briefing) {
  cron.schedule(config.schedule.morning_briefing, async () => {
    console.log('[HEARTBEAT] Morning briefing triggered');
    await heartbeat.morningBriefing();
  }, { timezone: config.agent.timezone });
}

// Evening Summary - 18:00 Bangkok time
cron.schedule(config.schedule.evening_summary, async () => {
  console.log('[HEARTBEAT] Evening summary triggered');
  await heartbeat.eveningSummary();
}, { timezone: config.agent.timezone });

// Weekly Rank Check - Monday 09:00
if (config.autonomy.auto_rank_report) {
  cron.schedule(config.schedule.rank_check, async () => {
    console.log('[HEARTBEAT] Rank check triggered');
    await heartbeat.rankReport();
  }, { timezone: config.agent.timezone });
}

// =============================================================================
// PHASE 3.5: NIGHTLY SESSION SUMMARIZATION (Haiku)
// =============================================================================

// Nightly LINE Session Summarization - 23:00 Bangkok time
// Uses Claude Haiku for cost-effective summarization (~$0.30/month)
cron.schedule('0 23 * * *', async () => {
  console.log('[SUMMARIZER] Nightly LINE session summarization triggered');
  logSystemEvent('system', 'summarization_start', { type: 'line' });

  try {
    const { spawn } = await import('child_process');
    const summarizer = spawn('node', ['tools/summarize-session.js'], {
      cwd: import.meta.dirname,
      stdio: 'inherit'
    });

    summarizer.on('close', (code) => {
      console.log(`[SUMMARIZER] LINE summarization completed with code ${code}`);
      logSystemEvent('system', 'summarization_complete', { type: 'line', code });
    });
  } catch (error) {
    console.error('[SUMMARIZER] LINE error:', error);
    logError('system', error, { source: 'line-summarizer' });
  }
}, { timezone: config.agent.timezone });

// Nightly Terminal Session Summarization - 23:30 Bangkok time
// Summarizes Claude Code terminal sessions
cron.schedule('30 23 * * *', async () => {
  console.log('[SUMMARIZER] Nightly terminal session summarization triggered');
  logSystemEvent('system', 'summarization_start', { type: 'terminal' });

  try {
    const { spawn } = await import('child_process');
    const summarizer = spawn('node', ['tools/terminal-summarizer.js'], {
      cwd: import.meta.dirname,
      stdio: 'inherit'
    });

    summarizer.on('close', (code) => {
      console.log(`[SUMMARIZER] Terminal summarization completed with code ${code}`);
      logSystemEvent('system', 'summarization_complete', { type: 'terminal', code });
    });
  } catch (error) {
    console.error('[SUMMARIZER] Terminal error:', error);
    logError('system', error, { source: 'terminal-summarizer' });
  }
}, { timezone: config.agent.timezone });

// =============================================================================
// START SERVER
// =============================================================================

const PORT = process.env.PORT || 3000;

// Phase 3.5: Setup graceful shutdown BEFORE starting server
setupSignalHandlers({ timeout: 30000 });

// Register cleanup handlers
registerCleanup('session-logs', closeAllStreams, { phase: 'drain', priority: 0 });
registerCleanup('memory-save', () => memory.saveAll?.(), { phase: 'cleanup', priority: 10 });

const server = app.listen(PORT, async () => {
  // Phase 3.5: Register HTTP server for graceful shutdown
  registerHttpServer(server, 'express-server');

  // Phase 3.5: Initialize Session Logger
  initSessionLogger({ dir: 'data/sessions' });

  // Phase 3.5: Initialize Prompt Loader
  initPromptLoader({ dir: 'prompts', version: 'v1.0' });

  // Log server start event
  logSystemEvent('system', 'server_start', { port: PORT, version: '3.5.0' });

  // Check local status on startup
  const localOnline = LOCAL_TUNNEL_URL ? await checkLocalHealth() : false;

  // Initialize Autonomy Engine (Phase 3)
  autonomy.initialize();

  // Initialize Heartbeat System (Phase 4)
  if (config.heartbeat?.enabled) {
    heartbeatManager = new HeartbeatManager(config.heartbeat);

    // Set notification callback to LINE
    heartbeatManager.setNotifyCallback(async (message) => {
      console.log('[HEARTBEAT] Sending alert to LINE...');
      await line.notifyOwner(message);
      logSystemEvent('heartbeat', 'alert_sent', { length: message.length });
    });

    // Start heartbeat
    heartbeatManager.start();

    // Register cleanup
    registerCleanup('heartbeat', () => heartbeatManager.stop(), { phase: 'cleanup', priority: 5 });
  }

  // Initialize Sub-Agent System (Phase 5)
  if (config.subagent?.enabled) {
    subAgentManager = new SubAgentManager(config.subagent);

    // Set announce callback to LINE
    subAgentManager.setAnnounceCallback(async (message) => {
      console.log('[SUBAGENT] Announcing result to LINE...');
      await line.notifyOwner(message);
      logSystemEvent('subagent', 'announce_sent', { length: message.length });
    });

    // Set complete callback for logging
    subAgentManager.setCompleteCallback((run) => {
      logSystemEvent('subagent', 'run_complete', {
        runId: run.runId,
        status: run.status,
        runtime: run.runtime
      });
    });

    // Register cleanup
    registerCleanup('subagent', () => subAgentManager.stopAll(), { phase: 'cleanup', priority: 5 });

    console.log('[SUBAGENT] Sub-Agent Manager initialized');
  }

  // Initialize Webhook Ingress (Phase 7)
  // Register default handlers
  webhookIngress.on('beds24', '*', createBeds24Handler({ notifyOwner: (msg) => line.notifyOwner(msg) }));
  webhookIngress.on('stripe', '*', createStripeHandler({ notifyOwner: (msg) => line.notifyOwner(msg) }));
  webhookIngress.on('github', '*', createGitHubHandler({ notifyOwner: (msg) => line.notifyOwner(msg) }));

  // Log webhook events
  webhookIngress.on('webhook', (webhook) => {
    logSystemEvent('webhook', 'received', {
      id: webhook.id,
      source: webhook.source,
      eventType: webhook.eventType,
      status: webhook.status
    });
  });

  console.log('[WEBHOOK] Webhook Ingress initialized');
  console.log('[FAILOVER] Model Failover initialized');

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        ORACLE AGENT v5.2 - FULL OPENCLAW + PHASE 8         ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Status:  ONLINE                                           ║`);
  console.log(`║  Port:    ${PORT}                                              ║`);
  console.log(`║  Owner:   ${config.agent.owner}                                            ║`);
  console.log('║                                                            ║');
  console.log('║  🧠 PHASE 3: AUTONOMY ENGINE                               ║');
  console.log('║  - Goals: hospitality, investment, saas, business          ║');
  console.log('║  - Monitoring: Every 15 minutes                            ║');
  console.log('║  - Triggers: Price alerts, Occupancy, Opportunities        ║');
  console.log('║  - Learning: From Tars decisions                           ║');
  console.log('║                                                            ║');
  console.log('║  💓 PHASE 4: HEARTBEAT SYSTEM                              ║');
  console.log(`║  - Interval: ${config.heartbeat?.every || 'disabled'}                                       ║`);
  console.log(`║  - Active Hours: ${config.heartbeat?.activeHours ? config.heartbeat.activeHours.start + ':00-' + config.heartbeat.activeHours.end + ':00' : 'N/A'}                           ║`);
  console.log(`║  - Model: ${config.heartbeat?.model?.split('-')[2] || 'N/A'}                                         ║`);
  console.log('║                                                            ║');
  console.log('║  🚀 PHASE 5: SUB-AGENT SPAWN                               ║');
  console.log(`║  - Max Concurrent: ${config.subagent?.maxConcurrent || 'disabled'}                                     ║`);
  console.log(`║  - Default Model: ${config.subagent?.defaultModel?.split('-')[2] || 'N/A'}                               ║`);
  console.log(`║  - Timeout: ${config.subagent?.defaultTimeoutSeconds || 'N/A'}s                                       ║`);
  console.log('║                                                            ║');
  console.log('║  🌐 PHASE 6: MULTI-CHANNEL GATEWAY                         ║');
  console.log(`║  - LINE: ${config.line?.enabled !== false ? '✅ ENABLED' : '❌ DISABLED'}                                     ║`);
  console.log(`║  - Telegram: ${config.telegram?.enabled ? '✅ ENABLED' : '❌ DISABLED'}                                  ║`);
  console.log(`║  - WhatsApp: 🔜 PLANNED                                    ║`);
  console.log('║                                                            ║');
  console.log('║  🆕 PHASE 3.5: OPENCLAW UPGRADES                           ║');
  console.log(`║  - JSONL Logging: data/sessions/                           ║`);
  console.log(`║  - Prompts: ${getPromptVersion()} (prompts/)                              ║`);
  console.log('║  - Graceful Shutdown: ENABLED                              ║');
  console.log('║                                                            ║');
  console.log('║  🔄 FAILOVER MODE:                                         ║');
  console.log(`║  Local:   ${LOCAL_TUNNEL_URL ? (localOnline ? '✅ ONLINE (FREE)' : '❌ OFFLINE') : '⚠️  NOT CONFIGURED'}              ║`);
  console.log('║  Railway: ✅ ALWAYS-ON (API)                               ║');
  console.log('║                                                            ║');
  console.log('║  Autonomy Endpoints:                                       ║');
  console.log('║  - GET  /api/autonomy/status     Engine status             ║');
  console.log('║  - GET  /api/autonomy/approvals  Pending approvals         ║');
  console.log('║  - POST /api/autonomy/briefing   Send morning briefing     ║');
  console.log('║  - POST /api/autonomy/monitor    Run monitoring check      ║');
  console.log('║  - GET  /api/autonomy/market     Get market data           ║');
  console.log('║                                                            ║');
  console.log('║  Sub-Agent Endpoints:                                      ║');
  console.log('║  - GET  /api/subagent/status     Get status & stats        ║');
  console.log('║  - POST /api/subagent/spawn      Spawn sub-agent           ║');
  console.log('║  - GET  /api/subagent/runs/:id   Get run details           ║');
  console.log('║  - POST /api/subagent/stop/:id   Stop specific run         ║');
  console.log('║  - POST /api/subagent/stop-all   Stop all runs             ║');
  console.log('║                                                            ║');
  console.log('║  Gateway Endpoints:                                        ║');
  console.log('║  - GET  /api/gateway/status      Channel status            ║');
  console.log('║  - POST /api/gateway/notify      Notify owner              ║');
  console.log('║  - POST /webhook/telegram        Telegram webhook          ║');
  console.log('║                                                            ║');
  console.log('║  Phase 3.5 Endpoints:                                      ║');
  console.log('║  - GET  /api/sessions            List session logs         ║');
  console.log('║  - GET  /api/sessions/:id        Get session entries       ║');
  console.log('║  - GET  /api/prompts             List prompts              ║');
  console.log('║  - GET  /api/prompts/versions    List prompt versions      ║');
  console.log('║  - GET  /api/summaries           List summaries            ║');
  console.log('║  - POST /api/summarize           Trigger summarization     ║');
  console.log('║                                                            ║');
  console.log('║  Phase 7 Endpoints (Model Failover):                       ║');
  console.log('║  - GET  /api/models/status       Provider status           ║');
  console.log('║  - POST /api/models/send         Send with failover        ║');
  console.log('║  - POST /api/models/health-check Check all providers       ║');
  console.log('║                                                            ║');
  console.log('║  Phase 7 Endpoints (Webhook Ingress):                      ║');
  console.log('║  - GET  /api/webhooks/status     Webhook status            ║');
  console.log('║  - GET  /api/webhooks/history    Webhook history           ║');
  console.log('║  - POST /webhook/beds24          Beds24 webhook            ║');
  console.log('║  - POST /webhook/stripe          Stripe webhook            ║');
  console.log('║  - POST /webhook/github          GitHub webhook            ║');
  console.log('║                                                            ║');
  console.log('║  Phase 8 Endpoints (Gmail + Queue):                        ║');
  console.log('║  - GET  /api/gmail/status        Gmail status              ║');
  console.log('║  - POST /webhook/gmail           Gmail webhook             ║');
  console.log('║  - POST /api/gmail/process       Process email             ║');
  console.log('║  - GET  /api/queue/status        Queue status              ║');
  console.log('║  - POST /api/queue/enqueue       Enqueue message           ║');
  console.log('║  - GET  /api/queue/lane/:lane    Lane status               ║');
  console.log('║                                                            ║');
  console.log('║  Scheduled:                                                ║');
  console.log('║  - 07:00  Morning Briefing (Auto)                          ║');
  console.log('║  - 18:00  Evening Summary                                  ║');
  console.log('║  - 23:00  Session Summarization (Haiku)                    ║');
  console.log('║  - Every 15min  Monitoring Loop                            ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  if (!LOCAL_TUNNEL_URL) {
    console.log('⚠️  Set LOCAL_TUNNEL_URL environment variable to enable failover');
    console.log('   Example: https://your-tunnel.trycloudflare.com');
    console.log('');
  }
});
