/**
 * Reminder System
 *
 * ระบบเตือนความจำ - ทำให้ Oracle เป็น proactive
 *
 * Features:
 * - Set reminders with natural language
 * - Recurring reminders (daily, weekly)
 * - Send via LINE/Telegram
 * - Snooze and cancel
 * - Priority levels
 *
 * Usage:
 * - "เตือนผม 5 โมงเย็น โทรหาลูกค้า"
 * - "พรุ่งนี้ 9 โมง check booking"
 * - "ทุกวันจันทร์ 10 โมง ประชุม"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reminder priorities
 */
const PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent'
};

/**
 * Recurrence patterns
 */
const RECURRENCE = {
  ONCE: 'once',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  WEEKDAYS: 'weekdays'  // จันทร์-ศุกร์
};

/**
 * Reminder status
 */
const STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  SNOOZED: 'snoozed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
};

/**
 * Reminder System Class
 */
class ReminderSystem {
  constructor(config = {}) {
    this.config = {
      storagePath: config.storagePath || path.join(__dirname, '..', 'data', 'reminders.json'),
      checkInterval: config.checkInterval || 60000, // Check every minute
      defaultSnooze: config.defaultSnooze || 10, // 10 minutes
      maxReminders: config.maxReminders || 1000,
      timezone: config.timezone || 'Asia/Bangkok',
      ...config
    };

    // In-memory store
    this.reminders = [];

    // Notification callback
    this.notifyCallback = null;

    // Check interval
    this.intervalId = null;

    // Stats
    this.stats = {
      total: 0,
      sent: 0,
      snoozed: 0,
      cancelled: 0
    };

    // Load from storage
    this._loadFromStorage();

    // Start checker
    this._startChecker();
  }

  /**
   * Set notification callback
   * @param {function} callback - (reminder) => Promise<void>
   */
  setNotifyCallback(callback) {
    this.notifyCallback = callback;
  }

  /**
   * Add a reminder
   * @param {object} options
   */
  add(options) {
    const {
      userId,
      message,
      time,              // Date object or timestamp
      channel = 'line',  // line, telegram
      priority = PRIORITY.NORMAL,
      recurrence = RECURRENCE.ONCE,
      metadata = {}
    } = options;

    const reminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId,
      message,
      time: new Date(time).getTime(),
      timeFormatted: new Date(time).toLocaleString('th-TH', { timeZone: this.config.timezone }),
      channel,
      priority,
      recurrence,
      status: STATUS.PENDING,
      metadata,
      createdAt: Date.now(),
      sentAt: null,
      snoozeCount: 0
    };

    this.reminders.push(reminder);
    this.stats.total++;

    // Sort by time
    this.reminders.sort((a, b) => a.time - b.time);

    // Trim if too many
    if (this.reminders.length > this.config.maxReminders) {
      // Remove old completed/cancelled
      this.reminders = this.reminders.filter(r =>
        r.status === STATUS.PENDING || r.status === STATUS.SNOOZED
      ).slice(0, this.config.maxReminders);
    }

    this._saveToStorage();

    console.log(`[REMINDER] Added: "${message}" at ${reminder.timeFormatted} for ${userId}`);

