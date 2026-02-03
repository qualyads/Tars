/**
 * Message Router - Hierarchical Routing จาก OpenClaw Pattern
 *
 * Features:
 * - Binding-based routing (peer → guild → account → channel → default)
 * - Session key generation/parsing
 * - Target resolution
 * - Route matching
 *
 * @module message-router
 */

// ============================================================
// Session Key Management
// ============================================================

/**
 * Session key components
 */
export const SESSION_KEY_PARTS = {
  AGENT: 'agent',
  CHANNEL: 'channel',
  ACCOUNT: 'account',
  PEER: 'peer',
  SCOPE: 'scope',
};

/**
 * DM scope modes
 */
export const DM_SCOPES = {
  MAIN: 'main',           // All DMs share one session
  PER_PEER: 'per-peer',   // Separate session per user
  PER_CHANNEL_PEER: 'per-channel-peer', // Per channel + user
  PER_ACCOUNT_CHANNEL_PEER: 'per-account-channel-peer', // Full isolation
};

/**
 * Generate session key
 * @param {object} params
 * @returns {string}
 */
export function generateSessionKey(params) {
  const {
    agentId = 'default',
    channel,
    accountId,
    peerId,
    scope = DM_SCOPES.PER_PEER,
  } = params;

  const parts = [`agent:${agentId}`];

  if (channel) {
    parts.push(`channel:${normalize(channel)}`);
  }

  if (accountId) {
    parts.push(`account:${normalize(accountId)}`);
  }

  if (peerId) {
    parts.push(`peer:${normalize(peerId)}`);
  }

  parts.push(`scope:${scope}`);

  return parts.join(':');
}

/**
 * Parse session key
 * @param {string} sessionKey
 * @returns {object}
 */
export function parseSessionKey(sessionKey) {
  if (!sessionKey) {
    return {
      agentId: null,
      channel: null,
      accountId: null,
      peerId: null,
      scope: null,
    };
  }

  const result = {
    agentId: null,
    channel: null,
    accountId: null,
    peerId: null,
    scope: null,
  };

  // Parse key:value pairs
  const parts = sessionKey.split(':');
  for (let i = 0; i < parts.length - 1; i += 2) {
    const key = parts[i];
    const value = parts[i + 1];

    switch (key) {
      case SESSION_KEY_PARTS.AGENT:
        result.agentId = value;
        break;
      case SESSION_KEY_PARTS.CHANNEL:
        result.channel = value;
        break;
      case SESSION_KEY_PARTS.ACCOUNT:
        result.accountId = value;
        break;
      case SESSION_KEY_PARTS.PEER:
        result.peerId = value;
        break;
      case SESSION_KEY_PARTS.SCOPE:
        result.scope = value;
        break;
    }
  }

  return result;
}

/**
 * Normalize string for matching (lowercase + trim)
 * @param {string} str
 * @returns {string}
 */
function normalize(str) {
  return str ? str.toLowerCase().trim() : '';
}

// ============================================================
// Binding-Based Routing
// ============================================================

/**
 * Binding match priorities (higher = more specific)
 */
export const MATCH_PRIORITY = {
  'binding.peer': 6,        // Direct user match
  'binding.peer.parent': 5, // Thread parent match
  'binding.guild': 4,       // Guild/workspace match
  'binding.team': 3,        // Team match
  'binding.account': 2,     // Account match
  'binding.channel': 1,     // Channel match
  'default': 0,             // Default fallback
};

/**
 * Create a route resolver
 * @param {object} options
 * @returns {object} Resolver API
 */
