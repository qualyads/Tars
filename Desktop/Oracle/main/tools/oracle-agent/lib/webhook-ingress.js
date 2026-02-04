/**
 * Webhook Ingress System
 * Receive and process webhooks from external systems
 *
 * Supported sources:
 * - Beds24 (booking system)
 * - Stripe (payments)
 * - GitHub (repository events)
 * - Generic (any webhook)
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';

/**
 * Webhook source configurations
 */
const SOURCES = {
  beds24: {
    name: 'Beds24',
    description: 'Booking management system',
    verifySignature: (payload, signature, secret) => {
      // Beds24 uses simple API key verification
      return true; // Beds24 typically uses IP whitelist or API key in payload
    },
    parsePayload: (body) => body,
    events: ['booking.new', 'booking.modified', 'booking.cancelled', 'availability.changed']
  },

  stripe: {
    name: 'Stripe',
    description: 'Payment processing',
    verifySignature: (payload, signature, secret) => {
      if (!signature || !secret) return false;

      const elements = signature.split(',');
      const signatureMap = {};

      for (const element of elements) {
        const [key, value] = element.split('=');
        signatureMap[key] = value;
      }

      const timestamp = signatureMap['t'];
      const expectedSignature = signatureMap['v1'];

      if (!timestamp || !expectedSignature) return false;

      const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(computedSignature)
      );
    },
    parsePayload: (body) => body,
    events: [
      'payment_intent.succeeded',
      'payment_intent.failed',
      'charge.succeeded',
      'charge.refunded',
      'invoice.paid',
      'customer.created'
    ]
  },

  github: {
    name: 'GitHub',
    description: 'Repository events',
    verifySignature: (payload, signature, secret) => {
      if (!signature || !secret) return false;

      const computedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(computedSignature)
      );
    },
    parsePayload: (body) => body,
    events: ['push', 'pull_request', 'issues', 'release', 'workflow_run']
  },

  generic: {
    name: 'Generic',
    description: 'Any webhook source',
    verifySignature: () => true,
    parsePayload: (body) => body,
    events: ['*']
  }
};

/**
 * Event handlers registry
 */
const handlers = new Map();

/**
 * Webhook history for debugging
 */
const webhookHistory = [];
const MAX_HISTORY = 100;

