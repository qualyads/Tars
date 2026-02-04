/**
 * Multi-Channel Gateway
 * Unified interface for all messaging channels
 *
 * Supports: LINE, Telegram, (WhatsApp planned)
 * Same brain, all channels
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../config.json');

// Import channel modules
import line from './line.js';
import telegram from './telegram.js';

/**
 * Channel types
 */
const CHANNELS = {
  LINE: 'line',
  TELEGRAM: 'telegram',
  WHATSAPP: 'whatsapp'
};

/**
 * Normalize incoming message to unified format
 * @param {string} channel - Channel type
 * @param {object} rawMessage - Raw message from channel
 * @returns {object} Normalized message
 */
function normalizeMessage(channel, rawMessage) {
  switch (channel) {
    case CHANNELS.LINE:
      return {
        channel: CHANNELS.LINE,
        messageId: rawMessage.message?.id,
        userId: rawMessage.source?.userId,
        chatId: rawMessage.source?.userId, // LINE uses userId as chatId for DMs
        groupId: rawMessage.source?.groupId,
        text: rawMessage.message?.text,
        type: rawMessage.message?.type,
        timestamp: rawMessage.timestamp,
        replyToken: rawMessage.replyToken,
        isGroup: rawMessage.source?.type === 'group',
        raw: rawMessage
      };

    case CHANNELS.TELEGRAM:
      const msg = rawMessage.message || rawMessage;
      return {
        channel: CHANNELS.TELEGRAM,
        messageId: msg.message_id,
        userId: msg.from?.id?.toString(),
        chatId: msg.chat?.id?.toString(),
        username: msg.from?.username,
        text: msg.text,
        type: msg.text ? 'text' : 'other',
        timestamp: msg.date * 1000,
        isGroup: msg.chat?.type === 'group' || msg.chat?.type === 'supergroup',
        raw: rawMessage
      };

    default:
      return {
        channel: 'unknown',
        text: rawMessage.text || rawMessage.message,
        raw: rawMessage
      };
  }
}

/**
 * Send message through the appropriate channel
 * @param {string} channel - Channel type
 * @param {string} chatId - Chat ID
 * @param {string} message - Message to send
 * @param {object} options - Channel-specific options
 */
async function send(channel, chatId, message, options = {}) {
  switch (channel) {
    case CHANNELS.LINE:
      if (options.replyToken) {
        return line.reply(options.replyToken, message);
      }
      return line.push(chatId, message);

    case CHANNELS.TELEGRAM:
      if (options.replyToMessageId) {
        return telegram.reply(chatId, options.replyToMessageId, message);
      }
      return telegram.send(chatId, message, options);

    default:
      throw new Error(`Unknown channel: ${channel}`);
  }
}

/**
 * Send long message (auto-split)
 * @param {string} channel - Channel type
 * @param {string} chatId - Chat ID
 * @param {string} message - Full message
 */
async function sendLong(channel, chatId, message) {
  switch (channel) {
    case CHANNELS.LINE:
      return line.pushLong(chatId, message);
    case CHANNELS.TELEGRAM:
      return telegram.sendLong(chatId, message);
    default:
      throw new Error(`Unknown channel: ${channel}`);
  }
}

/**
 * Notify owner across preferred channel(s)
 * @param {string} message - Message to send
 * @param {string|string[]} channels - Which channels to use (default: all configured)
 */
async function notifyOwner(message, channels = null) {
  const results = [];
  const targetChannels = channels
    ? (Array.isArray(channels) ? channels : [channels])
    : getConfiguredChannels();

  for (const channel of targetChannels) {
    try {
      switch (channel) {
        case CHANNELS.LINE:
          if (config.line?.owner_id) {
            await line.notifyOwner(message);
            results.push({ channel, success: true });
          }
          break;

        case CHANNELS.TELEGRAM:
          if (config.telegram?.owner_id) {
            await telegram.notifyOwner(message);
            results.push({ channel, success: true });
          }
          break;
      }
    } catch (error) {
      console.error(`[GATEWAY] Error notifying via ${channel}:`, error.message);
      results.push({ channel, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Get list of configured channels
 */
function getConfiguredChannels() {
  const channels = [];

  if (config.line?.channel_token && config.line?.enabled !== false) {
    channels.push(CHANNELS.LINE);
  }

  if (config.telegram?.bot_token && config.telegram?.enabled) {
    channels.push(CHANNELS.TELEGRAM);
  }

  return channels;
}

/**
 * Check if a user is the owner
 * @param {string} channel - Channel type
 * @param {string} userId - User ID to check
 */
function isOwner(channel, userId) {
  switch (channel) {
    case CHANNELS.LINE:
      return userId === config.line?.owner_id;
    case CHANNELS.TELEGRAM:
      return userId === config.telegram?.owner_id?.toString();
    default:
      return false;
  }
}

/**
 * Get channel-specific user display name
 * @param {object} normalizedMessage - Normalized message
 */
function getUserDisplayName(normalizedMessage) {
  switch (normalizedMessage.channel) {
    case CHANNELS.TELEGRAM:
      return normalizedMessage.username
        ? `@${normalizedMessage.username}`
        : `user:${normalizedMessage.userId}`;
    case CHANNELS.LINE:
      return `line:${normalizedMessage.userId?.substring(0, 8)}`;
    default:
      return normalizedMessage.userId || 'unknown';
  }
}

/**
 * Get gateway status
 */
function getStatus() {
  return {
    channels: {
      line: {
        enabled: config.line?.enabled !== false,
        configured: !!config.line?.channel_token,
        hasOwner: !!config.line?.owner_id
      },
      telegram: {
        enabled: config.telegram?.enabled || false,
        configured: !!config.telegram?.bot_token,
        hasOwner: !!config.telegram?.owner_id
      },
      whatsapp: {
        enabled: false,
        configured: false,
        hasOwner: false,
        note: 'Planned for future'
      }
    },
    activeChannels: getConfiguredChannels()
  };
}

export default {
  CHANNELS,
  normalizeMessage,
  send,
  sendLong,
  notifyOwner,
  getConfiguredChannels,
  isOwner,
  getUserDisplayName,
  getStatus
};

export { CHANNELS };
