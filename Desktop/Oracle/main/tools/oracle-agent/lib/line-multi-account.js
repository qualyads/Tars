/**
 * LINE Multi-Account Manager - Based on OpenClaw Pattern
 *
 * Manage multiple LINE accounts with different:
 * - Channel tokens
 * - Personas/personalities
 * - Response styles
 * - Contexts
 *
 * Use cases:
 * - Hotel account (formal, booking-focused)
 * - Personal account (casual, Tars-focused)
 * - Business account (professional)
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  defaultAccount: 'default',
  accountsFile: 'line-accounts.json',
};

// =============================================================================
// ACCOUNT REGISTRY
// =============================================================================

/**
 * In-memory account registry
 */
const accounts = new Map();

/**
 * Account schema
 */
const accountSchema = {
  id: '',                    // Unique identifier
  name: '',                  // Display name
  channelToken: '',          // LINE Channel Access Token
  channelSecret: '',         // LINE Channel Secret (optional, for verification)
  persona: {
    name: '',                // Bot name
    personality: '',         // Personality description
    language: 'th',          // Primary language
    formality: 'casual',     // casual | formal | professional
  },
  context: {
    systemPrompt: '',        // Base system prompt for this account
    additionalContext: '',   // Extra context to include
  },
  settings: {
    enabled: true,           // Account active
    logMessages: true,       // Log all messages
    allowedUsers: [],        // Whitelist (empty = allow all)
    blockedUsers: [],        // Blacklist
  },
  metadata: {
    createdAt: null,
    lastUsed: null,
    messageCount: 0,
  }
};

// =============================================================================
// ACCOUNT MANAGEMENT
// =============================================================================

/**
 * Register a new LINE account
 */
function registerAccount(config) {
  const account = {
    ...accountSchema,
    ...config,
    id: config.id || generateId(),
    metadata: {
      createdAt: new Date().toISOString(),
      lastUsed: null,
      messageCount: 0,
    }
  };

  // Validate required fields
  if (!account.channelToken) {
    throw new Error('Channel token is required');
  }

  accounts.set(account.id, account);
  console.log(`[LINE-MULTI] Registered account: ${account.id} (${account.name || 'unnamed'})`);

  return account;
}

/**
 * Get account by ID
 */
function getAccount(id) {
  return accounts.get(id) || null;
}

/**
 * Get account by webhook source (userId or groupId)
 */
function getAccountBySource(source) {
  // Check if source matches any account's allowed users
  for (const [id, account] of accounts) {
    if (account.settings.allowedUsers?.includes(source)) {
      return account;
    }
  }

  // Return default account
  return accounts.get(CONFIG.defaultAccount) || null;
}

/**
 * Update account
 */
function updateAccount(id, updates) {
  const account = accounts.get(id);
  if (!account) {
    throw new Error(`Account not found: ${id}`);
  }

  const updated = deepMerge(account, updates);
  accounts.set(id, updated);

  return updated;
}

/**
 * Remove account
 */
function removeAccount(id) {
  if (accounts.has(id)) {
    accounts.delete(id);
    console.log(`[LINE-MULTI] Removed account: ${id}`);
    return true;
  }
  return false;
}

/**
 * List all accounts
 */
function listAccounts() {
  return Array.from(accounts.values()).map(acc => ({
    id: acc.id,
    name: acc.name,
    enabled: acc.settings.enabled,
    persona: acc.persona.name,
    messageCount: acc.metadata.messageCount,
    lastUsed: acc.metadata.lastUsed,
  }));
}

// =============================================================================
// MESSAGE ROUTING
// =============================================================================

/**
 * Route incoming webhook to correct account
 */
function routeWebhook(event) {
  const source = event.source;
  let accountId = null;

  // Check for account hint in webhook (custom implementation)
  if (event._accountId) {
    accountId = event._accountId;
  }

  // Try to find by source
  if (!accountId && source) {
    const sourceId = source.userId || source.groupId || source.roomId;

    for (const [id, account] of accounts) {
      // Check whitelist
      if (account.settings.allowedUsers?.length > 0) {
        if (account.settings.allowedUsers.includes(sourceId)) {
          accountId = id;
          break;
        }
      }
    }
  }

  // Fall back to default
  if (!accountId) {
    accountId = CONFIG.defaultAccount;
  }

  const account = accounts.get(accountId);
  if (!account) {
    console.warn(`[LINE-MULTI] No account found for routing, using first available`);
    return accounts.values().next().value || null;
  }

  // Update usage stats
  account.metadata.lastUsed = new Date().toISOString();
  account.metadata.messageCount++;

  return account;
}

