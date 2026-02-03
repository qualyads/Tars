/**
 * Channels - Channel Abstraction จาก OpenClaw Pattern
 *
 * Features:
 * - Chat type normalization (direct, group, channel)
 * - Typing indicators (callback-based)
 * - Sender label resolution
 * - Command gating (authorization)
 * - Ack reactions (scope-based)
 *
 * @module channels
 */

// ============================================================
// Chat Type Normalization
// ============================================================

/**
 * Valid chat types
 */
export const CHAT_TYPES = {
  DIRECT: 'direct',
  GROUP: 'group',
  CHANNEL: 'channel',
};

/**
 * Aliases for chat types
 */
const CHAT_TYPE_ALIASES = {
  dm: CHAT_TYPES.DIRECT,
  direct: CHAT_TYPES.DIRECT,
  private: CHAT_TYPES.DIRECT,
  group: CHAT_TYPES.GROUP,
  channel: CHAT_TYPES.CHANNEL,
  public: CHAT_TYPES.CHANNEL,
};

/**
 * Normalize chat type
 * @param {string} type - Raw chat type
 * @returns {string|undefined} Normalized type or undefined
 */
export function normalizeChatType(type) {
  if (!type) return undefined;
  const normalized = type.trim().toLowerCase();
  return CHAT_TYPE_ALIASES[normalized];
}

/**
 * Check if chat type is direct message
 * @param {string} type
 * @returns {boolean}
 */
export function isDirect(type) {
  return normalizeChatType(type) === CHAT_TYPES.DIRECT;
}

/**
 * Check if chat type is group
 * @param {string} type
 * @returns {boolean}
 */
export function isGroup(type) {
  return normalizeChatType(type) === CHAT_TYPES.GROUP;
}

/**
 * Check if chat type is channel
 * @param {string} type
 * @returns {boolean}
 */
export function isChannel(type) {
  return normalizeChatType(type) === CHAT_TYPES.CHANNEL;
}

// ============================================================
// Typing Indicators
// ============================================================

/**
 * Create typing indicator manager
 * @param {object} callbacks
 * @param {Function} callbacks.onStart - Called when typing starts
 * @param {Function} callbacks.onStop - Called when typing stops
 * @returns {object} Typing manager
 */
export function createTypingManager(callbacks = {}) {
  let isTyping = false;

  async function start() {
    if (isTyping) return;
    isTyping = true;

    try {
      if (callbacks.onStart) {
        await callbacks.onStart();
      }
    } catch (err) {
      console.error('[TYPING] Start error:', err.message);
    }
  }

  async function stop() {
    if (!isTyping) return;
    isTyping = false;

    try {
      if (callbacks.onStop) {
        // Don't await - fire and forget
        callbacks.onStop().catch((err) => {
          console.error('[TYPING] Stop error:', err.message);
        });
      }
    } catch (err) {
      console.error('[TYPING] Stop error:', err.message);
    }
  }

  function getStatus() {
    return isTyping;
  }

  return {
    start,
    stop,
    getStatus,
  };
}

// ============================================================
// Sender Label Resolution
// ============================================================

/**
 * Sender info structure
 * @typedef {object} SenderInfo
 * @property {string} [name] - Display name
 * @property {string} [username] - Username
 * @property {string} [tag] - Tag (e.g., Discord tag)
 * @property {string} [e164] - Phone number (E.164 format)
 * @property {string} [id] - User ID
 */

/**
 * Resolve sender label (priority-based)
 * @param {SenderInfo} sender
 * @returns {string} Display label
 */
export function resolveSenderLabel(sender) {
  if (!sender) return 'Unknown';

  // Priority: name > username > tag > e164 > id
  const display = sender.name || sender.username || sender.tag;
  const identifier = sender.e164 || sender.id;

  if (display && identifier && display !== identifier) {
    return `${display} (${identifier})`;
  }

  return display || identifier || 'Unknown';
}

/**
 * List all sender label candidates
 * @param {SenderInfo} sender
 * @returns {string[]} All possible labels
 */
export function listSenderLabelCandidates(sender) {
  if (!sender) return [];

  const candidates = [];

  if (sender.name) candidates.push(sender.name);
  if (sender.username) candidates.push(sender.username);
  if (sender.tag) candidates.push(sender.tag);
  if (sender.e164) candidates.push(sender.e164);
  if (sender.id) candidates.push(sender.id);

  // Add combined format
  const display = sender.name || sender.username || sender.tag;
  const identifier = sender.e164 || sender.id;
  if (display && identifier && display !== identifier) {
    candidates.push(`${display} (${identifier})`);
  }

  return [...new Set(candidates)]; // Remove duplicates
}

