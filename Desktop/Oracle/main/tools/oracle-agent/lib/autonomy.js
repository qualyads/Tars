/**
 * Autonomy Engine - Phase 3
 *
 * Oracle Agent's brain that:
 * - Monitors external data continuously
 * - Detects patterns and opportunities
 * - Takes actions within boundaries
 * - Queues actions needing approval
 * - Learns from Tars's decisions
 */

const https = require('https');
const http = require('http');
const memorySync = require('./memory-sync');
const path = require('path');
const fs = require('fs');

// LINE module (may not exist when running from Terminal)
let line = null;
try {
  line = require('./line');
} catch (e) {
  console.log('[AUTONOMY] LINE module not available, using direct API');
}

// Beds24 module (may not exist or may not have valid tokens)
let beds24 = null;
let beds24Available = false;
try {
  beds24 = require('./beds24');
  // Check if beds24 has valid config by checking if token functions exist
  if (beds24 && beds24.getTokenStatus) {
    const status = beds24.getTokenStatus();
    beds24Available = status && status.hasAccessToken && status.tokenLength > 10;
    if (!beds24Available) {
      console.log('[AUTONOMY] Beds24 token not configured (missing or too short)');
    }
  }
} catch (e) {
  console.log('[AUTONOMY] Beds24 module not available:', e.message);
}

