/**
 * Typing Indicators
 * Show "typing..." status in chat platforms
 *
 * Supported:
 * - LINE (via chatAction API)
 * - Telegram (via sendChatAction)
 *
 * Usage:
 * - Call startTyping() before processing
 * - Call stopTyping() after response sent
 * - Auto-refresh every 5 seconds (Telegram requires this)
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Typing indicator manager
 */
class TypingIndicators {
  constructor() {
    this.activeIndicators = new Map(); // sessionId -> interval
    this.config = {
      refreshInterval: 4000, // Telegram typing expires after 5s
      enabled: true
    };
  }

  /**
   * Start typing indicator for a channel
   * @param {string} channel - 'line' or 'telegram'
   * @param {string} target - userId (LINE) or chatId (Telegram)
   * @param {object} credentials - API credentials
   */
  async startTyping(channel, target, credentials = {}) {
    if (!this.config.enabled) return;

    const sessionId = `${channel}:${target}`;

    // Clear existing indicator if any
    this.stopTyping(sessionId);

    try {
      // Send initial typing indicator
      await this._sendTyping(channel, target, credentials);

      // Set up refresh interval (for Telegram)
      if (channel === 'telegram') {
        const interval = setInterval(async () => {
          try {
            await this._sendTyping(channel, target, credentials);
          } catch (err) {
            console.error('[TYPING] Refresh failed:', err.message);
            this.stopTyping(sessionId);
          }
        }, this.config.refreshInterval);

        this.activeIndicators.set(sessionId, interval);
      }

      console.log(`[TYPING] Started for ${sessionId}`);
    } catch (err) {
      console.error('[TYPING] Start failed:', err.message);
    }
  }

  /**
   * Stop typing indicator
   * @param {string} sessionId - channel:target
   */
  stopTyping(sessionId) {
    const interval = this.activeIndicators.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.activeIndicators.delete(sessionId);
      console.log(`[TYPING] Stopped for ${sessionId}`);
    }
  }

  /**
   * Stop all typing indicators
   */
  stopAll() {
    for (const [sessionId, interval] of this.activeIndicators) {
      clearInterval(interval);
    }
    this.activeIndicators.clear();
    console.log('[TYPING] Stopped all indicators');
  }

  /**
   * Send typing indicator to specific channel
   */
  async _sendTyping(channel, target, credentials) {
    switch (channel) {
      case 'line':
        return this._sendLineTyping(target, credentials);
      case 'telegram':
        return this._sendTelegramTyping(target, credentials);
      default:
        console.warn(`[TYPING] Unknown channel: ${channel}`);
    }
  }

  /**
   * LINE: Send typing indicator via Push API
   * Note: LINE doesn't have native typing indicator, but we can use
   * the loading animation feature or just skip
   */
  async _sendLineTyping(userId, credentials) {
    const { channelToken } = credentials;
    if (!channelToken) {
      throw new Error('LINE channel token required');
    }

    // LINE has a "loading" indicator via chat action
    // POST https://api.line.me/v2/bot/chat/loading/start
    const response = await fetch('https://api.line.me/v2/bot/chat/loading/start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: userId,
        loadingSeconds: 10 // Max 60 seconds
      })
    });

    if (!response.ok) {
      // LINE loading API might not be available for all accounts
      // Silently fail - it's just a nice-to-have
      console.log('[TYPING] LINE loading indicator not available');
    }
  }

  /**
   * Telegram: Send typing indicator via Bot API
   */
  async _sendTelegramTyping(chatId, credentials) {
    const { botToken } = credentials;
    if (!botToken) {
      throw new Error('Telegram bot token required');
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendChatAction`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          action: 'typing'
        })
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.description || 'Telegram typing failed');
    }
  }

  /**
   * Wrapper for easy use in message handlers
   * @param {object} context - { channel, userId/chatId, credentials }
   * @param {Function} handler - async function to execute while typing
   */
  async withTyping(context, handler) {
    const { channel, userId, chatId, credentials } = context;
    const target = userId || chatId;
    const sessionId = `${channel}:${target}`;

    try {
      await this.startTyping(channel, target, credentials);
      const result = await handler();
      return result;
    } finally {
      this.stopTyping(sessionId);
    }
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      activeCount: this.activeIndicators.size,
      activeSessions: Array.from(this.activeIndicators.keys())
    };
  }

  /**
   * Enable/disable typing indicators
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
    return this.config.enabled;
  }
}

// Singleton instance
const typingIndicators = new TypingIndicators();

export default typingIndicators;
export { TypingIndicators };
