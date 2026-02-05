/**
 * Oracle Heartbeat System v2.0
 * AI ตื่นมาเองทุก X นาที + ตัดสินใจว่าจะแจ้งหรือไม่
 *
 * Features:
 * - Periodic tick (default 30m)
 * - HEARTBEAT.md checklist
 * - HEARTBEAT_OK protocol (silent when nothing urgent)
 * - Active hours (08:00-22:00)
 * - Model override (Haiku for heartbeat)
 * - Queue priority (user messages first)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

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
    this.notifiedItems = new Map(); // Track what we've notified to avoid duplicates
    this.onNotify = null; // Callback for notifications

    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
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
   * Read HEARTBEAT.md file
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
   * Check if file content is effectively empty
   */
  isEffectivelyEmpty(content) {
    if (!content) return true;

    // Remove comments, headers, and whitespace
    const stripped = content
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed &&
               !trimmed.startsWith('#') &&
               !trimmed.startsWith('//') &&
               !trimmed.startsWith('---') &&
               !trimmed.startsWith('*');
      })
      .join('')
      .trim();

    return stripped.length === 0;
  }

  /**
   * Check if response indicates nothing urgent (HEARTBEAT_OK)
   */
  isHeartbeatOk(response) {
    if (!response) return true;

    const text = response.trim();

    // Check if starts or ends with HEARTBEAT_OK
    if (text.includes('HEARTBEAT_OK')) {
      const remaining = text.replace(/HEARTBEAT_OK/g, '').trim();
      return remaining.length <= this.config.ackMaxChars;
    }

    return false;
  }

  /**
   * Build prompt for heartbeat
   */
  buildPrompt(heartbeatContent) {
    const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

    return `You are Oracle, a proactive AI assistant for Tars.

Current time: ${now}

Read the following HEARTBEAT.md checklist and determine if there's anything that needs Tars's attention.

---
${heartbeatContent}
---

CRITICAL RULES:
🚫 ห้ามแต่งข้อมูลขึ้นมาเอง - ใช้เฉพาะข้อมูลที่มีใน checklist เท่านั้น
🚫 ถ้าไม่มี booking ID จริง → อย่าใส่ตัวเลขมั่ว (เช่น 12345)
🚫 ถ้าไม่มีชื่อแขกจริง → อย่าใส่ "John Doe" หรือชื่อปลอม
🚫 ถ้าไม่มีข้อมูลเพียงพอ → ตอบ HEARTBEAT_OK

Instructions:
1. Go through each check in the checklist
2. ONLY report items that have REAL data in the checklist
3. If data is missing or incomplete, skip that item
4. If nothing concrete needs attention, reply with just: HEARTBEAT_OK
5. Keep responses concise - Tars is busy

Response format for alerts (ONLY if real data exists):
🔔 Oracle Alert

[Brief summary based on ACTUAL data]

Details:
- [Only include real data from checklist]

Recommended action:
- ...

If nothing urgent OR no real data: HEARTBEAT_OK`;
  }

  /**
   * Run heartbeat check
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
    console.log('[HEARTBEAT] Running heartbeat check...');

    try {
      // Read HEARTBEAT.md
      const heartbeatContent = this.readHeartbeatFile();

      if (!heartbeatContent || this.isEffectivelyEmpty(heartbeatContent)) {
        console.log('[HEARTBEAT] HEARTBEAT.md empty, skipping API call');
        return null;
      }

      // Build prompt
      const prompt = this.buildPrompt(heartbeatContent);

      // Call Claude (Haiku for cost efficiency)
      const response = await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });

      const responseText = response.content[0]?.text || '';
      console.log('[HEARTBEAT] Response:', responseText.substring(0, 100) + '...');

      // Check if HEARTBEAT_OK
      if (this.isHeartbeatOk(responseText)) {
        console.log('[HEARTBEAT] Nothing urgent - HEARTBEAT_OK');
        this.lastRun = new Date();
        return { status: 'ok', message: 'HEARTBEAT_OK' };
      }

      // Has content - notify user
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
    console.log(`[HEARTBEAT] Starting with interval: ${this.config.every} (${intervalMs}ms)`);
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
      queueBusy: this.mainQueueBusy
    };
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
