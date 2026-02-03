/**
 * LINE Core - Core LINE Functions จาก OpenClaw Pattern
 *
 * Features:
 * - Webhook signature validation (HMAC-SHA256)
 * - Message chunking (5 messages per reply)
 * - User profile caching (5-minute TTL)
 * - Quick reply helpers
 * - Markdown → Flex conversion
 *
 * @module line-core
 */

import crypto from 'crypto';

// ============================================================
// Webhook Signature Validation
// ============================================================

/**
 * Validate LINE webhook signature using HMAC-SHA256
 * Uses constant-time comparison to prevent timing attacks
 *
 * @param {string} body - Raw request body (string)
 * @param {string} signature - X-Line-Signature header
 * @param {string} channelSecret - LINE channel secret
 * @returns {boolean} Whether signature is valid
 */
export function validateSignature(body, signature, channelSecret) {
  if (!body || !signature || !channelSecret) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', channelSecret)
      .update(body, 'utf8')
      .digest('base64');

    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Create Express middleware for LINE webhook validation
 * @param {object} options
 * @param {string} options.channelSecret - LINE channel secret
 * @param {Function} options.onEvents - Callback for events
 * @returns {Function} Express middleware
 */
export function createWebhookMiddleware(options) {
  const { channelSecret, onEvents } = options;

  return async (req, res) => {
    // Get raw body
    const rawBody = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body);

    // Validate signature
    const signature = req.headers['x-line-signature'];
    if (!validateSignature(rawBody, signature, channelSecret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // CRITICAL: Respond immediately to avoid LINE timeout
    res.status(200).json({ status: 'ok' });

    // Process events asynchronously
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (body.events && body.events.length > 0 && onEvents) {
      try {
        await onEvents(body.events, body.destination);
      } catch (error) {
        console.error('[LINE] Webhook handler error:', error);
      }
    }
  };
}

// ============================================================
// Message Chunking
// ============================================================

/**
 * LINE API limits
 */
export const LINE_LIMITS = {
  MAX_REPLY_MESSAGES: 5,    // Max messages per reply token
  MAX_PUSH_MESSAGES: 5,     // Max messages per push call
  MAX_TEXT_LENGTH: 5000,    // Max text message length
  MAX_QUICK_REPLY_ITEMS: 13,
  MAX_QUICK_REPLY_LABEL: 20,
  MAX_FLEX_CAROUSEL: 10,
  MAX_FLEX_LIST_ITEMS: 8,
};

/**
 * Split text into chunks respecting LINE limits
 * @param {string} text - Text to split
 * @param {number} maxLength - Max length per chunk
 * @returns {string[]} Array of text chunks
 */
export function chunkText(text, maxLength = LINE_LIMITS.MAX_TEXT_LENGTH) {
  if (!text || text.length <= maxLength) {
    return text ? [text] : [];
  }

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find good break point (newline or space)
    let breakPoint = maxLength;

    // Try to break at double newline (paragraph)
    const paragraphBreak = remaining.lastIndexOf('\n\n', maxLength);
    if (paragraphBreak > maxLength * 0.5) {
      breakPoint = paragraphBreak + 2;
    } else {
      // Try single newline
      const lineBreak = remaining.lastIndexOf('\n', maxLength);
      if (lineBreak > maxLength * 0.5) {
        breakPoint = lineBreak + 1;
      } else {
        // Try space
        const spaceBreak = remaining.lastIndexOf(' ', maxLength);
        if (spaceBreak > maxLength * 0.5) {
          breakPoint = spaceBreak + 1;
        }
      }
    }

    chunks.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }

  return chunks;
}

/**
 * Split messages for LINE delivery
 * Returns batches suitable for reply (first) and push (rest)
 *
 * @param {object[]} messages - Array of LINE message objects
 * @returns {object} { replyBatch, pushBatches }
 */
export function splitForDelivery(messages) {
  const replyBatch = messages.slice(0, LINE_LIMITS.MAX_REPLY_MESSAGES);
  const remaining = messages.slice(LINE_LIMITS.MAX_REPLY_MESSAGES);

  // Split remaining into push batches
  const pushBatches = [];
  for (let i = 0; i < remaining.length; i += LINE_LIMITS.MAX_PUSH_MESSAGES) {
    pushBatches.push(remaining.slice(i, i + LINE_LIMITS.MAX_PUSH_MESSAGES));
  }

  return { replyBatch, pushBatches };
}

// ============================================================
// User Profile Cache
// ============================================================

/**
 * Profile cache TTL (5 minutes)
 */
const PROFILE_CACHE_TTL = 5 * 60 * 1000;

/**
 * In-memory profile cache
 */
const profileCache = new Map();

/**
 * Get user profile with caching
 * @param {string} userId - LINE user ID
 * @param {Function} fetchFn - Function to fetch profile from API
 * @returns {Promise<object>} User profile
 */
export async function getUserProfile(userId, fetchFn) {
  // Check cache
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < PROFILE_CACHE_TTL) {
    return cached.profile;
  }

  // Fetch fresh
  const profile = await fetchFn(userId);
  profileCache.set(userId, {
    profile,
    fetchedAt: Date.now(),
  });

  return profile;
}

