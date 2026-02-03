/**
 * Context Builder - Message Context System จาก OpenClaw Pattern
 *
 * Features:
 * - MsgContext schema (multi-body types)
 * - Template interpolation ({{variable}})
 * - Context finalization (normalize + compute)
 * - Sender metadata
 *
 * @module context-builder
 */

// ============================================================
// MsgContext Schema
// ============================================================

/**
 * Create a message context object
 * @param {object} options
 * @returns {object} MsgContext
 */
export function createMsgContext(options = {}) {
  const now = Date.now();

  return {
    // Body variants (for different uses)
    Body: options.body || '',
    BodyForAgent: options.bodyForAgent || options.body || '',
    BodyForCommands: options.bodyForCommands || options.body || '',
    RawBody: options.rawBody || options.body || '',

    // Message metadata
    MessageId: options.messageId || `msg_${now}`,
    Timestamp: options.timestamp || now,
    PreviousTimestamp: options.previousTimestamp || null,

    // Channel info
    Provider: options.provider || 'LINE',
    Channel: options.channel || 'DM',
    ChatType: options.chatType || 'direct', // 'direct' | 'group' | 'channel'

    // Sender info
    From: options.from || '',
    FromId: options.fromId || '',
    FromName: options.fromName || options.from || '',
    SenderLabel: options.senderLabel || '',

    // Target info
    To: options.to || '',
    ToId: options.toId || '',

    // Group info (if applicable)
    GroupId: options.groupId || '',
    GroupName: options.groupName || '',
    GroupSubject: options.groupSubject || options.groupName || '',

    // State
    SessionKey: options.sessionKey || '',
    IsReply: options.isReply || false,
    ReplyToId: options.replyToId || null,
    CommandAuthorized: options.commandAuthorized || false,

    // Media
    HasMedia: options.hasMedia || false,
    MediaType: options.mediaType || null,
    MediaUrl: options.mediaUrl || null,

    // Custom fields
    Metadata: options.metadata || {},
  };
}

// ============================================================
// Context Finalization
// ============================================================

/**
 * Normalize newlines in text (consistent line endings)
 * @param {string} text
 * @returns {string}
 */
function normalizeNewlines(text) {
  if (!text) return '';
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Normalize chat type
 * @param {string} chatType
 * @returns {string} 'direct' | 'group' | 'channel'
 */
function normalizeChatType(chatType) {
  const normalized = String(chatType || '').toLowerCase().trim();

  const groupTypes = ['group', 'room', 'supergroup', 'groupchat', 'multiuserchat'];
  const channelTypes = ['channel', 'broadcast'];
  const directTypes = ['direct', 'dm', 'private', 'personal', 'user'];

  if (groupTypes.includes(normalized)) return 'group';
  if (channelTypes.includes(normalized)) return 'channel';
  if (directTypes.includes(normalized)) return 'direct';

  return 'direct'; // Default
}

/**
 * Resolve sender label (display name)
 * @param {object} params
 * @returns {string}
 */
function resolveSenderLabel(params) {
  const { fromName, from, fromId, senderLabel } = params;

  // Priority: senderLabel > fromName > from > fromId
  if (senderLabel?.trim()) return senderLabel.trim();
  if (fromName?.trim()) return fromName.trim();
  if (from?.trim()) return from.trim();
  if (fromId?.trim()) return fromId.trim();

  return 'Unknown';
}

/**
 * Finalize inbound context (normalize + compute defaults)
 * @param {object} ctx - Raw context
 * @param {object} options
 * @returns {object} Finalized context
 */
export function finalizeContext(ctx, options = {}) {
  const finalized = { ...ctx };

  // Step 1: Normalize all text fields
  finalized.Body = normalizeNewlines(finalized.Body);
  finalized.BodyForAgent = normalizeNewlines(finalized.BodyForAgent || finalized.Body);
  finalized.BodyForCommands = normalizeNewlines(finalized.BodyForCommands || finalized.Body);
  finalized.RawBody = normalizeNewlines(finalized.RawBody || finalized.Body);

  // Step 2: Normalize chat type
  finalized.ChatType = normalizeChatType(finalized.ChatType);

  // Step 3: Resolve sender label
  finalized.SenderLabel = resolveSenderLabel({
    fromName: finalized.FromName,
    from: finalized.From,
    fromId: finalized.FromId,
    senderLabel: finalized.SenderLabel,
  });

  // Step 4: Set secure defaults
  finalized.CommandAuthorized = finalized.CommandAuthorized === true;

  // Step 5: Add sender prefix for groups
  if (finalized.ChatType !== 'direct' && finalized.SenderLabel) {
    if (!finalized.BodyForAgent.startsWith(finalized.SenderLabel + ':')) {
      finalized.BodyForAgent = `${finalized.SenderLabel}: ${finalized.BodyForAgent}`;
    }
  }

  // Step 6: Set timestamp if not set
  if (!finalized.Timestamp) {
    finalized.Timestamp = Date.now();
  }

  return finalized;
}

// ============================================================
// Template Interpolation
// ============================================================

/**
 * Format template value (type coercion)
 * @param {*} value
 * @returns {string}
 */
function formatTemplateValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object') return '';
  return String(value);
}

