/**
 * Daily Digest System
 *
 * สรุปให้ Tars ทุกวัน โดยไม่ต้องถาม
 *
 * Features:
 * - Morning briefing (7:00)
 * - Evening summary (18:00)
 * - Weekly recap (Sunday)
 * - Custom digest on demand
 *
 * Content:
 * - Calendar events
 * - Messages handled
 * - Bookings/Revenue
 * - Pending approvals
 * - Market updates
 * - AI suggestions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Digest types
 */
const DIGEST_TYPES = {
  MORNING: 'morning',
  EVENING: 'evening',
  WEEKLY: 'weekly',
  CUSTOM: 'custom'
};

/**
 * Section types
 */
const SECTIONS = {
  CALENDAR: 'calendar',
  MESSAGES: 'messages',
  BOOKINGS: 'bookings',
  REVENUE: 'revenue',
  APPROVALS: 'approvals',
  MARKET: 'market',
  REMINDERS: 'reminders',
  SUGGESTIONS: 'suggestions',
  WEATHER: 'weather',
  PRICING: 'pricing'
};

/**
 * Daily Digest System
 */
class DailyDigest {
  constructor(config = {}) {
    this.config = {
      storagePath: config.storagePath || path.join(__dirname, '..', 'data', 'digests.json'),
      timezone: config.timezone || 'Asia/Bangkok',
      morningHour: config.morningHour || 7,
      eveningHour: config.eveningHour || 18,
      ...config
    };

    // Data collectors (functions that return section data)
    this.collectors = new Map();

    // Generated digests history
    this.history = [];

    // Stats
    this.stats = {
      generated: 0,
      byType: {}
    };

    // Load history
    this._loadFromStorage();

    // Register default collectors
    this._registerDefaultCollectors();
  }

  /**
   * Register a data collector for a section
   * @param {string} section - Section name
   * @param {function} collector - async () => data
   */
  registerCollector(section, collector) {
    this.collectors.set(section, collector);
    console.log(`[DIGEST] Registered collector: ${section}`);
  }

