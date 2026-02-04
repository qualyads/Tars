/**
 * Autonomous Scheduler - ทำให้ Oracle ทำงานเองจริงๆ
 *
 * ไม่ใช่แค่ตอบคำถาม แต่:
 * - ส่ง Morning Briefing ทุกวัน 7:00
 * - ส่ง Evening Summary ทุกวัน 18:00
 * - Check Market ทุกชั่วโมง
 * - Alert เมื่อเกิด event สำคัญ
 * - เสนอ action แล้วรอ approve ใน LINE
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// For JSON imports
const require = createRequire(import.meta.url);

// Load configs
let config = {};
let sharedConfig = {};
try {
  config = require('../config.json');
} catch (e) {}
try {
  sharedConfig = require('../shared-config.json');
} catch (e) {}

const LINE_TOKEN = config.line?.channel_token || sharedConfig.line?.channel_token;
const OWNER_ID = config.line?.owner_id || sharedConfig.line?.owner_id || 'Uba2ae89ff15d0ca1ea673058844f287c';

// =============================================================================
// HEARTBEAT TOKEN (จาก OpenClaw)
// AI ตอบ HEARTBEAT_OK เมื่อไม่มีอะไรต้องรายงาน → ไม่ส่งข้อความ
// =============================================================================

const HEARTBEAT_OK = 'HEARTBEAT_OK';
const HEARTBEAT_ACK_MAX_CHARS = 300;  // ถ้าข้อความสั้นกว่านี้ + มี HEARTBEAT_OK → skip

/**
 * ตรวจสอบว่าควรส่งข้อความหรือไม่ (จาก OpenClaw pattern)
 */
function shouldSendHeartbeat(text) {
  if (!text || !text.trim()) return { skip: true, text: '', reason: 'empty' };

  const trimmed = text.trim();

  // ถ้าเป็น HEARTBEAT_OK อย่างเดียว → skip
  if (trimmed === HEARTBEAT_OK) {
    return { skip: true, text: '', reason: 'heartbeat_ok' };
  }

  // ถ้าขึ้นต้นด้วย HEARTBEAT_OK
  if (trimmed.startsWith(HEARTBEAT_OK)) {
    const rest = trimmed.slice(HEARTBEAT_OK.length).trim();
    // ถ้าข้อความที่เหลือสั้น (แค่ ack) → skip
    if (rest.length <= HEARTBEAT_ACK_MAX_CHARS) {
      return { skip: true, text: '', reason: 'short_ack' };
    }
    // มีเนื้อหาจริง → ส่ง
    return { skip: false, text: rest, reason: 'has_content' };
  }

  // ถ้าลงท้ายด้วย HEARTBEAT_OK
  if (trimmed.endsWith(HEARTBEAT_OK)) {
    const rest = trimmed.slice(0, -HEARTBEAT_OK.length).trim();
    if (rest.length <= HEARTBEAT_ACK_MAX_CHARS) {
      return { skip: true, text: '', reason: 'short_ack' };
    }
    return { skip: false, text: rest, reason: 'has_content' };
  }

  // ไม่มี HEARTBEAT_OK → ส่งปกติ
  return { skip: false, text: trimmed, reason: 'normal' };
}

// =============================================================================
// ACTIVE HOURS (จาก OpenClaw)
// ไม่รบกวนตอนกลางคืน
// =============================================================================

const ACTIVE_HOURS = {
  start: 7,   // 07:00
  end: 22,    // 22:00
  timezone: 'Asia/Bangkok'
};

/**
 * ตรวจสอบว่าอยู่ในช่วงเวลาทำงานหรือไม่
 */
function isActiveHours() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ACTIVE_HOURS.timezone,
    hour: '2-digit',
    hourCycle: 'h23'
  });
  const hour = parseInt(formatter.format(now));

  return hour >= ACTIVE_HOURS.start && hour < ACTIVE_HOURS.end;
}

/**
 * ตรวจสอบว่าเป็น quiet hours หรือไม่
 */
function isQuietHours() {
  return !isActiveHours();
}

// =============================================================================
// STATE
// =============================================================================

