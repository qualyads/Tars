/**
 * Telegram Bot API Wrapper
 * Handles Telegram bot communication
 */

import https from 'https';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../config.json');

const TELEGRAM_API = 'api.telegram.org';

/**
 * Send a message to a Telegram chat
 * @param {string|number} chatId - Telegram chat ID
 * @param {string} message - Message to send
 * @param {object} options - Additional options
 */
async function send(chatId, message, options = {}) {
  const body = {
    chat_id: chatId,
    text: truncate(message, 4096),
    ...options
  };

  // Only set parse_mode if explicitly provided
  // Default: no parse_mode (plain text) to avoid Markdown rejection
  if (options.parseMode) {
    body.parse_mode = options.parseMode;
  }

  return sendRequest('sendMessage', body);
}

/**
 * Reply to a specific message
 * @param {string|number} chatId - Telegram chat ID
 * @param {number} messageId - Message ID to reply to
 * @param {string} message - Message to send
 */
async function reply(chatId, messageId, message) {
  return send(chatId, message, {
    reply_to_message_id: messageId
  });
}

/**
 * Send message to owner
 * @param {string} message - Message to send
 */
async function notifyOwner(message) {
  const ownerId = config.telegram?.owner_id;
  if (!ownerId) {
    console.warn('[TELEGRAM] Owner ID not configured');
    return null;
  }
  // Use sendLong to handle messages > 4096 chars (same behavior as LINE)
  return sendLong(ownerId, message);
}

/**
 * Send long message (split into parts if needed)
 * @param {string|number} chatId - Telegram chat ID
 * @param {string} message - Full message
 */
async function sendLong(chatId, message) {
  if (message.length <= 4000) {
    return send(chatId, message);
  }

  // Split into parts
  const parts = [];
  let remaining = message;

  while (remaining.length > 0) {
    if (remaining.length <= 3900) {
      parts.push(remaining);
      break;
    }

    // Find a good break point
    let breakPoint = remaining.lastIndexOf('\n', 3900);
    if (breakPoint === -1 || breakPoint < 2500) {
      breakPoint = 3900;
    }

    parts.push(remaining.substring(0, breakPoint));
    remaining = remaining.substring(breakPoint).trim();
  }

  // Send each part with delay
  for (let i = 0; i < parts.length; i++) {
    await send(chatId, parts[i]);
    if (i < parts.length - 1) {
      await sleep(500);
    }
  }
}

/**
 * Set webhook URL for receiving updates
 * @param {string} url - Webhook URL
 */
async function setWebhook(url) {
  return sendRequest('setWebhook', {
    url: url,
    allowed_updates: ['message', 'callback_query']
  });
}

/**
 * Delete webhook (for polling mode)
 */
async function deleteWebhook() {
  return sendRequest('deleteWebhook', {});
}

/**
 * Get bot info
 */
async function getMe() {
  return sendRequest('getMe', {});
}

/**
 * Send request to Telegram API
 */
function sendRequest(method, body) {
  return new Promise((resolve, reject) => {
    const token = config.telegram?.bot_token;
    if (!token) {
      reject(new Error('Telegram bot token not configured'));
      return;
    }

    const data = JSON.stringify(body);

    const options = {
      hostname: TELEGRAM_API,
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.ok) {
            resolve({ success: true, result: result.result });
          } else {
            console.error('[TELEGRAM] API Error:', result.description);
            reject(new Error(`Telegram API Error: ${result.description}`));
          }
        } catch (e) {
          reject(new Error(`Telegram Parse Error: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Truncate message to max length
 */
function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if Telegram is configured
 */
function isConfigured() {
  return !!(config.telegram?.bot_token && config.telegram?.enabled);
}

export default {
  send,
  reply,
  sendLong,
  notifyOwner,
  setWebhook,
  deleteWebhook,
  getMe,
  isConfigured
};
