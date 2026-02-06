/**
 * Oracle Heartbeat System v4.0
 * AI ตื่นมาเองทุก X นาที + ดึงข้อมูลจริง + Goal Tracking + Auto-Actions
 *
 * v4.0 Changes:
 * - Added Goal Tracker integration
 * - Reminds about stale/pending goals
 * - Proactive task suggestions
 * - Auto-execute simple tasks when possible
 *
 * v3.0 Changes:
 * - Fetch REAL data from Beds24 API before analysis
 * - No more hallucinated data (12345, John Doe)
 * - Skip AI call if no actionable data
 * - Data-driven alerts only
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
// Use claude.js with failover instead of direct Anthropic
import claude from './claude.js';

// Import Beds24 API functions
import {
  getCheckInsToday,
  getCheckOutsToday,
  getAllActiveBookings,
  getOccupancyForDate
} from './beds24.js';

// Import Goal Tracker
import { runGoalCheck, touchGoal, formatGoalReminder } from './goal-tracker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEARTBEAT_FILE = join(__dirname, '../HEARTBEAT.md');

// Config defaults
const DEFAULT_CONFIG = {
  enabled: true,
  every: '30m',           // Interval
  model: 'claude-3-haiku-20240307',  // Cheap model for heartbeat
  activeHours: { start: 8, end: 22 },
  ackMaxChars: 300,       // Max chars to consider as HEARTBEAT_OK
  skipIfBusy: true
};

class HeartbeatManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.timer = null;
    this.isRunning = false;
    this.mainQueueBusy = false;
    this.lastRun = null;
    this.notifiedBookings = new Set(); // Track notified booking IDs
    this.onNotify = null; // Callback for notifications
    // Uses claude.js with failover (no direct Anthropic client needed)
  }

  /**
   * Parse interval string to milliseconds
   */
  parseInterval(interval) {
    const match = interval.match(/^(\d+)(m|h|s)$/);
    if (!match) return 30 * 60 * 1000; // Default 30 minutes

    const [, num, unit] = match;
    const multipliers = { s: 1000, m: 60000, h: 3600000 };
    return parseInt(num) * multipliers[unit];
  }

  /**
   * Check if within active hours
   */
  isActiveHours() {
    if (!this.config.activeHours) return true;

    const now = new Date();
    const hour = now.getHours();
    const { start, end } = this.config.activeHours;

    return hour >= start && hour < end;
  }

  /**
   * Read HEARTBEAT.md file (for reference only)
   */
  readHeartbeatFile() {
    if (!existsSync(HEARTBEAT_FILE)) {
      return null;
    }

    try {
      return readFileSync(HEARTBEAT_FILE, 'utf-8');
    } catch (error) {
      console.error('[HEARTBEAT] Failed to read HEARTBEAT.md:', error.message);
      return null;
    }
  }

  /**
   * Check if response indicates nothing urgent (HEARTBEAT_OK)
   */
  isHeartbeatOk(response) {
    if (!response) return true;

    const text = response.trim();

    // Check if contains HEARTBEAT_OK
    if (text.includes('HEARTBEAT_OK')) {
      const remaining = text.replace(/HEARTBEAT_OK/g, '').trim();
      return remaining.length <= this.config.ackMaxChars;
    }

    return false;
  }

  /**
   * Fetch REAL data from Beds24 API + Goals from Supabase
   * Returns structured data for analysis
   */
  async fetchRealData() {
    console.log('[HEARTBEAT] Fetching real data from Beds24 API + Goals...');

    const data = {
      checkIns: [],
      checkOuts: [],
      recentBookings: [],
      occupancy: null,
      goals: null,  // NEW: Goal tracking data
      errors: []
    };

    const today = new Date().toISOString().split('T')[0];
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    try {
      // 1. Get today's check-ins
      const checkIns = await getCheckInsToday();
      if (!checkIns.error) {
        data.checkIns = checkIns;
        console.log(`[HEARTBEAT] Found ${checkIns.length} check-ins today`);
      } else {
        data.errors.push(`Check-ins: ${checkIns.error}`);
      }
    } catch (e) {
      data.errors.push(`Check-ins error: ${e.message}`);
    }

    try {
      // 2. Get today's check-outs
      const checkOuts = await getCheckOutsToday();
      if (!checkOuts.error) {
        data.checkOuts = checkOuts;
        console.log(`[HEARTBEAT] Found ${checkOuts.length} check-outs today`);
      } else {
        data.errors.push(`Check-outs: ${checkOuts.error}`);
      }
    } catch (e) {
      data.errors.push(`Check-outs error: ${e.message}`);
    }

    try {
      // 3. Get recent bookings (filter for new ones)
      const allBookings = await getAllActiveBookings();
      if (!allBookings.error) {
        // Filter bookings created in last 30 minutes
        data.recentBookings = allBookings.filter(b => {
          const createdAt = new Date(b.bookingTime || b.createdAt || 0);
          return createdAt >= thirtyMinutesAgo;
        });
        console.log(`[HEARTBEAT] Found ${data.recentBookings.length} new bookings in last 30min`);
      } else {
        data.errors.push(`Bookings: ${allBookings.error}`);
      }
    } catch (e) {
      data.errors.push(`Bookings error: ${e.message}`);
    }

    try {
      // 4. Get today's occupancy
      const occupancy = await getOccupancyForDate(today);
      if (!occupancy.error) {
        data.occupancy = occupancy;
        console.log(`[HEARTBEAT] Occupancy: ${occupancy.occupied}/${occupancy.totalRooms}`);
      }
    } catch (e) {
      data.errors.push(`Occupancy error: ${e.message}`);
    }

    try {
      // 5. NEW: Get goals from Supabase
      const goalResult = await runGoalCheck('tars');
      data.goals = goalResult;
      console.log(`[HEARTBEAT] Goals: ${goalResult.activeGoals} active, ${goalResult.staleGoals} stale`);
    } catch (e) {
      console.log(`[HEARTBEAT] Goal check skipped: ${e.message}`);
      data.goals = null;
    }

    return data;
  }

  /**
   * Check if there's anything actionable in the data
   */
  hasActionableData(data) {
    // New bookings that haven't been notified yet
    const newBookings = data.recentBookings.filter(b => !this.notifiedBookings.has(b.id));

    // Check-ins that need preparation
    const pendingCheckIns = data.checkIns.filter(b => {
      // You could add more logic here to check if room is prepared
      return true;
    });

    // NEW: Check for stale goals that need reminder
    const hasStaleGoals = data.goals?.staleGoals > 0;

    return (
      newBookings.length > 0 ||
      pendingCheckIns.length > 0 ||
      data.checkOuts.length > 0 ||
      hasStaleGoals  // NEW: Include stale goals
    );
  }

  /**
   * Build prompt with REAL data
   */
  buildPromptWithRealData(data) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
    const timeStr = now.toLocaleTimeString('th-TH', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Format booking data for prompt
    const formatBooking = (b) => {
      return `  - ID: ${b.id}, Guest: ${b.guestName || `${b.firstName} ${b.lastName}`.trim()}, Room: ${b.roomSystemId || b.roomId}, Arrival: ${b.arrival}, Departure: ${b.departure}`;
    };

    let dataSection = '## ข้อมูลจาก Beds24 API (ข้อมูลจริง)\n\n';

    // New bookings
    if (data.recentBookings.length > 0) {
      const newBookings = data.recentBookings.filter(b => !this.notifiedBookings.has(b.id));
      if (newBookings.length > 0) {
        dataSection += `### Booking ใหม่ (30 นาทีที่ผ่านมา): ${newBookings.length} รายการ\n`;
        newBookings.forEach(b => {
          dataSection += formatBooking(b) + '\n';
        });
        dataSection += '\n';
      }
    }

    // Today's check-ins
    if (data.checkIns.length > 0) {
      dataSection += `### Check-in วันนี้: ${data.checkIns.length} รายการ\n`;
      data.checkIns.forEach(b => {
        dataSection += formatBooking(b) + '\n';
      });
      dataSection += '\n';
    }

    // Today's check-outs
    if (data.checkOuts.length > 0) {
      dataSection += `### Check-out วันนี้: ${data.checkOuts.length} รายการ\n`;
      data.checkOuts.forEach(b => {
        dataSection += formatBooking(b) + '\n';
      });
      dataSection += '\n';
    }

    // Occupancy
    if (data.occupancy) {
      dataSection += `### Occupancy วันนี้\n`;
      dataSection += `  - ห้องเต็ม: ${data.occupancy.occupied}/${data.occupancy.totalRooms}\n`;
      dataSection += `  - ห้องว่าง: ${data.occupancy.available}\n`;
      dataSection += `  - อัตรา: ${data.occupancy.occupancyRate}%\n\n`;
    }

    // Handle no data case
    if (data.recentBookings.length === 0 && data.checkIns.length === 0 && data.checkOuts.length === 0) {
      dataSection += `### ไม่มีข้อมูลใหม่\n`;
      dataSection += `- ไม่มี booking ใหม่ในช่วง 30 นาทีที่ผ่านมา\n`;
      dataSection += `- ไม่มี check-in/check-out วันนี้\n\n`;
    }

    // NEW: Goals section
    if (data.goals) {
      dataSection += `### 🎯 เป้าหมายและ Tasks\n`;
      dataSection += `- Active goals: ${data.goals.activeGoals}\n`;
      dataSection += `- API integration goals: ${data.goals.apiGoals}\n`;
      dataSection += `- Stale goals (ต้องเตือน): ${data.goals.staleGoals}\n`;

      if (data.goals.topGoals?.length > 0) {
        dataSection += `\n**Top Priority Goals:**\n`;
        data.goals.topGoals.forEach((g, i) => {
          dataSection += `${i + 1}. ${g.content.substring(0, 100)}... (priority: ${g.priority})\n`;
        });
      }

      if (data.goals.reminder) {
        dataSection += `\n${data.goals.reminder}\n`;
      }
      dataSection += '\n';
    }

    return `You are Oracle, a proactive AI assistant for Tars (hotel operator).

## เวลาปัจจุบัน
**${dateStr}**
**เวลา ${timeStr}**
**ปี ${now.getFullYear()}** (พ.ศ. ${now.getFullYear() + 543})

${dataSection}

## คำแนะนำ
1. วิเคราะห์ข้อมูลด้านบน (ข้อมูลจริงจาก Beds24 API + Goals)
2. ถ้ามี booking ใหม่ → แจ้ง Tars พร้อมรายละเอียด
3. ถ้ามี check-in วันนี้ → เตือนให้เตรียมห้อง
4. ถ้ามี stale goals → เตือนให้ Tars ทำ
5. ถ้ามี API goals ที่รอทำ → แนะนำให้เริ่ม
6. ถ้าไม่มีอะไรต้องทำ → ตอบ HEARTBEAT_OK

## กฎสำคัญ
✅ ใช้เฉพาะข้อมูลที่แสดงด้านบนเท่านั้น
❌ ห้ามแต่งข้อมูลเพิ่ม (ห้ามใส่ ID ปลอม, ชื่อปลอม)
❌ ถ้าไม่มีข้อมูลในส่วนไหน → ข้ามส่วนนั้นไป

## Format การตอบ

ถ้ามีเรื่องสำคัญ:
🔔 Oracle Alert

[สรุปสั้นๆ]

รายละเอียด:
- [ใช้ข้อมูลจริงจากด้านบนเท่านั้น]

แนะนำ:
- [action ที่ควรทำ]

ถ้าไม่มีอะไร:
HEARTBEAT_OK`;
  }

  /**
   * Run heartbeat check with REAL DATA
   */
  async runHeartbeat() {
    if (this.isRunning) {
      console.log('[HEARTBEAT] Already running, skipping...');
      return null;
    }

    if (this.config.skipIfBusy && this.mainQueueBusy) {
      console.log('[HEARTBEAT] Main queue busy, skipping...');
      return null;
    }

    if (!this.isActiveHours()) {
      console.log('[HEARTBEAT] Outside active hours, skipping...');
      return null;
    }

    this.isRunning = true;
    console.log('[HEARTBEAT] Running heartbeat check with real data...');

    try {
      // Step 1: Fetch REAL data from Beds24 API
      const realData = await this.fetchRealData();

      // Step 2: Check if there's anything actionable
      if (!this.hasActionableData(realData)) {
        console.log('[HEARTBEAT] No actionable data, skipping AI call');
        this.lastRun = new Date();
        return { status: 'ok', message: 'HEARTBEAT_OK (no data)' };
      }

      // Step 3: Build prompt with real data
      const prompt = this.buildPromptWithRealData(realData);

      // Step 4: Call Claude with failover (uses claude.js)
      const responseText = await claude.chat(
        [{ role: 'user', content: prompt }],
        { model: 'claude-3-haiku-20240307', max_tokens: 1024 }
      );
      console.log('[HEARTBEAT] Response:', responseText.substring(0, 100) + '...');

      // Step 5: Check if HEARTBEAT_OK
      if (this.isHeartbeatOk(responseText)) {
        console.log('[HEARTBEAT] Nothing urgent - HEARTBEAT_OK');
        this.lastRun = new Date();
        return { status: 'ok', message: 'HEARTBEAT_OK' };
      }

      // Step 6: Mark notified bookings
      realData.recentBookings.forEach(b => {
        if (b.id) this.notifiedBookings.add(b.id);
      });

      // Step 7: Notify user
      console.log('[HEARTBEAT] Alert detected, notifying...');

      if (this.onNotify) {
        await this.onNotify(responseText);
      }

      this.lastRun = new Date();
      return { status: 'alert', message: responseText };

    } catch (error) {
      console.error('[HEARTBEAT] Error:', error.message);
      return { status: 'error', message: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start heartbeat timer
   */
  start() {
    if (!this.config.enabled) {
      console.log('[HEARTBEAT] Disabled in config');
      return;
    }

    const intervalMs = this.parseInterval(this.config.every);
    console.log(`[HEARTBEAT] Starting v4.0 (Real Data + Goals) with interval: ${this.config.every} (${intervalMs}ms)`);
    console.log(`[HEARTBEAT] Active hours: ${this.config.activeHours.start}:00 - ${this.config.activeHours.end}:00`);
    console.log(`[HEARTBEAT] Model: ${this.config.model}`);

    // Run immediately on start
    this.runHeartbeat();

    // Set up interval
    this.timer = setInterval(() => this.runHeartbeat(), intervalMs);
  }

  /**
   * Stop heartbeat timer
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[HEARTBEAT] Stopped');
    }
  }

  /**
   * Set main queue busy status
   */
  setQueueBusy(busy) {
    this.mainQueueBusy = busy;
  }

  /**
   * Set notification callback
   */
  setNotifyCallback(callback) {
    this.onNotify = callback;
  }

  /**
   * Manual trigger (for testing or CLI)
   */
  async trigger() {
    console.log('[HEARTBEAT] Manual trigger...');
    return await this.runHeartbeat();
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      running: !!this.timer,
      lastRun: this.lastRun,
      interval: this.config.every,
      activeHours: this.config.activeHours,
      model: this.config.model,
      isActiveNow: this.isActiveHours(),
      queueBusy: this.mainQueueBusy,
      notifiedCount: this.notifiedBookings.size,
      version: '4.0'
    };
  }

  /**
   * Clear notified bookings (for testing)
   */
  clearNotified() {
    this.notifiedBookings.clear();
    console.log('[HEARTBEAT] Cleared notified bookings');
  }
}

// Legacy exports for backward compatibility
import https from 'https';
import http from 'http';

/**
 * Fetch market data (Gold, BTC, Fear & Greed)
 */
async function fetchMarketData() {
  const data = {
    gold: null,
    btc: null,
    fearGreed: null
  };

  try {
    const fgResponse = await fetchJSON('https://api.alternative.me/fng/?limit=1');
    if (fgResponse?.data?.[0]) {
      data.fearGreed = {
        value: fgResponse.data[0].value,
        text: fgResponse.data[0].value_classification
      };
    }
  } catch (e) {
    console.error('[HEARTBEAT] Failed to fetch Fear & Greed:', e.message);
  }

  try {
    const btcResponse = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
    if (btcResponse?.bitcoin) {
      data.btc = {
        price: btcResponse.bitcoin.usd,
        change: btcResponse.bitcoin.usd_24h_change?.toFixed(2)
      };
    }
  } catch (e) {
    console.error('[HEARTBEAT] Failed to fetch BTC:', e.message);
  }

  try {
    const goldResponse = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd&include_24hr_change=true');
    if (goldResponse?.['tether-gold']) {
      data.gold = {
        price: goldResponse['tether-gold'].usd,
        change: goldResponse['tether-gold'].usd_24h_change?.toFixed(2)
      };
    }
  } catch (e) {
    console.error('[HEARTBEAT] Failed to fetch Gold:', e.message);
  }

  return data;
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Export HeartbeatManager as default
export default HeartbeatManager;

// Named exports for legacy compatibility
export { HeartbeatManager, fetchMarketData };