const state = {
  lastBtcPrice: null,
  lastGoldPrice: null,
  lastFearGreed: null,
  lastBriefing: null,
  pendingApprovals: [],
  dailyStats: {
    alerts_sent: 0,
    suggestions_made: 0,
    approved: 0,
    rejected: 0,
    skipped_quiet_hours: 0,
    skipped_dedup: 0,
    skipped_heartbeat_ok: 0
  },
  // Dedup Protection (จาก OpenClaw) - ไม่ส่งซ้ำภายใน 24h
  lastHeartbeatTexts: {},  // { messageHash: timestamp }
  // Active conversation tracking
  activeConversation: null,  // { userId, startedAt }
};

// Load state from file
const STATE_FILE = path.join(__dirname, '..', 'autonomous-state.json');
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      Object.assign(state, saved);
      // Initialize new fields if missing
      if (!state.lastHeartbeatTexts) state.lastHeartbeatTexts = {};
      if (!state.dailyStats.skipped_quiet_hours) state.dailyStats.skipped_quiet_hours = 0;
      if (!state.dailyStats.skipped_dedup) state.dailyStats.skipped_dedup = 0;
      if (!state.dailyStats.skipped_heartbeat_ok) state.dailyStats.skipped_heartbeat_ok = 0;
      console.log('[SCHEDULER] State loaded');
    }
  } catch (e) {}
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {}
}

// =============================================================================
// DEDUP PROTECTION (จาก OpenClaw)
// ไม่ส่งข้อความซ้ำภายใน 24 ชั่วโมง
// =============================================================================

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;  // 24 hours

/**
 * สร้าง hash จากข้อความ
 */
