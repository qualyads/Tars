/**
 * Oracle Agent - Main Server v3.0 (Autonomous Mode)
 * Digital Partner for Tars - ALL aspects of life
 *
 * Features:
 * - 24/7 Always-on (Failover System)
 * - LINE 2-way communication
 * - Router: Local (free) → Railway (API)
 * - Phase 3: AUTONOMY ENGINE
 *   - Proactive monitoring (Gold, BTC, Hotel)
 *   - Pattern detection & opportunity alerts
 *   - Approval queue for decisions
 *   - Learning from Tars's decisions
 * - Shared memory system with learnings
 */

require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const https = require('https');
const http = require('http');
const config = require('./config.json');

// Import modules
const claude = require('./lib/claude');
const line = require('./lib/line');
const memory = require('./lib/memory');
const memorySync = require('./lib/memory-sync');
const heartbeat = require('./lib/heartbeat');
const beds24 = require('./lib/beds24');
const autonomy = require('./lib/autonomy');

const app = express();
app.use(express.json());

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

        console.log(`[LINE] Message from ${userId}: ${userMessage}`);

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

        // Reply via LINE
        await line.reply(replyToken, response);

        console.log(`[LINE] Replied to ${userId}: ${response.substring(0, 50)}...`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[LINE] Webhook error:', error);
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
// START SERVER
// =============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  // Check local status on startup
  const localOnline = LOCAL_TUNNEL_URL ? await checkLocalHealth() : false;

  // Initialize Autonomy Engine (Phase 3)
  autonomy.initialize();

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        ORACLE AGENT v3.0 - AUTONOMOUS MODE                 ║');
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
  console.log('║  Scheduled:                                                ║');
  console.log('║  - 07:00  Morning Briefing (Auto)                          ║');
  console.log('║  - 18:00  Evening Summary                                  ║');
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
