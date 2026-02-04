/**
 * Emoji Reactions
 * AI can add/remove emoji reactions on messages
 *
 * Supported:
 * - Telegram (full emoji support)
 * - LINE (limited - via stamp/sticker)
 * - Discord (full support - future)
 *
 * Use Cases:
 * - Acknowledge receipt (👍)
 * - Mark as done (✅)
 * - Flag for later (🚩)
 * - Express emotion without text
 */

/**
 * Common reaction types and their emojis
 */
const REACTION_TYPES = {
  // Acknowledgment
  ACK: '👍',
  SEEN: '👀',
  THINKING: '🤔',

  // Status
  DONE: '✅',
  PROCESSING: '⏳',
  ERROR: '❌',
  WARNING: '⚠️',

  // Emotion
  LOVE: '❤️',
  CELEBRATE: '🎉',
  LAUGH: '😄',
  SAD: '😢',
  FIRE: '🔥',

  // Action
  FLAG: '🚩',
  PIN: '📌',
  BOOKMARK: '🔖',
  QUESTION: '❓',

  // Business
  MONEY: '💰',
  BOOKING: '🏨',
  CALENDAR: '📅',
  URGENT: '🚨'
};

/**
 * Quick reaction shortcuts
 */
const SHORTCUTS = {
  'ok': REACTION_TYPES.ACK,
  'done': REACTION_TYPES.DONE,
  'error': REACTION_TYPES.ERROR,
  'think': REACTION_TYPES.THINKING,
  'love': REACTION_TYPES.LOVE,
  'flag': REACTION_TYPES.FLAG,
  'urgent': REACTION_TYPES.URGENT,
  'money': REACTION_TYPES.MONEY
};

/**
 * Reactions Manager
 */
class Reactions {
  constructor() {
    this.config = {
      enabled: true,
      autoAck: false, // Auto-react to incoming messages
      ackEmoji: REACTION_TYPES.SEEN
    };

    // Track reactions for potential undo
    this.reactionHistory = new Map(); // messageId -> { emoji, channel, timestamp }
    this.maxHistory = 100;
  }