class WebhookIngress extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      maxPayloadSize: config.maxPayloadSize || 1024 * 1024, // 1MB
      enableHistory: config.enableHistory !== false,
      historySize: config.historySize || MAX_HISTORY,
      secrets: config.secrets || {},
      ...config
    };

    this.stats = {
      received: 0,
      processed: 0,
      failed: 0,
      bySource: {}
    };
  }

  /**
   * Process incoming webhook
   * @param {string} source - Webhook source (beds24, stripe, github, generic)
   * @param {object} payload - Webhook payload
   * @param {object} headers - HTTP headers
   * @returns {Promise<object>} Processing result
   */
  async process(source, payload, headers = {}) {
    const startTime = Date.now();
    const webhookId = this._generateId();

    this.stats.received++;
    this.stats.bySource[source] = (this.stats.bySource[source] || 0) + 1;

    const sourceConfig = SOURCES[source] || SOURCES.generic;

    // Create webhook record
    const webhook = {
      id: webhookId,
      source,
      sourceName: sourceConfig.name,
      timestamp: new Date().toISOString(),
      headers: this._sanitizeHeaders(headers),
      payload,
      status: 'processing'
    };

    try {
      // Verify signature if secret is configured
      const secret = this.config.secrets[source];
      const signature = headers['stripe-signature'] ||
                       headers['x-hub-signature-256'] ||
                       headers['x-webhook-signature'];

      if (secret && !sourceConfig.verifySignature(payload, signature, secret)) {
        throw new Error('Invalid webhook signature');
      }

      // Parse payload
      const parsedPayload = sourceConfig.parsePayload(payload);

      // Determine event type
      const eventType = this._extractEventType(source, parsedPayload, headers);

      webhook.eventType = eventType;

      // Process the webhook
      const result = await this._handleWebhook(source, eventType, parsedPayload, webhook);

      webhook.status = 'processed';
      webhook.result = result;
      webhook.processingTime = Date.now() - startTime;

      this.stats.processed++;

      // Emit event
      this.emit('webhook', webhook);
      this.emit(`${source}:${eventType}`, webhook);

      // Store in history
      this._addToHistory(webhook);

      return {
        success: true,
        webhookId,
        eventType,
        result,
        processingTime: webhook.processingTime
      };

    } catch (error) {
      webhook.status = 'failed';
      webhook.error = error.message;
      webhook.processingTime = Date.now() - startTime;

      this.stats.failed++;

      this.emit('error', { webhook, error });
      this._addToHistory(webhook);

      return {
        success: false,
        webhookId,
        error: error.message,
        processingTime: webhook.processingTime
      };
    }
  }

  /**
   * Extract event type from webhook
   */
  _extractEventType(source, payload, headers) {
    switch (source) {
      case 'stripe':
        return payload.type || 'unknown';

      case 'github':
        return headers['x-github-event'] || 'unknown';

      case 'beds24':
        return payload.action || payload.type || 'notification';

      default:
        return payload.event || payload.type || payload.action || 'generic';
    }
  }

  /**
   * Handle webhook based on registered handlers
   */
  async _handleWebhook(source, eventType, payload, webhook) {
    const results = [];

    // Check for specific handler
    const specificKey = `${source}:${eventType}`;
    const sourceKey = `${source}:*`;
    const globalKey = '*:*';

    const handlersToRun = [
      ...(handlers.get(specificKey) || []),
      ...(handlers.get(sourceKey) || []),
      ...(handlers.get(globalKey) || [])
    ];

    if (handlersToRun.length === 0) {
      console.log(`[WEBHOOK] No handlers for ${specificKey}`);
      return { handled: false, message: 'No handlers registered' };
    }

    for (const handler of handlersToRun) {
      try {
        const result = await handler(payload, webhook);
        results.push({ handler: handler.name || 'anonymous', success: true, result });
      } catch (error) {
        results.push({ handler: handler.name || 'anonymous', success: false, error: error.message });
      }
    }

    return {
      handled: true,
      handlersRun: results.length,
      results
    };
  }

  /**
   * Register a webhook handler
   * @param {string} source - Source name or '*' for all
   * @param {string} eventType - Event type or '*' for all
   * @param {function} handler - Handler function
   */
  on(source, eventType, handler) {
    if (typeof eventType === 'function') {
      // on(source, handler) syntax
      handler = eventType;
      eventType = '*';
    }

    const key = `${source}:${eventType}`;

    if (!handlers.has(key)) {
      handlers.set(key, []);
    }

    handlers.get(key).push(handler);
    console.log(`[WEBHOOK] Handler registered for ${key}`);

    return this;
  }

  /**
   * Remove a handler
   */
  off(source, eventType, handler) {
    const key = `${source}:${eventType}`;
    const handlerList = handlers.get(key);

    if (handlerList) {
      const index = handlerList.indexOf(handler);
      if (index > -1) {
        handlerList.splice(index, 1);
      }
    }

    return this;
  }

  /**
   * Generate webhook ID
   */
  _generateId() {
    return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize headers for storage
   */
  _sanitizeHeaders(headers) {
    const safe = { ...headers };

    // Remove sensitive headers
    delete safe['authorization'];
    delete safe['x-api-key'];
    delete safe['cookie'];

    return safe;
  }

  /**
   * Add webhook to history
   */
  _addToHistory(webhook) {
    if (!this.config.enableHistory) return;

    webhookHistory.unshift(webhook);

    while (webhookHistory.length > this.config.historySize) {
      webhookHistory.pop();
    }
  }

  /**
   * Get webhook history
   */
  getHistory(options = {}) {
    let history = [...webhookHistory];

    if (options.source) {
      history = history.filter(w => w.source === options.source);
    }

    if (options.status) {
      history = history.filter(w => w.status === options.status);
    }

    if (options.limit) {
      history = history.slice(0, options.limit);
    }

    return history;
  }

  /**
   * Get webhook by ID
   */
  getWebhook(webhookId) {
    return webhookHistory.find(w => w.id === webhookId);
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      sources: Object.keys(SOURCES).map(id => ({
        id,
        name: SOURCES[id].name,
        description: SOURCES[id].description,
        events: SOURCES[id].events,
        secretConfigured: !!this.config.secrets[id]
      })),
      handlers: Array.from(handlers.entries()).map(([key, list]) => ({
        pattern: key,
        count: list.length
      })),
      stats: this.stats,
      historySize: webhookHistory.length
    };
  }

  /**
   * Clear history
   */
  clearHistory() {
    webhookHistory.length = 0;
    return true;
  }

  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      received: 0,
      processed: 0,
      failed: 0,
      bySource: {}
    };
    return true;
  }
}