// Load config for LINE token
let lineConfig = {};
try {
  const configPath = path.join(__dirname, '..', 'config.json');
  if (fs.existsSync(configPath)) {
    lineConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {}

// Also try shared-config
let sharedConfig = {};
try {
  const sharedPath = path.join(__dirname, '..', 'shared-config.json');
  if (fs.existsSync(sharedPath)) {
    sharedConfig = JSON.parse(fs.readFileSync(sharedPath, 'utf8'));
  }
} catch (e) {}

// =============================================================================
// GOALS & BOUNDARIES (What Oracle aims for)
// =============================================================================

const GOALS = {
  hospitality: {
    name: 'Best Hotel Pai',
    objectives: [
      { id: 'occupancy', target: 80, metric: 'percent', description: 'Occupancy rate >= 80%' },
      { id: 'revenue', target: 'maximize', description: 'Maximize revenue per room' },
      { id: 'reviews', target: 4.5, metric: 'score', description: 'Average review >= 4.5' },
      { id: 'response_time', target: 5, metric: 'minutes', description: 'Guest inquiry response < 5 min' }
    ],
    autonomy_level: 'medium' // Can suggest, can alert, needs approval for actions
  },

  investment: {
    name: 'Investment Portfolio',
    objectives: [
      { id: 'gold_alert', description: 'Alert on significant gold price moves' },
      { id: 'btc_alert', description: 'Alert on BTC price and Fear & Greed changes' },
      { id: 'opportunity', description: 'Spot buying/selling opportunities' }
    ],
    autonomy_level: 'low' // Only alert and suggest, never act
  },

  saas: {
    name: 'SaaS Projects',
    objectives: [
      { id: 'uptime', target: 99.9, metric: 'percent', description: 'Service uptime >= 99.9%' },
      { id: 'revenue', description: 'Track and grow MRR' },
      { id: 'users', description: 'Monitor user growth and churn' }
    ],
    autonomy_level: 'medium'
  },

  business: {
    name: 'Casperstack & VisionXBrain',
    objectives: [
      { id: 'leads', description: 'Track new leads and opportunities' },
      { id: 'projects', description: 'Monitor project status' },
      { id: 'seo', description: 'Track SEO rankings' }
    ],
    autonomy_level: 'low'
  },

  personal: {
    name: 'Personal Assistant',
    objectives: [
      { id: 'morning_briefing', description: 'Send daily briefing at 7am' },
      { id: 'reminders', description: 'Remind important tasks' },
      { id: 'knowledge', description: 'Learn and remember everything' }
    ],
    autonomy_level: 'high' // Can act on most things
  }
};

// =============================================================================
// TRIGGER RULES (When to act)
// =============================================================================

const TRIGGERS = {
  // Gold price triggers
  gold_price_change: {
    domain: 'investment',
    condition: (data) => Math.abs(data.change_percent) >= 1,
    action: 'alert',
    message: (data) => `ทอง ${data.change_percent > 0 ? '📈 ขึ้น' : '📉 ลง'} ${Math.abs(data.change_percent).toFixed(2)}% (${data.price} บาท/บาท)`
  },

  gold_buy_signal: {
    domain: 'investment',
    condition: (data) => data.change_percent <= -2,
    action: 'suggest',
    message: (data) => `ทองลง ${Math.abs(data.change_percent).toFixed(2)}% - โอกาสซื้อ?`,
    requires_approval: true
  },

  // BTC triggers
  btc_price_change: {
    domain: 'investment',
    condition: (data) => Math.abs(data.change_percent) >= 3,
    action: 'alert',
    message: (data) => `BTC ${data.change_percent > 0 ? '📈' : '📉'} ${Math.abs(data.change_percent).toFixed(2)}% ($${data.price.toLocaleString()})`
  },

  fear_greed_extreme: {
    domain: 'investment',
    condition: (data) => data.value <= 20 || data.value >= 80,
    action: 'alert',
    message: (data) => {
      if (data.value <= 20) return `Fear & Greed: ${data.value} (Extreme Fear) - โอกาสซื้อ?`;
      return `Fear & Greed: ${data.value} (Extreme Greed) - ระวังขายทำกำไร?`;
    }
  },

  // Hotel triggers
  low_occupancy: {
    domain: 'hospitality',
    condition: (data) => data.occupancy < 50,
    action: 'suggest',
    message: (data) => `Occupancy ต่ำ ${data.occupancy}% - ควรเพิ่ม promotion?`,
    requires_approval: true
  },

  high_occupancy: {
    domain: 'hospitality',
    condition: (data) => data.occupancy >= 90,
    action: 'suggest',
    message: (data) => `Occupancy สูง ${data.occupancy}% - ควรขึ้นราคา?`
  },

  new_booking: {
    domain: 'hospitality',
    condition: () => true, // Always trigger on new booking
    action: 'alert',
    message: (data) => `Booking ใหม่: ${data.guest_name} (${data.check_in} - ${data.check_out})`
  },

  check_in_today: {
    domain: 'hospitality',
    condition: (data) => data.count > 0,
    action: 'alert',
    message: (data) => `วันนี้มี Check-in ${data.count} ห้อง: ${data.guests.join(', ')}`
  },

  check_out_today: {
    domain: 'hospitality',
    condition: (data) => data.count > 0,
    action: 'alert',
    message: (data) => `วันนี้มี Check-out ${data.count} ห้อง`
  },

  // Morning briefing trigger
  morning_briefing_time: {
    domain: 'personal',
    condition: () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      return hour === 7 && minute === 0;
    },
    action: 'execute',
    execute: 'sendMorningBriefing'
  }
};

// =============================================================================
// APPROVAL QUEUE (For actions needing Tars's approval)
// =============================================================================

let approvalQueue = [];

function addToApprovalQueue(item) {
  const entry = {
    id: Date.now().toString(36),
    timestamp: new Date().toISOString(),
    domain: item.domain,
    type: item.type,
    message: item.message,
    data: item.data,
    status: 'pending',
    suggested_action: item.suggested_action
  };

  approvalQueue.push(entry);

  // Save to memory
  const memory = memorySync.getMemory();
  memory.context.pending_approvals = approvalQueue.filter(a => a.status === 'pending');
  memorySync.saveLocalMemory();

  console.log(`[AUTONOMY] Added to approval queue: ${entry.id} - ${entry.message}`);
  return entry;
}

function processApproval(id, approved, feedback = null) {
  const item = approvalQueue.find(a => a.id === id);
  if (!item) return null;

  item.status = approved ? 'approved' : 'rejected';
  item.processed_at = new Date().toISOString();
  item.feedback = feedback;

  // Learn from this decision
  learnFromDecision(item);

  // If approved, execute the suggested action
  if (approved && item.suggested_action) {
    executeAction(item.suggested_action, item.data);
  }

  // Update memory
  const memory = memorySync.getMemory();
  memory.context.pending_approvals = approvalQueue.filter(a => a.status === 'pending');
  memorySync.saveLocalMemory();

  return item;
}

function getPendingApprovals() {
  return approvalQueue.filter(a => a.status === 'pending');
}

// =============================================================================
// LEARNING SYSTEM (Learn from Tars's decisions)
// =============================================================================

function learnFromDecision(decision) {
  const memory = memorySync.getMemory();

  if (!memory.learnings.decisions) {
    memory.learnings.decisions = [];
  }

  memory.learnings.decisions.push({
    timestamp: new Date().toISOString(),
    domain: decision.domain,
    type: decision.type,
    approved: decision.status === 'approved',
    context: decision.data,
    feedback: decision.feedback
  });

  // Keep last 100 decisions
  memory.learnings.decisions = memory.learnings.decisions.slice(-100);

  // Analyze patterns
  analyzeDecisionPatterns(memory);

  memorySync.saveLocalMemory();

  console.log(`[AUTONOMY] Learned from decision: ${decision.type} = ${decision.status}`);
}

function analyzeDecisionPatterns(memory) {
  const decisions = memory.learnings.decisions || [];
  if (decisions.length < 5) return;

  // Group by type
  const byType = {};
  for (const d of decisions) {
    if (!byType[d.type]) {
      byType[d.type] = { approved: 0, rejected: 0 };
    }
    if (d.approved) {
      byType[d.type].approved++;
    } else {
      byType[d.type].rejected++;
    }
  }

  // Store patterns
  memory.learnings.patterns = memory.learnings.patterns || [];

  for (const [type, stats] of Object.entries(byType)) {
    const total = stats.approved + stats.rejected;
    const approvalRate = stats.approved / total;

    // If high approval rate, could increase autonomy for this type
    if (approvalRate >= 0.8 && total >= 5) {
      const existingPattern = memory.learnings.patterns.find(p => p.type === type);
      if (!existingPattern) {
        memory.learnings.patterns.push({
          type,
          pattern: 'high_approval',
          approval_rate: approvalRate,
          sample_size: total,
          suggestion: 'Could auto-approve in future'
        });
      }
    }
  }
}

// =============================================================================
// ACTION EXECUTION
// =============================================================================

async function executeAction(action, data) {
  console.log(`[AUTONOMY] Executing action: ${action}`);

  switch (action) {
    case 'sendMorningBriefing':
      return await sendMorningBriefing();

    case 'send_line_alert':
      return await sendLineAlert(data.message);

    case 'adjust_price':
      // Queue for approval - don't auto-execute price changes
      return addToApprovalQueue({
        domain: 'hospitality',
        type: 'price_adjustment',
        message: data.message,
        data: data,
        suggested_action: null // Manual action needed
      });

    default:
      console.log(`[AUTONOMY] Unknown action: ${action}`);
      return null;
  }
}

// =============================================================================
// MONITORING FUNCTIONS
// =============================================================================

/**
 * Fetch gold price from API
 */
async function fetchGoldPrice() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.goldapi.io',
      path: '/XAU/THB',
      method: 'GET',
      headers: {
        'x-access-token': 'goldapi-placeholder' // Will use config
      },
      timeout: 10000
    };

    // Use fallback API
    const req = https.get('https://www.goldapi.io/api/XAU/THB', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({
            price: result.price,
            change: result.ch,
            change_percent: result.chp
          });
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Fetch BTC price and Fear & Greed
 */
async function fetchCryptoData() {
  return new Promise((resolve) => {
    // Fetch from CoinGecko
    https.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const price = JSON.parse(data);

          // Fetch Fear & Greed
          const fgResponse = await new Promise((fgResolve) => {
            https.get('https://api.alternative.me/fng/', (fgRes) => {
              let fgData = '';
              fgRes.on('data', chunk => fgData += chunk);
              fgRes.on('end', () => {
                try {
                  fgResolve(JSON.parse(fgData));
                } catch (e) {
                  fgResolve(null);
                }
              });
            }).on('error', () => fgResolve(null));
          });

          resolve({
            price: price.bitcoin.usd,
            change_percent: price.bitcoin.usd_24h_change,
            fear_greed: fgResponse?.data?.[0] || null
          });
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Fetch hotel status from Beds24
 */
async function fetchHotelStatus() {
  // Return null if beds24 module not available or no valid token
  if (!beds24 || !beds24Available || !beds24.getCheckInsToday) {
    console.log('[AUTONOMY] Beds24 module not available or not configured');
    return null;
  }

  try {
    // Wrap in Promise.allSettled to handle partial failures
    const results = await Promise.allSettled([
      beds24.getCheckInsToday(),
      beds24.getCheckOutsToday()
    ]);

    // Handle results
    const checkIns = results[0].status === 'fulfilled' ? results[0].value : [];
    const checkOuts = results[1].status === 'fulfilled' ? results[1].value : [];

    if (results.some(r => r.status === 'rejected')) {
      console.log('[AUTONOMY] Some Beds24 calls failed:', results.filter(r => r.status === 'rejected').map(r => r.reason?.message).join(', '));
    }

    // Calculate occupancy (simplified)
    const totalRooms = 14; // 6 + 4 + 3 + 1
    const occupiedRooms = Array.isArray(checkIns) ? checkIns.length : 0;

    return {
      check_ins: {
        count: Array.isArray(checkIns) ? checkIns.length : 0,
        guests: Array.isArray(checkIns) ? checkIns.map(b => b.guestFirstName || 'Guest') : []
      },
      check_outs: {
        count: Array.isArray(checkOuts) ? checkOuts.length : 0
      },
      occupancy: Math.round((occupiedRooms / totalRooms) * 100)
    };
  } catch (e) {
    console.log('[AUTONOMY] Hotel status error:', e.message);
    return null;
  }
}

// =============================================================================
// ALERT SYSTEM
// =============================================================================

async function sendLineAlert(message) {
  try {
    // Get owner ID from multiple sources
    const ownerId = lineConfig.line?.owner_id ||
                    sharedConfig.line?.owner_id ||
                    memorySync.config?.line?.owner_id ||
                    process.env.LINE_OWNER_ID;

    const token = lineConfig.line?.channel_token ||
                  sharedConfig.line?.channel_token ||
                  process.env.LINE_CHANNEL_TOKEN;

    if (!ownerId) {
      console.log('[AUTONOMY] No owner ID for LINE alert');
      return false;
    }

    // Use line module if available
    if (line && line.push) {
      await line.push(ownerId, message);
      console.log(`[AUTONOMY] LINE alert sent: ${message.substring(0, 50)}...`);
      return true;
    }

    // Fallback: Direct LINE API call
    if (!token) {
      console.log('[AUTONOMY] No LINE token for direct API');
      return false;
    }

    return new Promise((resolve) => {
      const data = JSON.stringify({
        to: ownerId,
        messages: [{ type: 'text', text: message.substring(0, 4500) }]
      });

      const options = {
        hostname: 'api.line.me',
        path: '/v2/bot/message/push',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          console.log(`[AUTONOMY] LINE alert sent: ${message.substring(0, 50)}...`);
          resolve(true);
        } else {
          console.log(`[AUTONOMY] LINE API error: ${res.statusCode}`);
          resolve(false);
        }
      });

      req.on('error', (e) => {
        console.error('[AUTONOMY] LINE alert error:', e.message);
        resolve(false);
      });

      req.write(data);
      req.end();
    });

  } catch (e) {
    console.error('[AUTONOMY] LINE alert error:', e.message);
    return false;
  }
}

// =============================================================================
// MORNING BRIEFING
// =============================================================================

async function sendMorningBriefing() {
  console.log('[AUTONOMY] Generating morning briefing...');

  try {
    const [crypto, hotel] = await Promise.all([
      fetchCryptoData(),
      fetchHotelStatus()
    ]);

    let briefing = `**Morning Briefing**\n\n`;

    // Crypto section
    if (crypto) {
      briefing += `**Investment**\n`;
      briefing += `- BTC: $${crypto.price?.toLocaleString() || 'N/A'} `;
      briefing += `(${crypto.change_percent > 0 ? '+' : ''}${crypto.change_percent?.toFixed(2) || 0}%)\n`;

      if (crypto.fear_greed) {
        briefing += `- Fear & Greed: ${crypto.fear_greed.value} (${crypto.fear_greed.value_classification})\n`;
      }
      briefing += `\n`;
    }

    // Hotel section
    if (hotel) {
      briefing += `**Hotel**\n`;
      if (hotel.check_ins.count > 0) {
        briefing += `- Check-in: ${hotel.check_ins.count} (${hotel.check_ins.guests.join(', ')})\n`;
      } else {
        briefing += `- Check-in: ไม่มี\n`;
      }
      briefing += `- Check-out: ${hotel.check_outs.count}\n`;
      briefing += `\n`;
    }

    // Recommendations
    briefing += `**Analysis**\n`;

    if (crypto?.fear_greed?.value <= 25) {
      briefing += `- Extreme Fear = โอกาสซื้อ BTC?\n`;
    }

    if (hotel?.occupancy < 50) {
      briefing += `- Occupancy ต่ำ = ควรทำ promotion?\n`;
    }

    // Send via LINE
    await sendLineAlert(briefing);

    // Save to memory
    const memory = memorySync.getMemory();
    memory.context.last_briefing = {
      timestamp: new Date().toISOString(),
      data: { crypto, hotel }
    };
    memorySync.saveLocalMemory();

    console.log('[AUTONOMY] Morning briefing sent');
    return briefing;

  } catch (e) {
    console.error('[AUTONOMY] Morning briefing error:', e.message);
    return null;
  }
}

// =============================================================================
// MAIN MONITORING LOOP
// =============================================================================

let monitoringInterval = null;
let lastCheckData = {};

async function monitoringLoop() {
  console.log('[AUTONOMY] Running monitoring check...');

  try {
    // Fetch all data with error handling
    let crypto = null;
    let hotel = null;

    try {
      crypto = await fetchCryptoData();
    } catch (e) {
      console.log('[AUTONOMY] Crypto fetch error:', e.message);
    }

    try {
      hotel = await fetchHotelStatus();
    } catch (e) {
      console.log('[AUTONOMY] Hotel fetch error:', e.message);
    }

    // Check triggers

    // Crypto triggers
    if (crypto) {
      // BTC price change
      if (lastCheckData.btc_price && crypto.price) {
        const change = ((crypto.price - lastCheckData.btc_price) / lastCheckData.btc_price) * 100;
        if (Math.abs(change) >= 3) {
          const trigger = TRIGGERS.btc_price_change;
          const message = trigger.message({ price: crypto.price, change_percent: change });
          await sendLineAlert(message);
        }
      }
      lastCheckData.btc_price = crypto.price;

      // Fear & Greed extreme
      if (crypto.fear_greed) {
        const fg = crypto.fear_greed;
        if (fg.value !== lastCheckData.fear_greed_value) {
          if (fg.value <= 20 || fg.value >= 80) {
            const trigger = TRIGGERS.fear_greed_extreme;
            const message = trigger.message(fg);
            await sendLineAlert(message);
          }
        }
        lastCheckData.fear_greed_value = fg.value;
      }
    }

    // Hotel triggers
    if (hotel) {
      // Low occupancy
      if (hotel.occupancy < 50 && lastCheckData.occupancy >= 50) {
        const trigger = TRIGGERS.low_occupancy;
        const message = trigger.message({ occupancy: hotel.occupancy });
        addToApprovalQueue({
          domain: 'hospitality',
          type: 'low_occupancy_alert',
          message: message,
          data: hotel,
          suggested_action: 'create_promotion'
        });
        await sendLineAlert(message);
      }
      lastCheckData.occupancy = hotel.occupancy;
    }

    // Update memory with latest data
    const memory = memorySync.getMemory();
    memory.context.market_alerts = memory.context.market_alerts || [];
    memory.context.hotel_status = hotel || {};
    memory.context.last_monitor = new Date().toISOString();
    memorySync.saveLocalMemory();

  } catch (e) {
    console.error('[AUTONOMY] Monitoring error:', e.message);
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function initialize() {
  console.log('[AUTONOMY] Initializing Autonomy Engine...');

  // Load previous approval queue from memory
  const memory = memorySync.getMemory();
  if (memory.context.pending_approvals) {
    approvalQueue = memory.context.pending_approvals;
  }

  // Start monitoring loop (every 15 minutes)
  monitoringInterval = setInterval(monitoringLoop, 15 * 60 * 1000);

  // Run initial check
  setTimeout(monitoringLoop, 5000);

  console.log('[AUTONOMY] Autonomy Engine initialized');
  console.log('[AUTONOMY] Monitoring interval: 15 minutes');
  console.log(`[AUTONOMY] Goals loaded: ${Object.keys(GOALS).join(', ')}`);
  console.log(`[AUTONOMY] Triggers active: ${Object.keys(TRIGGERS).length}`);
}

function stop() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  console.log('[AUTONOMY] Stopped');
}

// =============================================================================
// PROACTIVE SUGGESTIONS
// =============================================================================

/**
 * Get proactive suggestions based on current context
 */
function getProactiveSuggestions() {
  const memory = memorySync.getMemory();
  const suggestions = [];

  // Check hotel occupancy
  if (memory.context.hotel_status?.occupancy < 50) {
    suggestions.push({
      domain: 'hospitality',
      type: 'low_occupancy',
      message: 'Occupancy ต่ำ ควรพิจารณา promotion',
      priority: 'medium'
    });
  }

  // Check if it's near high season
  const month = new Date().getMonth();
  if ((month === 11 || month === 0 || month === 1) && memory.context.hotel_status?.occupancy < 80) {
    suggestions.push({
      domain: 'hospitality',
      type: 'high_season_opportunity',
      message: 'ช่วง High Season แต่ occupancy ยังไม่เต็ม - โอกาสขึ้นราคา?',
      priority: 'high'
    });
  }

  // Check pending approvals
  const pending = getPendingApprovals();
  if (pending.length > 0) {
    suggestions.push({
      domain: 'system',
      type: 'pending_approvals',
      message: `มี ${pending.length} รายการรออนุมัติ`,
      priority: 'high'
    });
  }

  return suggestions;
}

/**
 * Get opportunity analysis for a topic
 */
function analyzeOpportunity(topic) {
  const analysis = {
    topic,
    timestamp: new Date().toISOString(),
    opportunities: []
  };

  // Hotel opportunity analysis
  if (topic.includes('hotel') || topic.includes('ที่พัก')) {
    analysis.opportunities.push({
      type: 'sublease',
      description: 'เช่าช่วงที่พักใหม่ Return 4-7x',
      action: 'Search Facebook group for deals'
    });
  }

  // SaaS opportunity analysis
  if (topic.includes('saas') || topic.includes('software')) {
    analysis.opportunities.push({
      type: 'build',
      description: 'Build SaaS product',
      requirements: ['Domain expertise', 'Clear problem', 'Paying customers']
    });
  }

  // Automation opportunity
  if (topic.includes('automation') || topic.includes('api')) {
    analysis.opportunities.push({
      type: 'service',
      description: 'ขายบริการ automation/integration',
      action: 'Package as service for businesses'
    });
  }

  return analysis;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  initialize,
  stop,

  // Goals & Triggers
  GOALS,
  TRIGGERS,

  // Monitoring
  monitoringLoop,
  sendMorningBriefing,
  fetchCryptoData,
  fetchHotelStatus,

  // Approval Queue
  addToApprovalQueue,
  processApproval,
  getPendingApprovals,

  // Learning
  learnFromDecision,

  // Proactive
  getProactiveSuggestions,
  analyzeOpportunity,

  // Alerts
  sendLineAlert
};