  /**
   * Add reaction to a message
   * @param {string} channel - 'telegram' | 'line' | 'discord'
   * @param {string} messageId - Message ID to react to
   * @param {string} emoji - Emoji or shortcut name
   * @param {object} credentials - API credentials
   * @param {object} context - Additional context (chatId, etc.)
   */
  async addReaction(channel, messageId, emoji, credentials, context = {}) {
    if (!this.config.enabled) return { success: false, reason: 'disabled' };

    // Resolve emoji from shortcut
    const resolvedEmoji = SHORTCUTS[emoji.toLowerCase()] || emoji;

    try {
      let result;
      switch (channel) {
        case 'telegram':
          result = await this._telegramReaction(messageId, resolvedEmoji, credentials, context, 'add');
          break;
        case 'line':
          result = await this._lineReaction(messageId, resolvedEmoji, credentials, context);
          break;
        case 'discord':
          result = await this._discordReaction(messageId, resolvedEmoji, credentials, context, 'add');
          break;
        default:
          return { success: false, reason: `Unsupported channel: ${channel}` };
      }

      // Record history
      this._recordHistory(messageId, resolvedEmoji, channel, 'add');

      return { success: true, emoji: resolvedEmoji, ...result };
    } catch (err) {
      console.error(`[REACTIONS] Failed to add reaction:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Remove reaction from a message
   */
  async removeReaction(channel, messageId, emoji, credentials, context = {}) {
    if (!this.config.enabled) return { success: false, reason: 'disabled' };

    const resolvedEmoji = SHORTCUTS[emoji.toLowerCase()] || emoji;

    try {
      let result;
      switch (channel) {
        case 'telegram':
          result = await this._telegramReaction(messageId, resolvedEmoji, credentials, context, 'remove');
          break;
        case 'discord':
          result = await this._discordReaction(messageId, resolvedEmoji, credentials, context, 'remove');
          break;
        default:
          return { success: false, reason: `Remove not supported for: ${channel}` };
      }

      this._recordHistory(messageId, resolvedEmoji, channel, 'remove');

      return { success: true, emoji: resolvedEmoji, ...result };
    } catch (err) {
      console.error(`[REACTIONS] Failed to remove reaction:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Telegram: Set reaction on message
   */
  async _telegramReaction(messageId, emoji, credentials, context, action) {
    const { botToken } = credentials;
    const { chatId } = context;

    if (!botToken) throw new Error('Telegram bot token required');
    if (!chatId) throw new Error('Chat ID required');

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setMessageReaction`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: parseInt(messageId),
          reaction: action === 'add' ? [{ type: 'emoji', emoji }] : [],
          is_big: false
        })
      }
    );

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || 'Telegram reaction failed');
    }

    return { telegramResult: data.result };
  }

  /**
   * LINE: React using stamp (LINE doesn't have true reactions)
   * Instead, we send a stamp as a reply
   */
  async _lineReaction(messageId, emoji, credentials, context) {
    const { channelToken } = credentials;
    const { userId, replyToken } = context;

    if (!channelToken) throw new Error('LINE channel token required');

    // LINE doesn't support reactions, but we can:
    // 1. Reply with a sticker (if replyToken available)
    // 2. Push a stamp message

    // Map emoji to LINE sticker
    const stickerMap = {
      '👍': { packageId: '11537', stickerId: '52002734' },
      '❤️': { packageId: '11537', stickerId: '52002735' },
      '😄': { packageId: '11537', stickerId: '52002736' },
      '😢': { packageId: '11537', stickerId: '52002737' },
      '🎉': { packageId: '11537', stickerId: '52002738' },
      '✅': { packageId: '11537', stickerId: '52002739' }
    };

    const sticker = stickerMap[emoji];
    if (!sticker) {
      // Emoji not mappable to LINE sticker, just acknowledge
      console.log(`[REACTIONS] LINE: No sticker for ${emoji}, skipping`);
      return { lineResult: 'no_sticker_mapping' };
    }

    // Use push message to send sticker
    if (userId) {
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${channelToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: userId,
          messages: [{
            type: 'sticker',
            packageId: sticker.packageId,
            stickerId: sticker.stickerId
          }]
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'LINE sticker failed');
      }

      return { lineResult: 'sticker_sent' };
    }

    return { lineResult: 'skipped' };
  }

  /**
   * Discord: Add/remove reaction (future implementation)
   */
  async _discordReaction(messageId, emoji, credentials, context, action) {
    const { botToken } = credentials;
    const { channelId } = context;

    if (!botToken) throw new Error('Discord bot token required');
    if (!channelId) throw new Error('Channel ID required');

    // Encode emoji for URL
    const encodedEmoji = encodeURIComponent(emoji);

    const url = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`;

    const response = await fetch(url, {
      method: action === 'add' ? 'PUT' : 'DELETE',
      headers: {
        'Authorization': `Bot ${botToken}`
      }
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Discord reaction failed');
    }

    return { discordResult: 'success' };
  }

  /**
   * Quick react with common types
   */
  async ack(channel, messageId, credentials, context) {
    return this.addReaction(channel, messageId, REACTION_TYPES.ACK, credentials, context);
  }

  async done(channel, messageId, credentials, context) {
    return this.addReaction(channel, messageId, REACTION_TYPES.DONE, credentials, context);
  }

  async thinking(channel, messageId, credentials, context) {
    return this.addReaction(channel, messageId, REACTION_TYPES.THINKING, credentials, context);
  }

  async error(channel, messageId, credentials, context) {
    return this.addReaction(channel, messageId, REACTION_TYPES.ERROR, credentials, context);
  }

  /**
   * Auto-acknowledge incoming message
   */
  async autoAck(channel, messageId, credentials, context) {
    if (!this.config.autoAck) return null;
    return this.addReaction(channel, messageId, this.config.ackEmoji, credentials, context);
  }

  /**
   * Record reaction history
   */
  _recordHistory(messageId, emoji, channel, action) {
    this.reactionHistory.set(messageId, {
      emoji,
      channel,
      action,
      timestamp: Date.now()
    });

    // Trim history
    if (this.reactionHistory.size > this.maxHistory) {
      const firstKey = this.reactionHistory.keys().next().value;
      this.reactionHistory.delete(firstKey);
    }
  }

  /**
   * Get available reaction types
   */
  getTypes() {
    return REACTION_TYPES;
  }

  /**
   * Get shortcuts
   */
  getShortcuts() {
    return SHORTCUTS;
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      autoAck: this.config.autoAck,
      historySize: this.reactionHistory.size,
      availableTypes: Object.keys(REACTION_TYPES),
      shortcuts: Object.keys(SHORTCUTS)
    };
  }

  /**
   * Enable/disable reactions
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    return this.config.enabled;
  }

  /**
   * Set auto-acknowledge
   */
  setAutoAck(enabled, emoji = REACTION_TYPES.SEEN) {
    this.config.autoAck = enabled;
    this.config.ackEmoji = emoji;
    return this.config;
  }
}

// Singleton instance
const reactions = new Reactions();

export default reactions;
export { Reactions, REACTION_TYPES, SHORTCUTS };