function hashMessage(text) {
  // Simple hash - ใช้ first 100 chars normalized
  const normalized = text.trim().toLowerCase().slice(0, 100);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * ตรวจสอบว่าข้อความนี้ซ้ำหรือไม่
 */
function isDuplicateMessage(text) {
  const hash = hashMessage(text);
  const lastSent = state.lastHeartbeatTexts[hash];

  if (!lastSent) return false;

  const timeSince = Date.now() - lastSent;
  return timeSince < DEDUP_WINDOW_MS;
}

/**
 * บันทึกข้อความที่ส่งแล้ว
 */
function recordSentMessage(text) {
  const hash = hashMessage(text);
  state.lastHeartbeatTexts[hash] = Date.now();

  // Cleanup old entries (older than 24h)
  const cutoff = Date.now() - DEDUP_WINDOW_MS;
  for (const [h, ts] of Object.entries(state.lastHeartbeatTexts)) {
    if (ts < cutoff) {
      delete state.lastHeartbeatTexts[h];
    }
  }

  saveState();
}

// =============================================================================
// QUEUE CHECK (จาก OpenClaw)
// ไม่ interrupt active conversations
// =============================================================================

/**
 * Mark conversation as active
 */
function markConversationActive(userId) {
  state.activeConversation = {
    userId,
    startedAt: Date.now()
  };
}

/**
 * Mark conversation as inactive
 */
function markConversationInactive() {
  state.activeConversation = null;
}

/**
 * Check if there's an active conversation (within last 5 minutes)
 */
function hasActiveConversation() {
  if (!state.activeConversation) return false;

  const ACTIVE_WINDOW_MS = 5 * 60 * 1000;  // 5 minutes
  const timeSince = Date.now() - state.activeConversation.startedAt;

  if (timeSince > ACTIVE_WINDOW_MS) {
    state.activeConversation = null;
    return false;
  }

  return true;
}

// =============================================================================
// LINE MESSAGING (Enhanced with OpenClaw patterns)
// =============================================================================

/**
 * Send LINE message with all OpenClaw-inspired checks
 * @param {string} message - ข้อความที่จะส่ง
 * @param {object} options - ตัวเลือก
 * @param {boolean} options.force - ส่งแม้อยู่นอก active hours
 * @param {boolean} options.skipDedup - ไม่ตรวจสอบ duplicate
 * @param {boolean} options.isHeartbeat - เป็น heartbeat message (ใช้ HEARTBEAT_OK check)
 */
function sendLine(message, options = {}) {
  return new Promise((resolve) => {
    if (!LINE_TOKEN || !OWNER_ID) {
      console.log('[SCHEDULER] No LINE config, skipping:', message.substring(0, 50));
      resolve(false);
      return;
    }

    // 1. Check HEARTBEAT_OK pattern
    if (options.isHeartbeat) {
      const heartbeatCheck = shouldSendHeartbeat(message);
      if (heartbeatCheck.skip) {
        console.log(`[SCHEDULER] Skipped (${heartbeatCheck.reason}): HEARTBEAT_OK`);
        state.dailyStats.skipped_heartbeat_ok++;
        saveState();
        resolve(true);  // Success - but no message sent
        return;
      }
      message = heartbeatCheck.text || message;
    }

    // 2. Check Active Hours (unless forced)
    if (!options.force && isQuietHours()) {
      console.log('[SCHEDULER] Skipped (quiet hours):', message.substring(0, 30));
      state.dailyStats.skipped_quiet_hours++;
      saveState();
      resolve(true);  // Don't fail, just skip
      return;
    }

    // 3. Check Active Conversation (unless forced)
    if (!options.force && hasActiveConversation()) {
      console.log('[SCHEDULER] Skipped (active conversation)');
      resolve(true);
      return;
    }

    // 4. Check Duplicate (unless skipDedup)
    if (!options.skipDedup && isDuplicateMessage(message)) {
      console.log('[SCHEDULER] Skipped (duplicate within 24h):', message.substring(0, 30));
      state.dailyStats.skipped_dedup++;
      saveState();
      resolve(true);
      return;
    }

    // 5. Actually send
    const data = JSON.stringify({
      to: OWNER_ID,
      messages: [{ type: 'text', text: message.substring(0, 4500) }]
    });

    const req = https.request({
      hostname: 'api.line.me',
      path: '/v2/bot/message/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_TOKEN}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      if (res.statusCode === 200) {
        // Record for dedup
        recordSentMessage(message);
        console.log('[SCHEDULER] Message sent:', message.substring(0, 40) + '...');
      }
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

/**
 * Send LINE message bypassing all checks (for critical alerts)
 */
function sendLineCritical(message) {
  return sendLine(message, { force: true, skipDedup: true });
}

// Quick reply with options
function sendLineWithOptions(message, options) {
  return new Promise((resolve) => {
    if (!LINE_TOKEN || !OWNER_ID) {
      resolve(false);
      return;
    }

    const quickReply = {
      items: options.map(opt => ({
        type: 'action',
        action: {
          type: 'message',
          label: opt.label,
          text: opt.text
        }
      }))
    };

    const data = JSON.stringify({
      to: OWNER_ID,
      messages: [{
        type: 'text',
        text: message,
        quickReply: quickReply
      }]
    });

    const req = https.request({
      hostname: 'api.line.me',
      path: '/v2/bot/message/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_TOKEN}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

// =============================================================================
// DATA FETCHING
// =============================================================================

function fetchJSON(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function getMarketData() {
  const [btc, fng, gold] = await Promise.all([
    fetchJSON('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
    fetchJSON('https://api.alternative.me/fng/?limit=1'),
    fetchJSON('https://api.gold-api.com/price/XAU')
  ]);

  return {
    btc: btc ? {
      price: parseFloat(btc.lastPrice),
      change: parseFloat(btc.priceChangePercent)
    } : null,
    fearGreed: fng?.data?.[0] ? {
      value: parseInt(fng.data[0].value),
      label: fng.data[0].value_classification
    } : null,
    gold: gold?.price ? {
      usd: gold.price,
      change: gold.chp || 0
    } : null
  };
}

// =============================================================================
// TRIGGERS & THRESHOLDS (ปรับให้ sensitive ขึ้น)
// =============================================================================

const THRESHOLDS = {
  btc_change: 2,        // Alert เมื่อ BTC ขึ้น/ลง 2%+
  gold_change: 1,       // Alert เมื่อทองขึ้น/ลง 1%+
  fear_extreme_low: 25, // Extreme Fear
  fear_extreme_high: 75 // Extreme Greed
};

// =============================================================================
// SCHEDULED TASKS
// =============================================================================

/**
 * Morning Briefing - ทุกวัน 7:00
 */
async function morningBriefing() {
  console.log('[SCHEDULER] Generating Morning Briefing...');

  const market = await getMarketData();
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let msg = `☀️ Morning Briefing\n${dateStr}\n\n`;

  // Market Status
  msg += `📊 ตลาด\n`;
  if (market.btc) {
    const arrow = market.btc.change >= 0 ? '📈' : '📉';
    msg += `├ BTC: $${market.btc.price.toLocaleString()} ${arrow} ${market.btc.change.toFixed(1)}%\n`;
  }
  if (market.fearGreed) {
    msg += `├ Fear & Greed: ${market.fearGreed.value} (${market.fearGreed.label})\n`;
  }
  if (market.gold) {
    msg += `└ Gold: $${market.gold.usd.toFixed(0)}/oz\n`;
  }

  // Analysis
  msg += `\n🎯 วิเคราะห์\n`;

  if (market.fearGreed?.value <= THRESHOLDS.fear_extreme_low) {
    msg += `├ ⚠️ Extreme Fear - โอกาสซื้อ?\n`;
  } else if (market.fearGreed?.value >= THRESHOLDS.fear_extreme_high) {
    msg += `├ ⚠️ Extreme Greed - ระวังขาย?\n`;
  } else {
    msg += `├ ตลาดปกติ\n`;
  }

  // Pending items
  if (state.pendingApprovals.length > 0) {
    msg += `\n📋 รออนุมัติ: ${state.pendingApprovals.length} รายการ\n`;
  }

  msg += `\n━━━━━━━━━━━━━━━\nมีอะไรให้ช่วยวันนี้ไหมครับ?`;

  // Morning briefing ส่งเสมอ (force: true) เพราะเป็น scheduled task
  await sendLine(msg, { force: true, skipDedup: true });
  state.lastBriefing = now.toISOString();
  state.dailyStats.alerts_sent++;
  saveState();

  console.log('[SCHEDULER] Morning Briefing sent');
}

/**
 * Evening Summary - ทุกวัน 18:00
 */
async function eveningSummary() {
  console.log('[SCHEDULER] Generating Evening Summary...');

  const market = await getMarketData();

  let msg = `🌙 Evening Summary\n\n`;

  // Market changes from morning
  msg += `📊 สรุปตลาดวันนี้\n`;
  if (market.btc) {
    const arrow = market.btc.change >= 0 ? '📈' : '📉';
    msg += `├ BTC: $${market.btc.price.toLocaleString()} (${arrow} ${market.btc.change.toFixed(1)}%)\n`;
  }
  if (market.fearGreed) {
    msg += `└ Sentiment: ${market.fearGreed.label}\n`;
  }

  // Today's activity
  msg += `\n📈 Oracle Activity\n`;
  msg += `├ Alerts: ${state.dailyStats.alerts_sent}\n`;
  msg += `├ Suggestions: ${state.dailyStats.suggestions_made}\n`;
  msg += `└ Approved: ${state.dailyStats.approved}/${state.dailyStats.approved + state.dailyStats.rejected}\n`;

  msg += `\n━━━━━━━━━━━━━━━\nพักผ่อนครับ 🙏`;

  // Evening summary ส่งเสมอ (force: true) เพราะเป็น scheduled task
  await sendLine(msg, { force: true, skipDedup: true });

  // Reset daily stats (เก็บ heartbeat stats ไว้)
  state.dailyStats = {
    alerts_sent: 0,
    suggestions_made: 0,
    approved: 0,
    rejected: 0,
    skipped_quiet_hours: 0,
    skipped_dedup: 0,
    skipped_heartbeat_ok: 0
  };
  saveState();

  console.log('[SCHEDULER] Evening Summary sent');
}

/**
 * Market Check - ทุกชั่วโมง
 */
async function hourlyMarketCheck() {
  console.log('[SCHEDULER] Hourly market check...');

  const market = await getMarketData();
  const alerts = [];

  // BTC significant change
  if (market.btc && state.lastBtcPrice) {
    const change = ((market.btc.price - state.lastBtcPrice) / state.lastBtcPrice) * 100;
    if (Math.abs(change) >= THRESHOLDS.btc_change) {
      const arrow = change >= 0 ? '📈' : '📉';
      alerts.push(`${arrow} BTC ${change >= 0 ? 'ขึ้น' : 'ลง'} ${Math.abs(change).toFixed(1)}%\n$${market.btc.price.toLocaleString()}`);

      // Suggest action if significant drop
      if (change <= -5) {
        await suggestAction('btc_buy', `BTC ลง ${Math.abs(change).toFixed(1)}% - โอกาสซื้อ DCA?`, {
          price: market.btc.price,
          change: change
        });
      }
    }
  }
  state.lastBtcPrice = market.btc?.price || state.lastBtcPrice;

  // Fear & Greed extreme change
  if (market.fearGreed && state.lastFearGreed !== market.fearGreed.value) {
    if (market.fearGreed.value <= THRESHOLDS.fear_extreme_low && state.lastFearGreed > THRESHOLDS.fear_extreme_low) {
      alerts.push(`😱 Fear & Greed = ${market.fearGreed.value} (Extreme Fear)\nตลาดกลัวมาก = โอกาสซื้อ?`);
    } else if (market.fearGreed.value >= THRESHOLDS.fear_extreme_high && state.lastFearGreed < THRESHOLDS.fear_extreme_high) {
      alerts.push(`🤑 Fear & Greed = ${market.fearGreed.value} (Extreme Greed)\nตลาดโลภมาก = ระวังขาย?`);
    }
    state.lastFearGreed = market.fearGreed.value;
  }

  // Gold significant change
  if (market.gold && Math.abs(market.gold.change) >= THRESHOLDS.gold_change) {
    const arrow = market.gold.change >= 0 ? '📈' : '📉';
    alerts.push(`${arrow} ทอง ${market.gold.change >= 0 ? 'ขึ้น' : 'ลง'} ${Math.abs(market.gold.change).toFixed(1)}%\n$${market.gold.usd.toFixed(0)}/oz`);
  }

  // Send alerts (with heartbeat checks)
  if (alerts.length > 0) {
    const msg = `🚨 Market Alert\n\n${alerts.join('\n\n')}`;
    const sent = await sendLine(msg, { isHeartbeat: true });
    if (sent) {
      state.dailyStats.alerts_sent += alerts.length;
      console.log(`[SCHEDULER] Sent ${alerts.length} alerts`);
    }
  } else {
    // No alerts = HEARTBEAT_OK equivalent
    console.log('[SCHEDULER] Market check: HEARTBEAT_OK (no alerts)');
  }

  saveState();
}

// =============================================================================
// SUGGESTION & APPROVAL SYSTEM
// =============================================================================

async function suggestAction(type, message, data) {
  const id = Date.now().toString(36);

  state.pendingApprovals.push({
    id,
    type,
    message,
    data,
    timestamp: new Date().toISOString(),
    status: 'pending'
  });
  state.dailyStats.suggestions_made++;
  saveState();

  // Send with quick reply options
  await sendLineWithOptions(
    `💡 Oracle แนะนำ\n\n${message}\n\n[ID: ${id}]`,
    [
      { label: '✅ อนุมัติ', text: `อนุมัติ ${id}` },
      { label: '❌ ไม่', text: `ไม่อนุมัติ ${id}` },
      { label: '📋 ดูเพิ่ม', text: `รายละเอียด ${id}` }
    ]
  );

  console.log(`[SCHEDULER] Suggestion sent: ${type} (${id})`);
  return id;
}

function processApproval(text) {
  // Parse approval from LINE message
  const approveMatch = text.match(/อนุมัติ\s*(\w+)/);
  const rejectMatch = text.match(/ไม่อนุมัติ\s*(\w+)/);
  const detailMatch = text.match(/รายละเอียด\s*(\w+)/);

  if (approveMatch) {
    const id = approveMatch[1];
    const item = state.pendingApprovals.find(p => p.id === id);
    if (item) {
      item.status = 'approved';
      item.processedAt = new Date().toISOString();
      state.dailyStats.approved++;
      saveState();
      return { action: 'approved', item };
    }
  }

  if (rejectMatch) {
    const id = rejectMatch[1];
    const item = state.pendingApprovals.find(p => p.id === id);
    if (item) {
      item.status = 'rejected';
      item.processedAt = new Date().toISOString();
      state.dailyStats.rejected++;
      saveState();
      return { action: 'rejected', item };
    }
  }

  if (detailMatch) {
    const id = detailMatch[1];
    const item = state.pendingApprovals.find(p => p.id === id);
    if (item) {
      return { action: 'detail', item };
    }
  }

  return null;
}

// =============================================================================
// SCHEDULER
// =============================================================================

let intervals = [];

function start() {
  loadState();
  console.log('[SCHEDULER] Starting Autonomous Scheduler...');

  const now = new Date();
  const hour = now.getHours();

  // Morning Briefing at 7:00
  const msUntil7am = getMillisecondsUntil(7, 0);
  setTimeout(() => {
    morningBriefing();
    // Then every 24 hours
    intervals.push(setInterval(morningBriefing, 24 * 60 * 60 * 1000));
  }, msUntil7am);

  // Evening Summary at 18:00
  const msUntil6pm = getMillisecondsUntil(18, 0);
  setTimeout(() => {
    eveningSummary();
    intervals.push(setInterval(eveningSummary, 24 * 60 * 60 * 1000));
  }, msUntil6pm);

  // Hourly market check
  const msUntilNextHour = getMillisecondsUntil(hour + 1, 0);
  setTimeout(() => {
    hourlyMarketCheck();
    intervals.push(setInterval(hourlyMarketCheck, 60 * 60 * 1000));
  }, msUntilNextHour);

  // Initial market data fetch
  setTimeout(async () => {
    const market = await getMarketData();
    state.lastBtcPrice = market.btc?.price;
    state.lastFearGreed = market.fearGreed?.value;
    saveState();
    console.log('[SCHEDULER] Initial market data loaded');
  }, 5000);

  console.log('[SCHEDULER] Scheduled:');
  console.log(`  - Morning Briefing: 7:00 (in ${Math.round(msUntil7am / 60000)} min)`);
  console.log(`  - Evening Summary: 18:00 (in ${Math.round(msUntil6pm / 60000)} min)`);
  console.log(`  - Market Check: Every hour (next in ${Math.round(msUntilNextHour / 60000)} min)`);
}

function stop() {
  intervals.forEach(i => clearInterval(i));
  intervals = [];
  console.log('[SCHEDULER] Stopped');
}

function getMillisecondsUntil(targetHour, targetMinute) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(targetHour, targetMinute, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target - now;
}

// =============================================================================
// MANUAL TRIGGERS (for testing)
// =============================================================================

async function triggerBriefing() {
  return await morningBriefing();
}

async function triggerSummary() {
  return await eveningSummary();
}

async function triggerMarketCheck() {
  return await hourlyMarketCheck();
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  start,
  stop,
  triggerBriefing,
  triggerSummary,
  triggerMarketCheck,
  processApproval,
  suggestAction,
  HEARTBEAT_OK,
  shouldSendHeartbeat,
  isActiveHours,
  isQuietHours,
  isDuplicateMessage,
  hasActiveConversation,
  markConversationActive,
  markConversationInactive,
  sendLineCritical,
  ACTIVE_HOURS
};

// Getter functions
const getState = () => state;
const getPendingApprovals = () => state.pendingApprovals.filter(p => p.status === 'pending');
const getHeartbeatStats = () => ({
  skipped_quiet_hours: state.dailyStats.skipped_quiet_hours,
  skipped_dedup: state.dailyStats.skipped_dedup,
  skipped_heartbeat_ok: state.dailyStats.skipped_heartbeat_ok,
  alerts_sent: state.dailyStats.alerts_sent
});

export { getState, getPendingApprovals, getHeartbeatStats };

export default {
  start,
  stop,
  triggerBriefing,
  triggerSummary,
  triggerMarketCheck,
  processApproval,
  suggestAction,
  getState,
  getPendingApprovals,
  HEARTBEAT_OK,
  shouldSendHeartbeat,
  isActiveHours,
  isQuietHours,
  isDuplicateMessage,
  hasActiveConversation,
  markConversationActive,
  markConversationInactive,
  sendLineCritical,
  ACTIVE_HOURS,
  getHeartbeatStats
};