// ============================================================
// Command Gating (Authorization)
// ============================================================

/**
 * Gating modes
 */
export const GATING_MODES = {
  ALLOW: 'allow',
  DENY: 'deny',
  CONFIGURED: 'configured',
};

/**
 * Authorizer structure
 * @typedef {object} Authorizer
 * @property {boolean} configured - Is this authorizer configured
 * @property {boolean} allowed - Is the user allowed
 */

/**
 * Check if command is allowed
 * @param {object} params
 * @param {boolean} params.useAccessGroups - Is access groups enabled
 * @param {Authorizer[]} params.authorizers - List of authorizers
 * @param {string} params.mode - Fallback mode when access groups disabled
 * @returns {boolean} Is allowed
 */
export function isCommandAllowed(params) {
  const { useAccessGroups = false, authorizers = [], mode = GATING_MODES.ALLOW } = params;

  // If access groups enabled, need at least one authorizer to allow
  if (useAccessGroups) {
    return authorizers.some((auth) => auth.configured && auth.allowed);
  }

  // Access groups disabled - use fallback mode
  switch (mode) {
    case GATING_MODES.ALLOW:
      return true;
    case GATING_MODES.DENY:
      return false;
    case GATING_MODES.CONFIGURED:
      return authorizers.some((auth) => auth.configured);
    default:
      return true;
  }
}

/**
 * Create authorizer from role check
 * @param {string[]} userRoles - User's roles
 * @param {string[]} allowedRoles - Roles that are allowed
 * @returns {Authorizer}
 */
export function createRoleAuthorizer(userRoles, allowedRoles) {
  const configured = allowedRoles && allowedRoles.length > 0;
  const allowed = configured && userRoles.some((role) => allowedRoles.includes(role));

  return { configured, allowed };
}

/**
 * Create authorizer from user ID check
 * @param {string} userId - User ID
 * @param {string[]} allowedUsers - Allowed user IDs
 * @returns {Authorizer}
 */
export function createUserAuthorizer(userId, allowedUsers) {
  const configured = allowedUsers && allowedUsers.length > 0;
  const allowed = configured && allowedUsers.includes(userId);

  return { configured, allowed };
}

// ============================================================
// Ack Reactions (Scope-based)
// ============================================================

/**
 * Ack reaction scopes
 */
export const ACK_SCOPES = {
  ALL: 'all',
  DIRECT: 'direct',
  GROUP_ALL: 'group-all',
  GROUP_MENTIONS: 'group-mentions',
  OFF: 'off',
  NONE: 'none',
};

/**
 * Check if should send ack reaction
 * @param {object} params
 * @param {string} params.scope - Ack scope setting
 * @param {string} params.chatType - Chat type (direct, group, channel)
 * @param {boolean} params.wasMentioned - Was the bot mentioned
 * @param {boolean} params.canDetectMention - Can detect mentions in this context
 * @returns {boolean} Should send ack
 */
export function shouldSendAck(params) {
  const { scope = ACK_SCOPES.ALL, chatType, wasMentioned = false, canDetectMention = true } = params;

  // Off/None = never
  if (scope === ACK_SCOPES.OFF || scope === ACK_SCOPES.NONE) {
    return false;
  }

  // All = always
  if (scope === ACK_SCOPES.ALL) {
    return true;
  }

  const normalizedType = normalizeChatType(chatType);

  // Direct only
  if (scope === ACK_SCOPES.DIRECT) {
    return normalizedType === CHAT_TYPES.DIRECT;
  }

  // Group all
  if (scope === ACK_SCOPES.GROUP_ALL) {
    return normalizedType === CHAT_TYPES.GROUP || normalizedType === CHAT_TYPES.CHANNEL;
  }

  // Group mentions only
  if (scope === ACK_SCOPES.GROUP_MENTIONS) {
    if (normalizedType === CHAT_TYPES.DIRECT) {
      return true; // Always ack DMs
    }
    if (!canDetectMention) {
      return false; // Can't detect, don't ack
    }
    return wasMentioned;
  }

  return false;
}

// ============================================================
// Exports
// ============================================================

export default {
  // Chat types
  CHAT_TYPES,
  normalizeChatType,
  isDirect,
  isGroup,
  isChannel,

  // Typing
  createTypingManager,

  // Sender labels
  resolveSenderLabel,
  listSenderLabelCandidates,

  // Command gating
  GATING_MODES,
  isCommandAllowed,
  createRoleAuthorizer,
  createUserAuthorizer,

  // Ack reactions
  ACK_SCOPES,
  shouldSendAck,
};