/**
 * Invalidate cached profile
 * @param {string} userId
 */
export function invalidateProfile(userId) {
  profileCache.delete(userId);
}

/**
 * Clear all cached profiles
 */
export function clearProfileCache() {
  profileCache.clear();
}

/**
 * Get cache statistics
 * @returns {object} { size, entries }
 */
export function getProfileCacheStats() {
  const now = Date.now();
  let validCount = 0;
  let expiredCount = 0;

  for (const [, entry] of profileCache) {
    if (now - entry.fetchedAt < PROFILE_CACHE_TTL) {
      validCount++;
    } else {
      expiredCount++;
    }
  }

  return {
    size: profileCache.size,
    valid: validCount,
    expired: expiredCount,
  };
}

// ============================================================
// Quick Reply Helpers
// ============================================================

/**
 * Create quick reply items
 * @param {string[]} labels - Button labels
 * @returns {object} LINE QuickReply object
 */
export function createQuickReply(labels) {
  const items = labels
    .slice(0, LINE_LIMITS.MAX_QUICK_REPLY_ITEMS)
    .map(label => ({
      type: 'action',
      action: {
        type: 'message',
        label: label.slice(0, LINE_LIMITS.MAX_QUICK_REPLY_LABEL),
        text: label,
      },
    }));

  return { items };
}

/**
 * Attach quick reply to last message in array
 * @param {object[]} messages - Array of LINE messages
 * @param {string[]} labels - Quick reply labels
 * @returns {object[]} Messages with quick reply attached
 */
export function attachQuickReply(messages, labels) {
  if (!messages.length || !labels.length) {
    return messages;
  }

  const result = [...messages];
  const lastIndex = result.length - 1;
  result[lastIndex] = {
    ...result[lastIndex],
    quickReply: createQuickReply(labels),
  };

  return result;
}

// ============================================================
// Message Builders
// ============================================================

/**
 * Create text message
 * @param {string} text
 * @returns {object} LINE TextMessage
 */
export function createTextMessage(text) {
  return {
    type: 'text',
    text: text.slice(0, LINE_LIMITS.MAX_TEXT_LENGTH),
  };
}

/**
 * Create image message
 * @param {string} originalUrl - Full-size image URL
 * @param {string} previewUrl - Preview image URL (optional, defaults to original)
 * @returns {object} LINE ImageMessage
 */
export function createImageMessage(originalUrl, previewUrl) {
  return {
    type: 'image',
    originalContentUrl: originalUrl,
    previewImageUrl: previewUrl || originalUrl,
  };
}

/**
 * Create sticker message
 * @param {string} packageId - Sticker package ID
 * @param {string} stickerId - Sticker ID
 * @returns {object} LINE StickerMessage
 */
export function createStickerMessage(packageId, stickerId) {
  return {
    type: 'sticker',
    packageId: String(packageId),
    stickerId: String(stickerId),
  };
}

/**
 * Create location message
 * @param {string} title - Location name
 * @param {string} address - Full address
 * @param {number} latitude
 * @param {number} longitude
 * @returns {object} LINE LocationMessage
 */
export function createLocationMessage(title, address, latitude, longitude) {
  return {
    type: 'location',
    title,
    address,
    latitude,
    longitude,
  };
}

// ============================================================
// Markdown → Flex Conversion
// ============================================================

/**
 * Extract markdown tables from text
 * @param {string} text
 * @returns {object} { tables, cleanText }
 */
