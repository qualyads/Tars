/**
 * Routing - Message Routing จาก OpenClaw Pattern
 *
 * Features:
 * - Agent bindings (map channel/account → agent)
 * - Route resolution (priority-based matching)
 * - Session key generation
 * - Account normalization
 *
 * @module routing
 */

// ============================================================
// Constants
// ============================================================

/**
 * Default values
 */
export const DEFAULTS = {
  agentId: 'main',
  accountId: 'default',
  channel: 'unknown',
};

/**
 * DM Scope options
 */
export const DM_SCOPES = {
  MAIN: 'main',
  PER_PEER: 'per-peer',
  PER_CHANNEL_PEER: 'per-channel-peer',
  PER_ACCOUNT_CHANNEL_PEER: 'per-account-channel-peer',
};

/**
 * Peer kinds
 */
export const PEER_KINDS = {
  DM: 'dm',
  GROUP: 'group',
  CHANNEL: 'channel',
};

// ============================================================
// Normalization
// ============================================================

/**
 * Normalize agent ID
 * - lowercase
 * - replace invalid chars with -
 * - max 64 chars
 * @param {string} agentId
 * @returns {string}
 */
export function normalizeAgentId(agentId) {
  if (!agentId) return DEFAULTS.agentId;

  return agentId
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || DEFAULTS.agentId;
}

/**
 * Normalize account ID
 * @param {string} accountId
 * @returns {string}
 */
export function normalizeAccountId(accountId) {
  if (!accountId) return DEFAULTS.accountId;

  return accountId
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || DEFAULTS.accountId;
}

/**
 * Normalize channel name
 * @param {string} channel
 * @returns {string}
 */
export function normalizeChannel(channel) {
  if (!channel) return DEFAULTS.channel;
  return channel.toLowerCase().trim() || DEFAULTS.channel;
}

/**
 * Normalize peer ID
 * @param {string} peerId
 * @returns {string}
 */
export function normalizePeerId(peerId) {
  if (!peerId) return '';
  return peerId.trim();
}

// ============================================================
// Session Key Generation
// ============================================================

/**
 * Generate session key
 * @param {object} params
 * @param {string} params.agentId - Agent ID
 * @param {string} params.channel - Channel name
 * @param {string} params.accountId - Account ID
 * @param {object} params.peer - Peer info { kind, id }
 * @param {string} params.dmScope - DM scope
 * @param {string} params.threadId - Thread ID (optional)
 * @returns {string} Session key
 */
export function generateSessionKey(params) {
  const {
    agentId = DEFAULTS.agentId,
    channel = DEFAULTS.channel,
    accountId = DEFAULTS.accountId,
    peer,
    dmScope = DM_SCOPES.MAIN,
    threadId,
  } = params;

  const agent = normalizeAgentId(agentId);
  const ch = normalizeChannel(channel);
  const acc = normalizeAccountId(accountId);

  const parts = ['agent', agent];

  // Handle different peer kinds
  if (!peer) {
    // No peer = main session
    parts.push('main');
  } else if (peer.kind === PEER_KINDS.DM) {
    // DM - depends on scope
    switch (dmScope) {
      case DM_SCOPES.MAIN:
        parts.push('main');
        break;
      case DM_SCOPES.PER_PEER:
        parts.push('dm', normalizePeerId(peer.id));
        break;
      case DM_SCOPES.PER_CHANNEL_PEER:
        parts.push(ch, 'dm', normalizePeerId(peer.id));
        break;
      case DM_SCOPES.PER_ACCOUNT_CHANNEL_PEER:
        parts.push(ch, acc, 'dm', normalizePeerId(peer.id));
        break;
      default:
        parts.push('main');
    }
  } else {
    // Group or Channel
    parts.push(ch, peer.kind, normalizePeerId(peer.id));
  }

  // Add thread if present
  if (threadId) {
    parts.push('thread', threadId);
  }

  return parts.join(':');
}

/**
 * Parse session key
 * @param {string} sessionKey
 * @returns {object} Parsed components
 */
export function parseSessionKey(sessionKey) {
  const parts = sessionKey.split(':');

  if (parts[0] !== 'agent' || parts.length < 3) {
    return null;
  }

  const result = {
    agentId: parts[1],
    raw: sessionKey,
  };

  // Find channel and peer kind
  const restParts = parts.slice(2);

  if (restParts[0] === 'main') {
    result.scope = 'main';
  } else if (restParts.includes('dm')) {
    const dmIndex = restParts.indexOf('dm');
    result.scope = 'dm';
    result.peerId = restParts[dmIndex + 1];
    if (dmIndex > 0) {
      result.channel = restParts[0];
      if (dmIndex > 1) {
        result.accountId = restParts[1];
      }
    }
  } else if (restParts.includes('group') || restParts.includes('channel')) {
    const kindIndex = restParts.findIndex((p) => p === 'group' || p === 'channel');
    result.scope = restParts[kindIndex];
    result.channel = restParts[0];
    result.peerId = restParts[kindIndex + 1];
  }

  // Check for thread
  const threadIndex = restParts.indexOf('thread');
  if (threadIndex !== -1) {
    result.threadId = restParts[threadIndex + 1];
  }

  return result;
}

