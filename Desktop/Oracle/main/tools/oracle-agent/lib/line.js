/**
 * LINE Messaging API Wrapper
 * Handles LINE bot communication
 */

const https = require('https');
const config = require('../config.json');

/**
 * Reply to a LINE message using reply token
 * @param {string} replyToken - LINE reply token
 * @param {string} message - Message to send
 */
async function reply(replyToken, message) {
  return sendRequest('/v2/bot/message/reply', {
    replyToken,
    messages: [{ type: 'text', text: truncate(message, 4500) }]
  });
}

/**
 * Push a message to a specific user
 * @param {string} userId - LINE user ID
 * @param {string} message - Message to send
 */
async function push(userId, message) {
  return sendRequest('/v2/bot/message/push', {
    to: userId,
    messages: [{ type: 'text', text: truncate(message, 4500) }]
  });
}

/**
 * Send message to owner (Tars)
 * @param {string} message - Message to send
 */
async function notifyOwner(message) {
  return push(config.line.owner_id, message);
}

/**
 * Send multiple messages (for long content)
 * @param {string} userId - LINE user ID
 * @param {string} message - Full message
 */
async function pushLong(userId, message) {
  if (message.length <= 4500) {
    return push(userId, message);
  }

  // Split into parts
  const parts = [];
  let remaining = message;

  while (remaining.length > 0) {
    if (remaining.length <= 4400) {
      parts.push(remaining);
      break;
    }

    // Find a good break point
    let breakPoint = remaining.lastIndexOf('\n', 4400);
    if (breakPoint === -1 || breakPoint < 3000) {
      breakPoint = 4400;
    }

    parts.push(remaining.substring(0, breakPoint));
    remaining = remaining.substring(breakPoint).trim();
  }

  // Send each part with delay
  for (let i = 0; i < parts.length; i++) {
    await push(userId, parts[i]);
    if (i < parts.length - 1) {
      await sleep(500);
    }
  }
}

/**
 * Send request to LINE API
 */
function sendRequest(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);

    const options = {
      hostname: 'api.line.me',
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.line.channel_token}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true, status: res.statusCode });
        } else {
          console.error('[LINE] API Error:', res.statusCode, responseData);
          reject(new Error(`LINE API Error: ${res.statusCode}`));
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

module.exports = {
  reply,
  push,
  pushLong,
  notifyOwner
};
