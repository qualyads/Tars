/**
 * Session Manager - Session Management จาก OpenClaw Pattern
 *
 * Features:
 * - Session entry management
 * - Send policies (allow/deny)
 * - Model overrides per session
 * - Level overrides (verbose)
 * - Session labels
 *
 * @module session-manager
 */

import fs from 'fs';
import path from 'path';

// ============================================================
// Constants
// ============================================================

/**
 * Send policy decisions
 */
export const SEND_POLICY = {
  ALLOW: 'allow',
  DENY: 'deny',
};

/**
 * Verbose levels
 */
export const VERBOSE_LEVELS = {
  ON: 'on',
  OFF: 'off',
};

/**
 * Max label length
 */
export const MAX_LABEL_LENGTH = 64;

// ============================================================
// Session Entry Structure
// ============================================================

/**
 * @typedef {object} SessionEntry
 * @property {string} sessionKey - Session key
 * @property {string} [label] - Session label (max 64 chars)
 * @property {string} [sendPolicy] - Send policy override
 * @property {string} [providerOverride] - Provider override
 * @property {string} [modelOverride] - Model override
 * @property {string} [authProfileOverride] - Auth profile override
 * @property {string} [authProfileOverrideSource] - 'user' | 'auto'
 * @property {string} [verboseLevel] - Verbose level
 * @property {number} [createdAt] - Creation timestamp
 * @property {number} [updatedAt] - Last update timestamp
 */

// ============================================================
// Session Store
// ============================================================

/**
 * In-memory session store
 * @type {Map<string, SessionEntry>}
 */
const sessionStore = new Map();

/**
 * Session store file path
 */
let storeFilePath = null;

/**
 * Initialize session store
 * @param {string} filePath - Path to store file
 */
export function initSessionStore(filePath) {
  storeFilePath = filePath;

  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const [key, entry] of Object.entries(data)) {
        sessionStore.set(key, entry);
      }
      console.log(`[SESSION] Loaded ${sessionStore.size} sessions from ${filePath}`);
    } catch (err) {
      console.error('[SESSION] Failed to load session store:', err.message);
    }
  }
}

/**
 * Save session store to file
 */
export function saveSessionStore() {
  if (!storeFilePath) return;

  try {
    const data = Object.fromEntries(sessionStore);
    fs.writeFileSync(storeFilePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[SESSION] Failed to save session store:', err.message);
  }
}

/**
 * Get session entry
 * @param {string} sessionKey
 * @returns {SessionEntry|undefined}
 */
export function getSession(sessionKey) {
  return sessionStore.get(sessionKey);
}

/**
 * Set session entry
 * @param {string} sessionKey
 * @param {Partial<SessionEntry>} updates
 * @returns {SessionEntry}
 */
export function updateSession(sessionKey, updates) {
  const existing = sessionStore.get(sessionKey) || {
    sessionKey,
    createdAt: Date.now(),
  };

  const updated = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };

  sessionStore.set(sessionKey, updated);
  saveSessionStore();

  return updated;
}

/**
 * Delete session entry
 * @param {string} sessionKey
 * @returns {boolean}
 */
export function deleteSession(sessionKey) {
  const result = sessionStore.delete(sessionKey);
  if (result) {
    saveSessionStore();
  }
  return result;
}

/**
 * List all sessions
 * @returns {SessionEntry[]}
 */
export function listSessions() {
  return Array.from(sessionStore.values());
}

// ============================================================
// Send Policy
// ============================================================

/**
 * @typedef {object} SendPolicyRule
 * @property {object} match - Match conditions
 * @property {string} match.channel - Channel to match
 * @property {string} match.chatType - Chat type to match (dm, group, channel)
 * @property {string} match.keyPrefix - Session key prefix to match
 * @property {string} action - 'allow' | 'deny'
 */

/**
 * @typedef {object} SendPolicyConfig
 * @property {string} default - Default policy ('allow' | 'deny')
 * @property {SendPolicyRule[]} rules - Policy rules
 */

/**
 * Resolve send policy for a session
 * @param {string} sessionKey
 * @param {object} context
 * @param {string} context.channel
 * @param {string} context.chatType
 * @param {SendPolicyConfig} policyConfig
 * @returns {string} 'allow' | 'deny'
 */
export function resolveSendPolicy(sessionKey, context, policyConfig = {}) {
  // 1. Check session entry override
  const entry = sessionStore.get(sessionKey);
  if (entry?.sendPolicy) {
    return entry.sendPolicy;
  }

  // 2. Check policy rules
  const rules = policyConfig.rules || [];
  for (const rule of rules) {
    const match = rule.match || {};

    // Check channel match
    if (match.channel && match.channel !== context.channel) {
      continue;
    }

    // Check chat type match
    if (match.chatType && match.chatType !== context.chatType) {
      continue;
    }

    // Check key prefix match
    if (match.keyPrefix && !sessionKey.startsWith(match.keyPrefix)) {
      continue;
    }

    // All conditions matched
    return rule.action;
  }

  // 3. Default policy
  return policyConfig.default || SEND_POLICY.ALLOW;
}