export function extractTables(text) {
  const tableRegex = /^\|(.+)\|\s*\n\|[-:\s|]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm;
  const tables = [];
  let cleanText = text;

  let match;
  while ((match = tableRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const headerRow = match[1].split('|').map(s => s.trim()).filter(Boolean);
    const bodyText = match[2];

    const rows = bodyText.trim().split('\n').map(row =>
      row.split('|').map(s => s.trim()).filter(Boolean)
    );

    tables.push({
      headers: headerRow,
      rows,
      original: fullMatch,
    });

    cleanText = cleanText.replace(fullMatch, '');
  }

  return { tables, cleanText: cleanText.trim() };
}

/**
 * Extract code blocks from text
 * @param {string} text
 * @returns {object} { codeBlocks, cleanText }
 */
export function extractCodeBlocks(text) {
  const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
  const codeBlocks = [];
  let cleanText = text;

  let match;
  while ((match = codeRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const language = match[1] || 'text';
    const code = match[2].trim();

    codeBlocks.push({
      language,
      code,
      original: fullMatch,
    });

    cleanText = cleanText.replace(fullMatch, '');
  }

  return { codeBlocks, cleanText: cleanText.trim() };
}

/**
 * Convert markdown table to Flex bubble
 * @param {object} table - { headers, rows }
 * @returns {object} Flex Bubble
 */
export function tableToFlexBubble(table) {
  const contents = [];

  // Header row
  if (table.headers.length > 0) {
    contents.push({
      type: 'box',
      layout: 'horizontal',
      contents: table.headers.map(h => ({
        type: 'text',
        text: h,
        weight: 'bold',
        size: 'sm',
        flex: 1,
      })),
      backgroundColor: '#f0f0f0',
      paddingAll: '8px',
    });
  }

  // Data rows
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    contents.push({
      type: 'box',
      layout: 'horizontal',
      contents: row.map(cell => ({
        type: 'text',
        text: cell,
        size: 'sm',
        flex: 1,
        wrap: true,
      })),
      backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8f8f8',
      paddingAll: '8px',
    });
  }

  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents,
      paddingAll: '0px',
    },
  };
}

/**
 * Convert code block to Flex bubble
 * @param {object} block - { language, code }
 * @returns {object} Flex Bubble
 */
export function codeBlockToFlexBubble(block) {
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        // Language header
        {
          type: 'text',
          text: block.language.toUpperCase() || 'CODE',
          size: 'xs',
          color: '#888888',
        },
        // Code content
        {
          type: 'text',
          text: block.code,
          size: 'sm',
          wrap: true,
          maxLines: 20,
        },
      ],
      backgroundColor: '#1e1e1e',
      paddingAll: '12px',
    },
    styles: {
      body: {
        backgroundColor: '#1e1e1e',
      },
    },
  };
}

/**
 * Process text and extract Flex messages
 * @param {string} text
 * @returns {object} { text, flexMessages }
 */
export function processMarkdownForLine(text) {
  if (!text) {
    return { text: '', flexMessages: [] };
  }

  const flexMessages = [];

  // Extract tables
  const { tables, cleanText: afterTables } = extractTables(text);
  for (const table of tables) {
    flexMessages.push({
      type: 'flex',
      altText: 'Table',
      contents: tableToFlexBubble(table),
    });
  }

  // Extract code blocks
  const { codeBlocks, cleanText: afterCode } = extractCodeBlocks(afterTables);
  for (const block of codeBlocks) {
    flexMessages.push({
      type: 'flex',
      altText: `Code: ${block.language}`,
      contents: codeBlockToFlexBubble(block),
    });
  }

  return {
    text: afterCode.trim(),
    flexMessages,
  };
}

// ============================================================
// Target ID Normalization
// ============================================================

/**
 * Normalize target ID (strip line: prefixes)
 * @param {string} target
 * @returns {string} Clean target ID
 */
export function normalizeTarget(target) {
  if (!target) return '';

  return target
    .replace(/^line:group:/, '')
    .replace(/^line:room:/, '')
    .replace(/^line:user:/, '')
    .replace(/^line:/, '');
}

/**
 * Detect target type from ID format
 * @param {string} target
 * @returns {string} 'user' | 'group' | 'room' | 'unknown'
 */
export function detectTargetType(target) {
  if (!target) return 'unknown';

  if (target.startsWith('U')) return 'user';
  if (target.startsWith('C')) return 'group';
  if (target.startsWith('R')) return 'room';

  return 'unknown';
}

// ============================================================
// Exports
// ============================================================

export default {
  // Webhook
  validateSignature,
  createWebhookMiddleware,

  // Limits
  LINE_LIMITS,

  // Chunking
  chunkText,
  splitForDelivery,

  // Profile cache
  getUserProfile,
  invalidateProfile,
  clearProfileCache,
  getProfileCacheStats,

  // Quick reply
  createQuickReply,
  attachQuickReply,

  // Message builders
  createTextMessage,
  createImageMessage,
  createStickerMessage,
  createLocationMessage,

  // Markdown → Flex
  extractTables,
  extractCodeBlocks,
  tableToFlexBubble,
  codeBlockToFlexBubble,
  processMarkdownForLine,

  // Target
  normalizeTarget,
  detectTargetType,
};
