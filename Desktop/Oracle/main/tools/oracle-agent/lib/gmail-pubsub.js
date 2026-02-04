/**
 * Gmail Pub/Sub Integration
 * Real-time email processing via Google Cloud Pub/Sub
 *
 * Features:
 * - Real-time push notifications when email arrives
 * - Email parsing and categorization
 * - Auto-draft responses
 * - Notify owner via configured channels
 *
 * Setup required:
 * 1. Create Google Cloud project
 * 2. Enable Gmail API and Pub/Sub API
 * 3. Create Pub/Sub topic and subscription
 * 4. Configure Gmail push notifications
 * 5. Set up OAuth2 credentials
 */

import { EventEmitter } from 'events';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Email categories for routing
 */
const CATEGORIES = {
  BOOKING_INQUIRY: 'booking_inquiry',
  BOOKING_CONFIRMATION: 'booking_confirmation',
  OTA_NOTIFICATION: 'ota_notification',
  PAYMENT: 'payment',
  SUPPORT: 'support',
  URGENT: 'urgent',
  SPAM: 'spam',
  OTHER: 'other'
};

/**
 * Email priority levels
 */
const PRIORITY = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4
};

/**
 * OTA patterns for detection
 */
const OTA_PATTERNS = {
  'booking.com': /booking\.com|bookingcom/i,
  'agoda': /agoda\.com|agoda/i,
  'expedia': /expedia\.com|expedia/i,
  'airbnb': /airbnb\.com|airbnb/i,
  'hotels.com': /hotels\.com/i,
  'tripadvisor': /tripadvisor\.com/i
};

/**
 * Default response templates
 */
const TEMPLATES = {
  booking_inquiry: {
    th: `สวัสดีค่ะ ขอบคุณที่สนใจ {property_name}

สำหรับวันที่ {check_in} - {check_out}:
- ห้อง {room_type} ราคา {price} บาท/คืน
- รวม {nights} คืน = {total} บาท

สนใจจองได้เลยนะคะ หรือมีคำถามเพิ่มเติมสอบถามได้ค่ะ`,

    en: `Hello! Thank you for your interest in {property_name}.

For {check_in} - {check_out}:
- {room_type} room at {price} THB/night
- Total for {nights} nights = {total} THB

Feel free to book or ask any questions!`
  }
};