export function createRouteResolver(options = {}) {
  const {
    defaultAgentId = 'default',
    bindings = [],          // Array of binding rules
  } = options;

  /**
   * Add binding rule
   * @param {object} binding
   */
  function addBinding(binding) {
    bindings.push(binding);
    // Sort by specificity (most specific first)
    bindings.sort((a, b) => {
      const priorityA = getBindingPriority(a);
      const priorityB = getBindingPriority(b);
      return priorityB - priorityA;
    });
  }

  /**
   * Get binding priority
   * @param {object} binding
   * @returns {number}
   */
  function getBindingPriority(binding) {
    if (binding.peerId) return MATCH_PRIORITY['binding.peer'];
    if (binding.guildId) return MATCH_PRIORITY['binding.guild'];
    if (binding.teamId) return MATCH_PRIORITY['binding.team'];
    if (binding.accountId) return MATCH_PRIORITY['binding.account'];
    if (binding.channel) return MATCH_PRIORITY['binding.channel'];
    return MATCH_PRIORITY['default'];
  }

  /**
   * Resolve route for message
   * @param {object} params
   * @returns {object} Resolved route
   */
  function resolveRoute(params) {
    const {
      channel,
      accountId,
      peerId,
      guildId,
      teamId,
      parentPeerId,
    } = params;

    // Try to find matching binding
    for (const binding of bindings) {
      const match = matchBinding(binding, {
        channel: normalize(channel),
        accountId: normalize(accountId),
        peerId: normalize(peerId),
        guildId: normalize(guildId),
        teamId: normalize(teamId),
      });

      if (match) {
        return {
          agentId: binding.agentId || defaultAgentId,
          channel,
          accountId,
          peerId,
          sessionKey: generateSessionKey({
            agentId: binding.agentId || defaultAgentId,
            channel,
            accountId,
            peerId,
            scope: binding.dmScope || DM_SCOPES.PER_PEER,
          }),
          matchedBy: getMatchType(binding),
        };
      }
    }

    // Try parent peer (for threads)
    if (parentPeerId && parentPeerId !== peerId) {
      const parentRoute = resolveRoute({
        channel,
        accountId,
        peerId: parentPeerId,
        guildId,
        teamId,
      });

      if (parentRoute.matchedBy !== 'default') {
        return {
          ...parentRoute,
          peerId, // Keep original peer
          matchedBy: 'binding.peer.parent',
        };
      }
    }

    // Default route
    return {
      agentId: defaultAgentId,
      channel,
      accountId,
      peerId,
      sessionKey: generateSessionKey({
        agentId: defaultAgentId,
        channel,
        accountId,
        peerId,
      }),
      matchedBy: 'default',
    };
  }

  /**
   * Match binding against params
   * @param {object} binding
   * @param {object} params
   * @returns {boolean}
   */
  function matchBinding(binding, params) {
    // Peer match (most specific)
    if (binding.peerId) {
      if (normalize(binding.peerId) !== params.peerId) return false;
    }

    // Guild match
    if (binding.guildId) {
      if (normalize(binding.guildId) !== params.guildId) return false;
    }

    // Team match
    if (binding.teamId) {
      if (normalize(binding.teamId) !== params.teamId) return false;
    }

    // Account match (wildcard supported)
    if (binding.accountId && binding.accountId !== '*') {
      if (normalize(binding.accountId) !== params.accountId) return false;
    }

    // Channel match
    if (binding.channel) {
      if (normalize(binding.channel) !== params.channel) return false;
    }

    return true;
  }

  /**
   * Get match type string
   * @param {object} binding
   * @returns {string}
   */
  function getMatchType(binding) {
    if (binding.peerId) return 'binding.peer';
    if (binding.guildId) return 'binding.guild';
    if (binding.teamId) return 'binding.team';
    if (binding.accountId) return 'binding.account';
    if (binding.channel) return 'binding.channel';
    return 'default';
  }

  /**
   * Get all bindings
   * @returns {object[]}
   */
  function getBindings() {
    return [...bindings];
  }

  /**
   * Remove binding
   * @param {Function} predicate
   * @returns {number} Removed count
   */
  function removeBinding(predicate) {
    let removed = 0;
    for (let i = bindings.length - 1; i >= 0; i--) {
      if (predicate(bindings[i])) {
        bindings.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }

  return {
    addBinding,
    resolveRoute,
    getBindings,
    removeBinding,
  };
}

// ============================================================
// Message Routing Helpers
// ============================================================

/**
 * Resolve target (user/group lookup)
 * @param {object} params
 * @returns {object}
 */
export function resolveTarget(params) {
  const { to, channel } = params;

  if (!to) {
    return { valid: false, reason: 'No target specified' };
  }

  // Normalize target ID
  let targetId = to;
  let targetType = 'unknown';

  // LINE target detection
  if (channel === 'line') {
    if (to.startsWith('U')) {
      targetType = 'user';
    } else if (to.startsWith('C')) {
      targetType = 'group';
    } else if (to.startsWith('R')) {
      targetType = 'room';
    }
  }

  // Strip prefixes if present
  if (to.startsWith('line:')) {
    targetId = to.replace(/^line:(user|group|room):/, '');
  }

  return {
    valid: true,
    targetId,
    targetType,
    original: to,
  };
}

/**
 * Create conversation label
 * @param {object} params
 * @returns {string}
 */
export function createConversationLabel(params) {
  const { channel, peerId, peerName, groupName, isGroup } = params;

  const channelLabel = channel ? channel.toUpperCase() : 'MSG';

  if (isGroup && groupName) {
    return `${channelLabel}:${groupName}`;
  }

  if (peerName) {
    return `${channelLabel}:${peerName}`;
  }

  if (peerId) {
    return `${channelLabel}:${peerId.slice(-6)}`;
  }

  return channelLabel;
}

// ============================================================
// Exports
// ============================================================

export default {
  // Session keys
  SESSION_KEY_PARTS,
  DM_SCOPES,
  generateSessionKey,
  parseSessionKey,

  // Routing
  MATCH_PRIORITY,
  createRouteResolver,

  // Helpers
  resolveTarget,
  createConversationLabel,
};