// ==========================================
// Pre-built handlers for common use cases
// ==========================================

/**
 * Beds24 booking handler
 */
function createBeds24Handler(oracle) {
  return async (payload, webhook) => {
    const { action, bookId, propertyId, guestName, checkIn, checkOut } = payload;

    let message = '';

    switch (action) {
      case 'booking.new':
        message = `🎉 การจองใหม่!\n` +
                  `Guest: ${guestName}\n` +
                  `Check-in: ${checkIn}\n` +
                  `Check-out: ${checkOut}\n` +
                  `Booking ID: ${bookId}`;
        break;

      case 'booking.cancelled':
        message = `❌ การจองถูกยกเลิก\n` +
                  `Booking ID: ${bookId}\n` +
                  `Guest: ${guestName}`;
        break;

      case 'booking.modified':
        message = `📝 การจองถูกแก้ไข\n` +
                  `Booking ID: ${bookId}`;
        break;

      default:
        message = `📋 Beds24 notification: ${action}`;
    }

    // Notify owner via Oracle
    if (oracle && oracle.notifyOwner) {
      await oracle.notifyOwner(message);
    }

    return { notified: true, message };
  };
}

/**
 * Stripe payment handler
 */
function createStripeHandler(oracle) {
  return async (payload, webhook) => {
    const { type, data } = payload;

    let message = '';

    switch (type) {
      case 'payment_intent.succeeded':
        const amount = (data.object.amount / 100).toLocaleString();
        const currency = data.object.currency.toUpperCase();
        message = `💰 ชำระเงินสำเร็จ!\n` +
                  `Amount: ${amount} ${currency}\n` +
                  `ID: ${data.object.id}`;
        break;

      case 'payment_intent.failed':
        message = `⚠️ การชำระเงินล้มเหลว\n` +
                  `ID: ${data.object.id}\n` +
                  `Error: ${data.object.last_payment_error?.message || 'Unknown'}`;
        break;

      case 'charge.refunded':
        const refundAmount = (data.object.amount_refunded / 100).toLocaleString();
        message = `↩️ Refund processed\n` +
                  `Amount: ${refundAmount} ${data.object.currency.toUpperCase()}`;
        break;

      default:
        message = `💳 Stripe event: ${type}`;
    }

    if (oracle && oracle.notifyOwner) {
      await oracle.notifyOwner(message);
    }

    return { notified: true, message };
  };
}

/**
 * GitHub handler
 */
function createGitHubHandler(oracle) {
  return async (payload, webhook) => {
    const eventType = webhook.eventType;

    let message = '';

    switch (eventType) {
      case 'push':
        const commits = payload.commits?.length || 0;
        const branch = payload.ref?.split('/').pop() || 'unknown';
        message = `📦 Git Push\n` +
                  `Branch: ${branch}\n` +
                  `Commits: ${commits}\n` +
                  `By: ${payload.pusher?.name || 'unknown'}`;
        break;

      case 'pull_request':
        message = `🔀 Pull Request ${payload.action}\n` +
                  `#${payload.number}: ${payload.pull_request?.title}\n` +
                  `By: ${payload.sender?.login}`;
        break;

      case 'issues':
        message = `📋 Issue ${payload.action}\n` +
                  `#${payload.issue?.number}: ${payload.issue?.title}`;
        break;

      case 'workflow_run':
        const conclusion = payload.workflow_run?.conclusion || 'in_progress';
        const icon = conclusion === 'success' ? '✅' : conclusion === 'failure' ? '❌' : '🔄';
        message = `${icon} Workflow: ${payload.workflow_run?.name}\n` +
                  `Status: ${conclusion}`;
        break;

      default:
        message = `🐙 GitHub event: ${eventType}`;
    }

    if (oracle && oracle.notifyOwner) {
      await oracle.notifyOwner(message);
    }

    return { notified: true, message };
  };
}

// Singleton instance
const webhookIngress = new WebhookIngress();

export default webhookIngress;
export {
  WebhookIngress,
  SOURCES,
  createBeds24Handler,
  createStripeHandler,
  createGitHubHandler
};