/**
 * Apply template interpolation
 * Replace {{variable}} with values from context
 *
 * @param {string} template - Template string
 * @param {object} ctx - Context object
 * @returns {string} Interpolated string
 */
export function applyTemplate(template, ctx) {
  if (!template) return '';

  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
    const value = ctx[key];
    return formatTemplateValue(value);
  });
}

/**
 * Extract template variables from string
 * @param {string} template
 * @returns {string[]} Variable names
 */
export function extractTemplateVariables(template) {
  if (!template) return [];

  const matches = template.match(/{{\s*(\w+)\s*}}/g) || [];
  return [...new Set(matches.map(m => m.replace(/[{}\s]/g, '')))];
}

// ============================================================
// Envelope Formatting
// ============================================================

/**
 * Format elapsed time
 * @param {number} currentTs
 * @param {number} previousTs
 * @returns {string|null}
 */
function formatElapsedTime(currentTs, previousTs) {
  if (!previousTs || !currentTs) return null;

  const diff = currentTs - previousTs;
  if (diff < 0) return null;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  if (seconds > 0) return `${seconds}s`;
  return null;
}

/**
 * Format timestamp for envelope
 * @param {number|Date} ts
 * @param {string} mode - 'utc' | 'local' | timezone string
 * @returns {string}
 */