  /**
   * Register default collectors
   */
  _registerDefaultCollectors() {
    // Calendar collector (placeholder - integrates with google-calendar.js)
    this.registerCollector(SECTIONS.CALENDAR, async () => {
      try {
        // Try to import google calendar
        const { default: calendar } = await import('./google-calendar.js');
        if (calendar.isConfigured()) {
          return await calendar.getDailySummary();
        }
      } catch (e) {}
      return { events: [], message: 'Calendar not configured' };
    });

    // Reminders collector (placeholder - integrates with reminder-system.js)
    this.registerCollector(SECTIONS.REMINDERS, async () => {
      try {
        const { default: reminders } = await import('./reminder-system.js');
        const upcoming = reminders.getUpcoming(24);
        return {
          count: upcoming.length,
          items: upcoming.slice(0, 5).map(r => ({
            message: r.message,
            time: r.timeFormatted
          }))
        };
      } catch (e) {}
      return { count: 0, items: [] };
    });

    // Messages collector (placeholder)
    this.registerCollector(SECTIONS.MESSAGES, async () => {
      return {
        received: 0,
        replied: 0,
        pending: 0,
        message: 'Message stats not available'
      };
    });

    // Approvals collector (placeholder - integrates with autonomy.js)
    this.registerCollector(SECTIONS.APPROVALS, async () => {
      try {
        const { default: autonomy } = await import('./autonomy.js');
        const pending = autonomy.getPendingApprovals?.() || [];
        return {
          count: pending.length,
          items: pending.slice(0, 5)
        };
      } catch (e) {}
      return { count: 0, items: [] };
    });

    // Pricing collector - daily pricing recommendations
    this.registerCollector(SECTIONS.PRICING, async () => {
      try {
        const { default: beds24 } = await import('./beds24.js');
        const { default: pricing } = await import('./pricing.js');

        // Get today and next 7 days
        const today = new Date();
        const recommendations = [];

        for (let i = 0; i < 7; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          const dayName = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][date.getDay()];

          // Get occupancy for this date
          let occupancy = 0;
          try {
            const occupancyData = await beds24.getRealOccupancy(dateStr);
            occupancy = occupancyData.occupancyPercent || 0;
          } catch (e) {
            // Default to 50% if can't get data
            occupancy = 50;
          }

          // Get pricing recommendation
          const priceRec = pricing.getDailyRecommendation(dateStr, occupancy);

          recommendations.push({
            date: dateStr,
            day: dayName,
            dayIndex: i,
            occupancy: Math.round(occupancy),
            avgPrice: priceRec.avgRecommendedPrice,
            strategy: priceRec.strategy,
            modifier: priceRec.modifier
          });
        }

        // Find days that need attention (low occupancy)
        const lowOccDays = recommendations.filter(r => r.occupancy < 50);
        const highOccDays = recommendations.filter(r => r.occupancy >= 80);

        return {
          recommendations,
          lowOccDays,
          highOccDays,
          summary: {
            avgOccupancy: Math.round(recommendations.reduce((a, r) => a + r.occupancy, 0) / recommendations.length),
            needsAttention: lowOccDays.length
          }
        };
      } catch (e) {
        console.error('[DIGEST] Pricing collector error:', e.message);
        return { error: e.message };
      }
    });
  }

  /**
   * Generate morning briefing
   */
  async generateMorning(options = {}) {
    const sections = [
      SECTIONS.CALENDAR,
      SECTIONS.REMINDERS,
      SECTIONS.PRICING,  // Daily pricing recommendations
      SECTIONS.APPROVALS
    ];

    return this.generate({
      type: DIGEST_TYPES.MORNING,
      sections,
      greeting: this._getMorningGreeting(),
      ...options
    });
  }

  /**
   * Generate evening summary
   */
  async generateEvening(options = {}) {
    const sections = [
      SECTIONS.MESSAGES,
      SECTIONS.BOOKINGS,
      SECTIONS.REVENUE,
      SECTIONS.SUGGESTIONS
    ];

    return this.generate({
      type: DIGEST_TYPES.EVENING,
      sections,
      greeting: this._getEveningGreeting(),
      ...options
    });
  }

  /**
   * Generate weekly recap
   */
  async generateWeekly(options = {}) {
    const sections = [
      SECTIONS.REVENUE,
      SECTIONS.BOOKINGS,
      SECTIONS.MESSAGES,
      SECTIONS.SUGGESTIONS
    ];

    return this.generate({
      type: DIGEST_TYPES.WEEKLY,
      sections,
      greeting: '📊 Weekly Recap',
      ...options
    });
  }

  /**
   * Generate digest
   * @param {object} options
   */
  async generate(options = {}) {
    const {
      type = DIGEST_TYPES.CUSTOM,
      sections = Object.values(SECTIONS),
      greeting = '',
      userId = 'owner',
      format = 'text' // text, markdown, json
    } = options;

    console.log(`[DIGEST] Generating ${type} digest...`);

    // Collect data from all sections
    const data = {};
    for (const section of sections) {
      const collector = this.collectors.get(section);
      if (collector) {
        try {
          data[section] = await collector();
        } catch (err) {
          console.error(`[DIGEST] Collector ${section} failed:`, err.message);
          data[section] = { error: err.message };
        }
      }
    }

    // Format output
    let output;
    switch (format) {
      case 'markdown':
        output = this._formatMarkdown(greeting, data, type);
        break;
      case 'json':
        output = { greeting, type, data, timestamp: new Date().toISOString() };
        break;
      default:
        output = this._formatText(greeting, data, type);
    }

    // Create digest record
    const digest = {
      id: `dig_${Date.now()}`,
      type,
      timestamp: new Date().toISOString(),
      userId,
      sections,
      data,
      output: typeof output === 'string' ? output : JSON.stringify(output)
    };

    // Store in history
    this.history.unshift(digest);
    if (this.history.length > 100) {
      this.history = this.history.slice(0, 100);
    }

    // Update stats
    this.stats.generated++;
    this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;

    this._saveToStorage();

    console.log(`[DIGEST] Generated ${type} digest (${digest.id})`);

    return {
      id: digest.id,
      type,
      output,
      data
    };
  }

  /**
   * Format as plain text
   */
  _formatText(greeting, data, type) {
    const lines = [];

    if (greeting) {
      lines.push(greeting);
      lines.push('');
    }

    // Calendar
    if (data.calendar) {
      if (data.calendar.events?.length > 0) {
        lines.push('📅 วันนี้:');
        for (const event of data.calendar.events.slice(0, 5)) {
          lines.push(`  • ${event.time} - ${event.title}`);
        }
        lines.push('');
      }
      if (data.calendar.nextEvent) {
        lines.push(`⏰ ถัดไป: ${data.calendar.nextEvent.title} (${data.calendar.nextEvent.startsIn})`);
        lines.push('');
      }
    }

    // Reminders
    if (data.reminders?.count > 0) {
      lines.push(`🔔 Reminders (${data.reminders.count}):`);
      for (const item of data.reminders.items) {
        lines.push(`  • ${item.time} - ${item.message}`);
      }
      lines.push('');
    }

    // Approvals
    if (data.approvals?.count > 0) {
      lines.push(`⚠️ รอ Approve (${data.approvals.count}):`);
      for (const item of data.approvals.items.slice(0, 3)) {
        lines.push(`  • ${item.action || item.message || item}`);
      }
      lines.push('');
    }

    // Pricing recommendations
    if (data.pricing?.recommendations) {
      const p = data.pricing;
      lines.push(`💰 ราคาแนะนำ 7 วัน (Avg Occ: ${p.summary.avgOccupancy}%):`);
      lines.push('');

      for (const rec of p.recommendations) {
        const occIcon = rec.occupancy >= 80 ? '🟢' : rec.occupancy >= 50 ? '🟡' : '🔴';
        const dateLabel = rec.dayIndex === 0 ? 'วันนี้' : rec.dayIndex === 1 ? 'พรุ่งนี้' : `${rec.date.slice(5)} (${rec.day})`;
        lines.push(`  ${occIcon} ${dateLabel}: ${rec.occupancy}% | ฿${rec.avgPrice.toLocaleString()} (${rec.strategy})`);
      }
      lines.push('');

      if (p.lowOccDays.length > 0) {
        lines.push(`⚠️ ${p.lowOccDays.length} วันที่ต้องลดราคา/ทำโปร`);
        lines.push('');
      }
    }

    // Messages
    if (data.messages && data.messages.received > 0) {
      lines.push(`💬 ข้อความ: รับ ${data.messages.received} / ตอบ ${data.messages.replied}`);
      if (data.messages.pending > 0) {
        lines.push(`   ⚠️ ค้าง ${data.messages.pending} ข้อความ`);
      }
      lines.push('');
    }

    // Revenue
    if (data.revenue) {
      lines.push(`💰 Revenue: ${data.revenue.total || 'N/A'}`);
      lines.push('');
    }

    // Suggestions
    if (data.suggestions?.length > 0) {
      lines.push('💡 Suggestions:');
      for (const suggestion of data.suggestions.slice(0, 3)) {
        lines.push(`  • ${suggestion}`);
      }
      lines.push('');
    }

    if (lines.length === 0 || (lines.length === 2 && lines[1] === '')) {
      lines.push('✅ ไม่มีอะไรต้องรายงาน');
    }

    return lines.join('\n').trim();
  }

  /**
   * Format as markdown
   */
  _formatMarkdown(greeting, data, type) {
    const lines = [];

    if (greeting) {
      lines.push(`# ${greeting}`);
      lines.push('');
    }

    lines.push(`*${new Date().toLocaleDateString('th-TH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}*`);
    lines.push('');

    // Calendar
    if (data.calendar?.events?.length > 0) {
      lines.push('## 📅 Calendar');
      lines.push('');
      for (const event of data.calendar.events) {
        lines.push(`- **${event.time}** - ${event.title}`);
      }
      lines.push('');
    }

    // Reminders
    if (data.reminders?.count > 0) {
      lines.push('## 🔔 Reminders');
      lines.push('');
      for (const item of data.reminders.items) {
        lines.push(`- ${item.time} - ${item.message}`);
      }
      lines.push('');
    }

    // Approvals
    if (data.approvals?.count > 0) {
      lines.push('## ⚠️ Pending Approvals');
      lines.push('');
      for (const item of data.approvals.items) {
        lines.push(`- ${item.action || item.message || item}`);
      }
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  /**
   * Get morning greeting
   */
  _getMorningGreeting() {
    const hour = new Date().getHours();
    const day = new Date().toLocaleDateString('th-TH', { weekday: 'long' });

    if (hour < 12) {
      return `☀️ สวัสดีตอนเช้า (${day})`;
    }
    return `🌤️ สวัสดีตอนบ่าย (${day})`;
  }

  /**
   * Get evening greeting
   */
  _getEveningGreeting() {
    return '🌙 สรุปวันนี้';
  }

  /**
   * Get recent digests
   */
  getRecent(limit = 10) {
    return this.history.slice(0, limit);
  }

  /**
   * Get digest by ID
   */
  get(id) {
    return this.history.find(d => d.id === id);
  }

  /**
   * Get statistics
   */
  getStats() {
    return this.stats;
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      collectors: Array.from(this.collectors.keys()),
      historyCount: this.history.length,
      stats: this.stats
    };
  }

  /**
   * Load from storage
   */
  _loadFromStorage() {
    try {
      if (fs.existsSync(this.config.storagePath)) {
        const data = JSON.parse(fs.readFileSync(this.config.storagePath, 'utf8'));
        this.history = data.history || [];
        this.stats = data.stats || this.stats;
      }
    } catch (err) {
      console.error('[DIGEST] Failed to load from storage:', err.message);
    }
  }

  /**
   * Save to storage
   */
  _saveToStorage() {
    try {
      const dir = path.dirname(this.config.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.config.storagePath, JSON.stringify({
        history: this.history,
        stats: this.stats,
        lastUpdated: new Date().toISOString()
      }, null, 2));
    } catch (err) {
      console.error('[DIGEST] Failed to save to storage:', err.message);
    }
  }

  /**
   * Clear history
   */
  clear() {
    this.history = [];
    this._saveToStorage();
  }
}

// Singleton instance
const dailyDigest = new DailyDigest();

export default dailyDigest;
export { DailyDigest, DIGEST_TYPES, SECTIONS };