/**
 * Get parent session key (remove thread)
 * @param {string} sessionKey
 * @returns {string|null} Parent key or null
 */
export function getParentSessionKey(sessionKey) {
  const threadIndex = sessionKey.indexOf(':thread:');
  if (threadIndex === -1) {
    return null;
  }
  return sessionKey.slice(0, threadIndex);
}

// ============================================================
// Route Resolution
// ============================================================

/**
 * Binding structure
 * @typedef {object} Binding
 * @property {string} agentId - Target agent ID
 * @property {string} [channel] - Channel filter
 * @property {string} [accountId] - Account ID filter (* = wildcard)
 * @property {object} [peer] - Peer filter { kind, id }
 * @property {string} [guildId] - Discord guild ID
 * @property {string} [teamId] - Slack team ID
 */

/**
 * Resolve route to agent
 * @param {object} params
 * @param {Binding[]} params.bindings - Agent bindings
 * @param {string} params.channel - Channel name
 * @param {string} params.accountId - Account ID
 * @param {object} params.peer - Peer info
 * @param {object} params.parentPeer - Parent peer (for threads)
 * @param {string} params.guildId - Discord guild ID
 * @param {string} params.teamId - Slack team ID
 * @param {string} params.defaultAgent - Default agent ID
 * @returns {object} Resolved route
 */
export function resolveRoute(params) {
  const {
    bindings = [],
    channel,
    accountId,
    peer,
    parentPeer,
    guildId,
    teamId,
    defaultAgent = DEFAULTS.agentId,
  } = params;

  const ch = normalizeChannel(channel);
  const acc = normalizeAccountId(accountId);

  // Priority order matching
  for (const binding of bindings) {
    // 1. Exact peer match
    if (binding.peer && peer) {
      if (binding.peer.kind === peer.kind && binding.peer.id === peer.id) {
        return createRouteResult(binding.agentId, ch, acc, 'binding.peer');
      }
    }

    // 2. Parent peer match (threads)
    if (binding.peer && parentPeer) {
      if (binding.peer.kind === parentPeer.kind && binding.peer.id === parentPeer.id) {
        return createRouteResult(binding.agentId, ch, acc, 'binding.peer.parent');
      }
    }

    // 3. Guild ID match (Discord)
    if (binding.guildId && guildId) {
      if (binding.guildId === guildId) {
        return createRouteResult(binding.agentId, ch, acc, 'binding.guildId');
      }
    }

    // 4. Team ID match (Slack)
    if (binding.teamId && teamId) {
      if (binding.teamId === teamId) {
        return createRouteResult(binding.agentId, ch, acc, 'binding.teamId');
      }
    }

    // 5. Account ID match (non-wildcard)
    if (binding.accountId && binding.accountId !== '*' && binding.channel === ch) {
      if (binding.accountId === acc) {
        return createRouteResult(binding.agentId, ch, acc, 'binding.accountId');
      }
    }

    // 6. Channel match with wildcard account
    if (binding.channel === ch && binding.accountId === '*') {
      return createRouteResult(binding.agentId, ch, acc, 'binding.channel');
    }
  }

  // 7. Default agent
  return createRouteResult(defaultAgent, ch, acc, 'default');
}

/**
 * Create route result object
 */
function createRouteResult(agentId, channel, accountId, matchedBy) {
  return {
    agentId: normalizeAgentId(agentId),
    channel,
    accountId,
    matchedBy,
  };
}

// ============================================================
// Binding Management
// ============================================================

/**
 * Create a binding
 * @param {object} params
 * @returns {Binding}
 */
export function createBinding(params) {
  const { agentId, channel, accountId, peer, guildId, teamId } = params;

  return {
    agentId: normalizeAgentId(agentId),
    channel: channel ? normalizeChannel(channel) : undefined,
    accountId: accountId || undefined,
    peer: peer || undefined,
    guildId: guildId || undefined,
    teamId: teamId || undefined,
  };
}

/**
 * List bound account IDs for a channel
 * @param {Binding[]} bindings
 * @param {string} channel
 * @returns {string[]}
 */
export function listBoundAccountIds(bindings, channel) {
  const ch = normalizeChannel(channel);
  const accounts = new Set();

  for (const binding of bindings) {
    if (binding.channel === ch && binding.accountId && binding.accountId !== '*') {
      accounts.add(binding.accountId);
    }
  }

  return Array.from(accounts);
}

// ============================================================
// Exports
// ============================================================

export default {
  // Constants
  DEFAULTS,
  DM_SCOPES,
  PEER_KINDS,

  // Normalization
  normalizeAgentId,
  normalizeAccountId,
  normalizeChannel,
  normalizePeerId,

  // Session keys
  generateSessionKey,
  parseSessionKey,
  getParentSessionKey,

  // Routing
  resolveRoute,
  createBinding,
  listBoundAccountIds,
};