function formatEnvelopeTimestamp(ts, mode = 'local') {
  const date = ts instanceof Date ? ts : new Date(ts);

  if (mode === 'utc') {
    return date.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
  }

  // Local format
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format message envelope
 * Creates a header like: [Channel From +elapsed timestamp]
 *
 * @param {object} params
 * @param {string} params.channel - Channel name (e.g., LINE, Telegram)
 * @param {string} params.from - Sender identifier
 * @param {string} params.body - Message body
 * @param {number} params.timestamp - Current timestamp
 * @param {number} params.previousTimestamp - Previous message timestamp
 * @param {string} params.timestampMode - 'utc' | 'local'
 * @returns {string}
 */
export function formatEnvelope(params) {
  const {
    channel = 'Message',
    from,
    body,
    timestamp,
    previousTimestamp,
    timestampMode = 'local',
  } = params;

  const parts = [channel.trim()];

  // Add sender with elapsed time
  const elapsed = formatElapsedTime(timestamp, previousTimestamp);
  if (from?.trim()) {
    parts.push(elapsed ? `${from.trim()} +${elapsed}` : from.trim());
  } else if (elapsed) {
    parts.push(`+${elapsed}`);
  }

  // Add timestamp
  if (timestamp) {
    parts.push(formatEnvelopeTimestamp(timestamp, timestampMode));
  }

  const header = `[${parts.join(' ')}]`;
  return body ? `${header} ${body}` : header;
}

/**
 * Format inbound message with envelope
 * @param {object} ctx - Message context
 * @returns {string}
 */
export function formatInboundWithEnvelope(ctx) {
  const isGroup = ctx.ChatType !== 'direct';

  // Build from label
  let from = ctx.SenderLabel || ctx.From || '';
  if (isGroup && ctx.GroupName) {
    from = ctx.GroupName + (ctx.GroupId ? ` id:${ctx.GroupId}` : '');
  }

  // Body with sender prefix for groups
  let body = ctx.Body || '';
  if (isGroup && ctx.SenderLabel && !body.startsWith(ctx.SenderLabel + ':')) {
    body = `${ctx.SenderLabel}: ${body}`;
  }

  return formatEnvelope({
    channel: ctx.Provider || 'Message',
    from,
    body,
    timestamp: ctx.Timestamp,
    previousTimestamp: ctx.PreviousTimestamp,
  });
}

// ============================================================
// Human Delay
// ============================================================

/**
 * Default human delay config
 */
const DEFAULT_HUMAN_DELAY = {
  minMs: 800,
  maxMs: 2500,
  enabled: true,
};

/**
 * Get human delay in milliseconds
 * @param {object} config
 * @returns {number}
 */
export function getHumanDelay(config = {}) {
  const { minMs, maxMs, enabled } = { ...DEFAULT_HUMAN_DELAY, ...config };

  if (!enabled) return 0;

  // Random delay between min and max
  return minMs + Math.floor(Math.random() * (maxMs - minMs));
}

/**
 * Sleep for human delay
 * @param {object} config
 * @returns {Promise<void>}
 */
export function sleepHumanDelay(config = {}) {
  const delay = getHumanDelay(config);
  return new Promise(resolve => setTimeout(resolve, delay));
}

// ============================================================
// Context Helpers
// ============================================================

/**
 * Check if context is from a group
 * @param {object} ctx
 * @returns {boolean}
 */
export function isGroupContext(ctx) {
  return ctx.ChatType === 'group' || ctx.ChatType === 'channel';
}

/**
 * Get conversation label
 * @param {object} ctx
 * @returns {string}
 */
export function getConversationLabel(ctx) {
  if (isGroupContext(ctx)) {
    return ctx.GroupName || ctx.GroupSubject || ctx.GroupId || 'Group';
  }
  return ctx.SenderLabel || ctx.From || ctx.FromId || 'DM';
}

/**
 * Clone context with modifications
 * @param {object} ctx - Original context
 * @param {object} modifications
 * @returns {object} New context
 */
export function withContext(ctx, modifications) {
  return { ...ctx, ...modifications };
}

/**
 * Create context from LINE event
 * @param {object} event - LINE webhook event
 * @returns {object} MsgContext
 */
export function createContextFromLineEvent(event) {
  const source = event.source || {};
  const message = event.message || {};

  const isGroup = source.type === 'group' || source.type === 'room';

  return createMsgContext({
    body: message.text || '',
    messageId: message.id || event.webhookEventId,
    timestamp: event.timestamp,
    provider: 'LINE',
    chatType: isGroup ? 'group' : 'direct',
    from: source.userId || '',
    fromId: source.userId || '',
    groupId: source.groupId || source.roomId || '',
    hasMedia: message.type !== 'text',
    mediaType: message.type !== 'text' ? message.type : null,
    metadata: {
      replyToken: event.replyToken,
      webhookEventId: event.webhookEventId,
      sourceType: source.type,
    },
  });
}

// ============================================================
// Exports
// ============================================================

export default {
  // Context creation
  createMsgContext,
  finalizeContext,

  // Template
  applyTemplate,
  extractTemplateVariables,

  // Envelope
  formatEnvelope,
  formatInboundWithEnvelope,

  // Human delay
  getHumanDelay,
  sleepHumanDelay,

  // Helpers
  isGroupContext,
  getConversationLabel,
  withContext,
  createContextFromLineEvent,
};