class GmailPubSub extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      projectId: config.projectId || process.env.GOOGLE_CLOUD_PROJECT,
      topicName: config.topicName || 'gmail-notifications',
      subscriptionName: config.subscriptionName || 'gmail-oracle-sub',
      credentials: config.credentials || null,
      autoProcess: config.autoProcess !== false,
      autoDraft: config.autoDraft || false,
      notifyOwner: config.notifyOwner !== false,
      ...config
    };

    this.isConnected = false;
    this.subscription = null;
    this.stats = {
      received: 0,
      processed: 0,
      drafted: 0,
      notified: 0,
      errors: 0,
      byCategory: {}
    };

    // Email queue for processing
    this.emailQueue = [];
    this.processing = false;

    // Notification callback
    this.notifyCallback = null;

    // AI response generator
    this.aiResponder = null;
  }

  /**
   * Set notification callback (e.g., LINE notify)
   */
  setNotifyCallback(callback) {
    this.notifyCallback = callback;
  }

  /**
   * Set AI responder for auto-drafting
   */
  setAIResponder(responder) {
    this.aiResponder = responder;
  }

  /**
   * Initialize Pub/Sub connection
   * Note: Requires @google-cloud/pubsub package
   */
  async connect() {
    try {
      // Dynamic import for optional dependency
      const { PubSub } = await import('@google-cloud/pubsub').catch(() => {
        console.log('[GMAIL] @google-cloud/pubsub not installed, using webhook mode');
        return { PubSub: null };
      });

      if (!PubSub) {
        console.log('[GMAIL] Running in webhook-only mode');
        this.isConnected = true;
        return { success: true, mode: 'webhook' };
      }

      const pubsub = new PubSub({
        projectId: this.config.projectId,
        credentials: this.config.credentials
      });

      this.subscription = pubsub.subscription(this.config.subscriptionName);

      // Handle incoming messages
      this.subscription.on('message', (message) => {
        this._handlePubSubMessage(message);
      });

      this.subscription.on('error', (error) => {
        console.error('[GMAIL] Pub/Sub error:', error);
        this.emit('error', error);
      });

      this.isConnected = true;
      console.log('[GMAIL] Connected to Pub/Sub');

      return { success: true, mode: 'pubsub' };

    } catch (error) {
      console.error('[GMAIL] Connection error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle Pub/Sub message
   */
  async _handlePubSubMessage(message) {
    try {
      const data = JSON.parse(message.data.toString());
      message.ack();

      await this.processNotification(data);

    } catch (error) {
      console.error('[GMAIL] Message processing error:', error);
      message.nack();
    }
  }

  /**
   * Process webhook notification (alternative to Pub/Sub)
   * Use this endpoint: POST /webhook/gmail
   */
  async processWebhook(payload) {
    this.stats.received++;

    try {
      // Gmail webhook payload contains historyId
      const { emailAddress, historyId } = payload;

      console.log(`[GMAIL] Webhook received for ${emailAddress}, historyId: ${historyId}`);

      // In production, use Gmail API to fetch actual email content
      // For now, emit event for manual handling
      this.emit('webhook', { emailAddress, historyId });

      return {
        success: true,
        message: 'Webhook received',
        historyId
      };

    } catch (error) {
      this.stats.errors++;
      return { success: false, error: error.message };
    }
  }

  /**
   * Process email notification
   * @param {object} notification - Email notification data
   */
  async processNotification(notification) {
    this.stats.received++;

    const email = {
      id: notification.id || `email_${Date.now()}`,
      from: notification.from || '',
      to: notification.to || '',
      subject: notification.subject || '',
      body: notification.body || notification.snippet || '',
      date: notification.date || new Date().toISOString(),
      threadId: notification.threadId,
      labelIds: notification.labelIds || [],
      raw: notification
    };

    // Categorize email
    email.category = this._categorizeEmail(email);
    email.priority = this._getPriority(email);
    email.ota = this._detectOTA(email);

    this.stats.byCategory[email.category] = (this.stats.byCategory[email.category] || 0) + 1;

    console.log(`[GMAIL] Email received: ${email.subject} [${email.category}]`);

    // Emit event
    this.emit('email', email);
    this.emit(`email:${email.category}`, email);

    // Auto-process if enabled
    if (this.config.autoProcess) {
      await this._processEmail(email);
    }

    this.stats.processed++;

    return email;
  }

  /**
   * Process email (notify, draft, etc.)
   */
  async _processEmail(email) {
    // Skip spam
    if (email.category === CATEGORIES.SPAM) {
      return { action: 'skipped', reason: 'spam' };
    }

    const actions = [];

    // Notify owner
    if (this.config.notifyOwner && this.notifyCallback) {
      try {
        const message = this._formatNotification(email);
        await this.notifyCallback(message);
        this.stats.notified++;
        actions.push('notified');
      } catch (error) {
        console.error('[GMAIL] Notify error:', error);
      }
    }

    // Auto-draft response
    if (this.config.autoDraft && this.aiResponder) {
      try {
        const draft = await this._generateDraft(email);
        if (draft) {
          this.stats.drafted++;
          actions.push('drafted');
          this.emit('draft', { email, draft });
        }
      } catch (error) {
        console.error('[GMAIL] Draft error:', error);
      }
    }

    return { actions };
  }

  /**
   * Categorize email based on content
   */
  _categorizeEmail(email) {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    const from = email.from.toLowerCase();

    // Check for OTA notifications
    for (const [ota, pattern] of Object.entries(OTA_PATTERNS)) {
      if (pattern.test(from) || pattern.test(subject)) {
        return CATEGORIES.OTA_NOTIFICATION;
      }
    }

    // Check for booking confirmation
    if (/confirm|ยืนยัน|reservation|จอง.*สำเร็จ/i.test(subject)) {
      return CATEGORIES.BOOKING_CONFIRMATION;
    }

    // Check for payment
    if (/payment|ชำระ|invoice|ใบแจ้ง|receipt/i.test(subject)) {
      return CATEGORIES.PAYMENT;
    }

    // Check for booking inquiry
    if (/ราคา|price|ห้องว่าง|availability|จอง|book|inquiry|สอบถาม/i.test(subject) ||
        /ราคา|price|ห้องว่าง|availability/i.test(body)) {
      return CATEGORIES.BOOKING_INQUIRY;
    }

    // Check for urgent
    if (/urgent|ด่วน|emergency|asap|important|สำคัญ/i.test(subject)) {
      return CATEGORIES.URGENT;
    }

    // Check for spam indicators
    if (/unsubscribe|newsletter|promotion|โปรโมชั่น|ลด.*%/i.test(body) &&
        !/booking|จอง|reservation/i.test(subject)) {
      return CATEGORIES.SPAM;
    }

    return CATEGORIES.OTHER;
  }

  /**
   * Determine email priority
   */
  _getPriority(email) {
    if (email.category === CATEGORIES.URGENT) return PRIORITY.CRITICAL;
    if (email.category === CATEGORIES.BOOKING_INQUIRY) return PRIORITY.HIGH;
    if (email.category === CATEGORIES.OTA_NOTIFICATION) return PRIORITY.HIGH;
    if (email.category === CATEGORIES.PAYMENT) return PRIORITY.NORMAL;
    if (email.category === CATEGORIES.SPAM) return PRIORITY.LOW;
    return PRIORITY.NORMAL;
  }

  /**
   * Detect OTA source
   */
  _detectOTA(email) {
    const from = email.from.toLowerCase();
    const subject = email.subject.toLowerCase();

    for (const [ota, pattern] of Object.entries(OTA_PATTERNS)) {
      if (pattern.test(from) || pattern.test(subject)) {
        return ota;
      }
    }

    return null;
  }

  /**
   * Format notification message for owner
   */
  _formatNotification(email) {
    const priorityIcon = {
      [PRIORITY.CRITICAL]: '🚨',
      [PRIORITY.HIGH]: '📧',
      [PRIORITY.NORMAL]: '📬',
      [PRIORITY.LOW]: '📭'
    }[email.priority] || '📧';

    const categoryLabel = {
      [CATEGORIES.BOOKING_INQUIRY]: 'ลูกค้าสอบถาม',
      [CATEGORIES.BOOKING_CONFIRMATION]: 'ยืนยันการจอง',
      [CATEGORIES.OTA_NOTIFICATION]: `แจ้งเตือนจาก ${email.ota || 'OTA'}`,
      [CATEGORIES.PAYMENT]: 'การชำระเงิน',
      [CATEGORIES.URGENT]: 'ด่วน!',
      [CATEGORIES.SUPPORT]: 'Support',
      [CATEGORIES.OTHER]: 'Email ใหม่'
    }[email.category] || 'Email ใหม่';

    let message = `${priorityIcon} ${categoryLabel}\n\n`;
    message += `📨 From: ${email.from}\n`;
    message += `📋 Subject: ${email.subject}\n`;

    if (email.body) {
      const preview = email.body.substring(0, 200);
      message += `\n💬 Preview:\n${preview}${email.body.length > 200 ? '...' : ''}`;
    }

    return message;
  }

  /**
   * Generate draft response using AI
   */
  async _generateDraft(email) {
    if (!this.aiResponder) return null;

    // Only draft for certain categories
    if (![CATEGORIES.BOOKING_INQUIRY, CATEGORIES.SUPPORT].includes(email.category)) {
      return null;
    }

    const prompt = `Draft a helpful response to this email:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.body}

Guidelines:
- Be professional and friendly
- If it's a booking inquiry, mention availability and pricing
- Keep it concise
- Use Thai if the email is in Thai, English otherwise`;

    try {
      const response = await this.aiResponder(prompt);
      return {
        to: email.from,
        subject: `Re: ${email.subject}`,
        body: response,
        inReplyTo: email.id,
        threadId: email.threadId
      };
    } catch (error) {
      console.error('[GMAIL] AI draft error:', error);
      return null;
    }
  }

  /**
   * Manually process an email (for testing or manual trigger)
   */
  async processEmail(emailData) {
    return this.processNotification(emailData);
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      mode: this.subscription ? 'pubsub' : 'webhook',
      config: {
        projectId: this.config.projectId,
        autoProcess: this.config.autoProcess,
        autoDraft: this.config.autoDraft,
        notifyOwner: this.config.notifyOwner
      },
      stats: this.stats,
      categories: CATEGORIES,
      supportedOTAs: Object.keys(OTA_PATTERNS)
    };
  }

  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      received: 0,
      processed: 0,
      drafted: 0,
      notified: 0,
      errors: 0,
      byCategory: {}
    };
  }

  /**
   * Disconnect
   */
  async disconnect() {
    if (this.subscription) {
      await this.subscription.close();
      this.subscription = null;
    }
    this.isConnected = false;
    console.log('[GMAIL] Disconnected');
  }
}

// Singleton instance
const gmailPubSub = new GmailPubSub();

export default gmailPubSub;
export { GmailPubSub, CATEGORIES, PRIORITY, OTA_PATTERNS, TEMPLATES };