    return reminder;
  }

  /**
   * Parse natural language time (Thai + English)
   * @param {string} text - Natural language time
   * @returns {Date|null}
   */
  parseTime(text) {
    const now = new Date();
    const textLower = text.toLowerCase();

    // Relative time patterns
    // "ใน 5 นาที", "in 5 minutes"
    const minutesMatch = textLower.match(/(?:ใน|in)\s*(\d+)\s*(?:นาที|minute|min)/);
    if (minutesMatch) {
      return new Date(now.getTime() + parseInt(minutesMatch[1]) * 60 * 1000);
    }

    // "ใน 2 ชั่วโมง", "in 2 hours"
    const hoursMatch = textLower.match(/(?:ใน|in)\s*(\d+)\s*(?:ชั่วโมง|hour|hr)/);
    if (hoursMatch) {
      return new Date(now.getTime() + parseInt(hoursMatch[1]) * 60 * 60 * 1000);
    }

    // "พรุ่งนี้", "tomorrow"
    if (textLower.includes('พรุ่งนี้') || textLower.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Extract time if specified
      const timeMatch = textLower.match(/(\d{1,2})[:.:]?(\d{2})?\s*(?:น\.|โมง|am|pm)?/);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2] || '0');

        // Handle PM
        if (textLower.includes('pm') || textLower.includes('เย็น') || textLower.includes('บ่าย')) {
          if (hours < 12) hours += 12;
        }
        // Thai time (บ่าย 2 = 14:00)
        if (textLower.includes('บ่าย') && hours < 12) {
          hours += 12;
        }

        tomorrow.setHours(hours, minutes, 0, 0);
      } else {
        tomorrow.setHours(9, 0, 0, 0); // Default 9 AM
      }

      return tomorrow;
    }

    // "วันนี้", "today"
    if (textLower.includes('วันนี้') || textLower.includes('today')) {
      const today = new Date(now);

      const timeMatch = textLower.match(/(\d{1,2})[:.:]?(\d{2})?\s*(?:น\.|โมง|am|pm)?/);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2] || '0');

        if (textLower.includes('pm') || textLower.includes('เย็น') || textLower.includes('บ่าย')) {
          if (hours < 12) hours += 12;
        }
        if (textLower.includes('บ่าย') && hours < 12) {
          hours += 12;
        }

        today.setHours(hours, minutes, 0, 0);
      }

      return today;
    }

    // Thai time format "5 โมงเย็น", "9 โมงเช้า"
    const thaiTimeMatch = textLower.match(/(\d{1,2})\s*(?:โมง|น\.)\s*(?:(เช้า|บ่าย|เย็น|ค่ำ))?/);
    if (thaiTimeMatch) {
      let hours = parseInt(thaiTimeMatch[1]);
      const period = thaiTimeMatch[2];

      if (period === 'เย็น' || period === 'บ่าย') {
        if (hours < 12) hours += 12;
      } else if (period === 'ค่ำ') {
        if (hours < 12) hours += 12;
      }

      const result = new Date(now);
      result.setHours(hours, 0, 0, 0);

      // If time has passed today, assume tomorrow
      if (result <= now) {
        result.setDate(result.getDate() + 1);
      }

      return result;
    }

    // Standard time format "14:30", "2:30 PM"
    const standardTimeMatch = textLower.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
    if (standardTimeMatch) {
      let hours = parseInt(standardTimeMatch[1]);
      const minutes = parseInt(standardTimeMatch[2]);
      const ampm = standardTimeMatch[3];

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      const result = new Date(now);
      result.setHours(hours, minutes, 0, 0);

      if (result <= now) {
        result.setDate(result.getDate() + 1);
      }

      return result;
    }

    return null;
  }

  /**
   * Parse recurrence from text
   */
  parseRecurrence(text) {
    const textLower = text.toLowerCase();

    if (textLower.includes('ทุกวัน') || textLower.includes('daily') || textLower.includes('every day')) {
      return RECURRENCE.DAILY;
    }
    if (textLower.includes('ทุกสัปดาห์') || textLower.includes('weekly') || textLower.includes('every week')) {
      return RECURRENCE.WEEKLY;
    }
    if (textLower.includes('ทุกเดือน') || textLower.includes('monthly') || textLower.includes('every month')) {
      return RECURRENCE.MONTHLY;
    }
    if (textLower.includes('วันทำงาน') || textLower.includes('weekday')) {
      return RECURRENCE.WEEKDAYS;
    }

    return RECURRENCE.ONCE;
  }

  /**
   * Get reminder by ID
   */
  get(id) {
    return this.reminders.find(r => r.id === id);
  }

  /**
   * Get reminders for a user
   */
  getForUser(userId, status = null) {
    let results = this.reminders.filter(r => r.userId === userId);
    if (status) {
      results = results.filter(r => r.status === status);
    }
    return results;
  }

  /**
   * Get pending reminders
   */
  getPending() {
    return this.reminders.filter(r =>
      r.status === STATUS.PENDING || r.status === STATUS.SNOOZED
    );
  }

  /**
   * Get upcoming reminders (next N hours)
   */
  getUpcoming(hours = 24) {
    const now = Date.now();
    const future = now + hours * 60 * 60 * 1000;

    return this.reminders.filter(r =>
      (r.status === STATUS.PENDING || r.status === STATUS.SNOOZED) &&
      r.time >= now &&
      r.time <= future
    );
  }

  /**
   * Snooze a reminder
   */
  snooze(id, minutes = null) {
    const reminder = this.get(id);
    if (!reminder) return null;

    const snoozeMinutes = minutes || this.config.defaultSnooze;
    reminder.time = Date.now() + snoozeMinutes * 60 * 1000;
    reminder.timeFormatted = new Date(reminder.time).toLocaleString('th-TH', { timeZone: this.config.timezone });
    reminder.status = STATUS.SNOOZED;
    reminder.snoozeCount++;

    this._saveToStorage();

    console.log(`[REMINDER] Snoozed: ${id} for ${snoozeMinutes} minutes`);

    return reminder;
  }

  /**
   * Cancel a reminder
   */
  cancel(id) {
    const reminder = this.get(id);
    if (!reminder) return false;

    reminder.status = STATUS.CANCELLED;
    this.stats.cancelled++;
    this._saveToStorage();

    console.log(`[REMINDER] Cancelled: ${id}`);

    return true;
  }

  /**
   * Mark as completed
   */
  complete(id) {
    const reminder = this.get(id);
    if (!reminder) return false;

    reminder.status = STATUS.COMPLETED;
    this._saveToStorage();

    return true;
  }

  /**
   * Check and send due reminders
   */
  async checkAndSend() {
    const now = Date.now();
    const dueReminders = this.reminders.filter(r =>
      (r.status === STATUS.PENDING || r.status === STATUS.SNOOZED) &&
      r.time <= now
    );

    for (const reminder of dueReminders) {
      try {
        // Send notification
        if (this.notifyCallback) {
          await this.notifyCallback(reminder);
        }

        reminder.status = STATUS.SENT;
        reminder.sentAt = now;
        this.stats.sent++;

        console.log(`[REMINDER] Sent: "${reminder.message}" to ${reminder.userId}`);

        // Handle recurring
        if (reminder.recurrence !== RECURRENCE.ONCE) {
          this._scheduleNext(reminder);
        }

      } catch (err) {
        console.error(`[REMINDER] Failed to send ${reminder.id}:`, err.message);
      }
    }

    if (dueReminders.length > 0) {
      this._saveToStorage();
    }

    return dueReminders;
  }

  /**
   * Schedule next occurrence for recurring reminder
   */
  _scheduleNext(reminder) {
    const nextTime = new Date(reminder.time);

    switch (reminder.recurrence) {
      case RECURRENCE.DAILY:
        nextTime.setDate(nextTime.getDate() + 1);
        break;
      case RECURRENCE.WEEKLY:
        nextTime.setDate(nextTime.getDate() + 7);
        break;
      case RECURRENCE.MONTHLY:
        nextTime.setMonth(nextTime.getMonth() + 1);
        break;
      case RECURRENCE.WEEKDAYS:
        do {
          nextTime.setDate(nextTime.getDate() + 1);
        } while (nextTime.getDay() === 0 || nextTime.getDay() === 6);
        break;
    }

    // Create new reminder for next occurrence
    this.add({
      userId: reminder.userId,
      message: reminder.message,
      time: nextTime,
      channel: reminder.channel,
      priority: reminder.priority,
      recurrence: reminder.recurrence,
      metadata: { ...reminder.metadata, parentId: reminder.id }
    });
  }

  /**
   * Start checker interval
   */
  _startChecker() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.checkAndSend();
    }, this.config.checkInterval);

    console.log(`[REMINDER] Checker started (interval: ${this.config.checkInterval}ms)`);
  }

  /**
   * Stop checker
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[REMINDER] Checker stopped');
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const pending = this.reminders.filter(r => r.status === STATUS.PENDING).length;
    const snoozed = this.reminders.filter(r => r.status === STATUS.SNOOZED).length;

    return {
      ...this.stats,
      pending,
      snoozed,
      active: pending + snoozed
    };
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: !!this.intervalId,
      checkInterval: this.config.checkInterval,
      totalReminders: this.reminders.length,
      stats: this.getStats()
    };
  }

  /**
   * Load from storage
   */
  _loadFromStorage() {
    try {
      if (fs.existsSync(this.config.storagePath)) {
        const data = JSON.parse(fs.readFileSync(this.config.storagePath, 'utf8'));
        this.reminders = data.reminders || [];
        this.stats = data.stats || this.stats;
        console.log(`[REMINDER] Loaded ${this.reminders.length} reminders from storage`);
      }
    } catch (err) {
      console.error('[REMINDER] Failed to load from storage:', err.message);
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
        reminders: this.reminders,
        stats: this.stats,
        lastUpdated: new Date().toISOString()
      }, null, 2));
    } catch (err) {
      console.error('[REMINDER] Failed to save to storage:', err.message);
    }
  }

  /**
   * Clear all reminders
   */
  clear() {
    this.reminders = [];
    this.stats = { total: 0, sent: 0, snoozed: 0, cancelled: 0 };
    this._saveToStorage();
  }
}

// Singleton instance
const reminderSystem = new ReminderSystem();

export default reminderSystem;
export { ReminderSystem, PRIORITY, RECURRENCE, STATUS };