/**
 * Check if user is allowed for account
 */
function isUserAllowed(account, userId) {
  // Check blocklist first
  if (account.settings.blockedUsers?.includes(userId)) {
    return false;
  }

  // If whitelist exists and is not empty, check it
  if (account.settings.allowedUsers?.length > 0) {
    return account.settings.allowedUsers.includes(userId);
  }

  // No restrictions
  return true;
}

// =============================================================================
// PERSONA SYSTEM
// =============================================================================

/**
 * Get system prompt for account
 */
function getAccountSystemPrompt(account) {
  const parts = [];

  // Base context
  if (account.context.systemPrompt) {
    parts.push(account.context.systemPrompt);
  }

  // Persona info
  if (account.persona.name || account.persona.personality) {
    parts.push(`\n## Your Persona`);
    if (account.persona.name) {
      parts.push(`Name: ${account.persona.name}`);
    }
    if (account.persona.personality) {
      parts.push(`Personality: ${account.persona.personality}`);
    }
    if (account.persona.language) {
      parts.push(`Primary Language: ${account.persona.language}`);
    }
    if (account.persona.formality) {
      parts.push(`Communication Style: ${account.persona.formality}`);
    }
  }

  // Additional context
  if (account.context.additionalContext) {
    parts.push(`\n## Additional Context`);
    parts.push(account.context.additionalContext);
  }

  return parts.join('\n');
}

/**
 * Predefined personas
 */
const PERSONAS = {
  hotel: {
    name: 'Oracle Hotel Assistant',
    personality: 'Helpful, professional, knowledgeable about hospitality',
    language: 'th',
    formality: 'professional',
  },
  personal: {
    name: 'Oracle',
    personality: 'Friendly, casual, helpful digital companion',
    language: 'th',
    formality: 'casual',
  },
  business: {
    name: 'Oracle Business',
    personality: 'Professional, efficient, data-focused',
    language: 'th',
    formality: 'formal',
  }
};

// =============================================================================
// LINE CLIENT FACTORY
// =============================================================================

/**
 * Create LINE client for account
 */
function createLineClient(account) {
  const token = account.channelToken;

  return {
    accountId: account.id,

    /**
     * Push message to user
     */
    async pushMessage(to, messages) {
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to,
          messages: Array.isArray(messages) ? messages : [messages]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LINE Push failed: ${error}`);
      }

      return response;
    },

    /**
     * Reply to message
     */
    async replyMessage(replyToken, messages) {
      const response = await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          replyToken,
          messages: Array.isArray(messages) ? messages : [messages]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LINE Reply failed: ${error}`);
      }

      return response;
    },

    /**
     * Get user profile
     */
    async getProfile(userId) {
      const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get profile');
      }

      return response.json();
    }
  };
}

// =============================================================================
// UTILITIES
// =============================================================================

function generateId() {
  return `acc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize from environment
 */
function initFromEnv() {
  // Default account from environment
  if (process.env.LINE_CHANNEL_TOKEN) {
    registerAccount({
      id: 'default',
      name: 'Default',
      channelToken: process.env.LINE_CHANNEL_TOKEN,
      channelSecret: process.env.LINE_CHANNEL_SECRET,
      persona: PERSONAS.personal,
    });
  }

  // Hotel account (if configured)
  if (process.env.LINE_HOTEL_TOKEN) {
    registerAccount({
      id: 'hotel',
      name: 'Hotel',
      channelToken: process.env.LINE_HOTEL_TOKEN,
      channelSecret: process.env.LINE_HOTEL_SECRET,
      persona: PERSONAS.hotel,
    });
  }

  // Business account (if configured)
  if (process.env.LINE_BUSINESS_TOKEN) {
    registerAccount({
      id: 'business',
      name: 'Business',
      channelToken: process.env.LINE_BUSINESS_TOKEN,
      channelSecret: process.env.LINE_BUSINESS_SECRET,
      persona: PERSONAS.business,
    });
  }

  console.log(`[LINE-MULTI] Initialized ${accounts.size} account(s)`);
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Account management
  registerAccount,
  getAccount,
  getAccountBySource,
  updateAccount,
  removeAccount,
  listAccounts,

  // Routing
  routeWebhook,
  isUserAllowed,

  // Persona
  getAccountSystemPrompt,
  PERSONAS,

  // Client
  createLineClient,

  // Init
  initFromEnv,

  // Config
  CONFIG
};

export default {
  registerAccount,
  getAccount,
  routeWebhook,
  createLineClient,
  initFromEnv
};