/**
 * Set send policy for a session
 * @param {string} sessionKey
 * @param {string} policy - 'allow' | 'deny' | null (clear)
 */
export function setSessionSendPolicy(sessionKey, policy) {
  if (policy === null) {
    const entry = sessionStore.get(sessionKey);
    if (entry) {
      delete entry.sendPolicy;
      sessionStore.set(sessionKey, entry);
      saveSessionStore();
    }
    return;
  }

  updateSession(sessionKey, { sendPolicy: policy });
}

// ============================================================
// Model Override
// ============================================================

/**
 * Set model override for a session
 * @param {string} sessionKey
 * @param {object} selection
 * @param {string} selection.provider
 * @param {string} selection.model
 * @param {boolean} selection.isDefault - If true, clear override
 * @param {string} [authProfile]
 * @param {string} [source] - 'user' | 'auto'
 */
export function setModelOverride(sessionKey, selection, authProfile, source = 'user') {
  if (selection.isDefault) {
    // Clear override
    const entry = sessionStore.get(sessionKey);
    if (entry) {
      delete entry.providerOverride;
      delete entry.modelOverride;
      delete entry.authProfileOverride;
      delete entry.authProfileOverrideSource;
      sessionStore.set(sessionKey, { ...entry, updatedAt: Date.now() });
      saveSessionStore();
    }
    return;
  }

  updateSession(sessionKey, {
    providerOverride: selection.provider,
    modelOverride: selection.model,
    authProfileOverride: authProfile,
    authProfileOverrideSource: source,
  });
}

/**
 * Get model override for a session
 * @param {string} sessionKey
 * @returns {object|null}
 */
export function getModelOverride(sessionKey) {
  const entry = sessionStore.get(sessionKey);
  if (!entry?.modelOverride) {
    return null;
  }

  return {
    provider: entry.providerOverride,
    model: entry.modelOverride,
    authProfile: entry.authProfileOverride,
    source: entry.authProfileOverrideSource,
  };
}

// ============================================================
// Verbose Level
// ============================================================

/**
 * Set verbose level for a session
 * @param {string} sessionKey
 * @param {string} level - 'on' | 'off' | null (clear)
 */
export function setVerboseLevel(sessionKey, level) {
  if (level === null) {
    const entry = sessionStore.get(sessionKey);
    if (entry) {
      delete entry.verboseLevel;
      sessionStore.set(sessionKey, { ...entry, updatedAt: Date.now() });
      saveSessionStore();
    }
    return;
  }

  updateSession(sessionKey, { verboseLevel: level });
}

/**
 * Get verbose level for a session
 * @param {string} sessionKey
 * @returns {string|null}
 */
export function getVerboseLevel(sessionKey) {
  const entry = sessionStore.get(sessionKey);
  return entry?.verboseLevel || null;
}

// ============================================================
// Session Label
// ============================================================

/**
 * Validate session label
 * @param {string} label
 * @returns {boolean}
 */
export function validateLabel(label) {
  if (typeof label !== 'string') return false;
  if (label.trim().length === 0) return false;
  if (label.length > MAX_LABEL_LENGTH) return false;
  return true;
}

/**
 * Set session label
 * @param {string} sessionKey
 * @param {string} label
 * @returns {boolean} Success
 */
export function setSessionLabel(sessionKey, label) {
  if (!validateLabel(label)) {
    console.warn('[SESSION] Invalid label:', label);
    return false;
  }

  updateSession(sessionKey, { label: label.trim() });
  return true;
}

/**
 * Get session label
 * @param {string} sessionKey
 * @returns {string|null}
 */
export function getSessionLabel(sessionKey) {
  const entry = sessionStore.get(sessionKey);
  return entry?.label || null;
}

// ============================================================
// Transcript Events
// ============================================================

/**
 * Transcript update listeners
 * @type {Set<Function>}
 */
const transcriptListeners = new Set();

/**
 * Subscribe to transcript updates
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export function onSessionTranscriptUpdate(callback) {
  transcriptListeners.add(callback);
  return () => transcriptListeners.delete(callback);
}

/**
 * Emit transcript update event
 * @param {string} sessionFile
 */
export function emitSessionTranscriptUpdate(sessionFile) {
  for (const listener of transcriptListeners) {
    try {
      listener({ sessionFile });
    } catch (err) {
      console.error('[SESSION] Transcript listener error:', err.message);
    }
  }
}

// ============================================================
// Exports
// ============================================================

export default {
  // Constants
  SEND_POLICY,
  VERBOSE_LEVELS,
  MAX_LABEL_LENGTH,

  // Store
  initSessionStore,
  saveSessionStore,
  getSession,
  updateSession,
  deleteSession,
  listSessions,

  // Send policy
  resolveSendPolicy,
  setSessionSendPolicy,

  // Model override
  setModelOverride,
  getModelOverride,

  // Verbose level
  setVerboseLevel,
  getVerboseLevel,

  // Labels
  validateLabel,
  setSessionLabel,
  getSessionLabel,

  // Transcript events
  onSessionTranscriptUpdate,
  emitSessionTranscriptUpdate,
};
