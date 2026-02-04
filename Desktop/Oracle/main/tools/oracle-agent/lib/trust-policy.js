/**
 * Trust Policy Manager
 * 3-tier trust system: Owner / Customer / Public
 *
 * Based on OpenClaw's security model:
 * - Tool Policy (allow/deny)
 * - Trust Levels
 * - Auto-run capabilities
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../config.json');

/**
 * Trust Levels
 */
const TRUST_LEVELS = {
  OWNER: 'owner',
  CUSTOMER: 'customer',
  PUBLIC: 'public'
};

/**
 * Default permissions per trust level
 */
const DEFAULT_PERMISSIONS = {
  [TRUST_LEVELS.OWNER]: {
    level: TRUST_LEVELS.OWNER,
    description: 'Full access - no restrictions',
    canExecute: true,
    canModify: true,
    canApprove: true,
    canAccessSensitive: true,
    canSpawnAgents: true,
    canScheduleJobs: true,
    requireApproval: [],
    autoApprove: ['*']
  },
  [TRUST_LEVELS.CUSTOMER]: {
    level: TRUST_LEVELS.CUSTOMER,
    description: 'Limited access - hotel inquiries only',
    canExecute: false,
    canModify: false,
    canApprove: false,
    canAccessSensitive: false,
    canSpawnAgents: false,
    canScheduleJobs: false,
    requireApproval: ['booking', 'refund', 'special_request'],
    autoApprove: ['inquiry', 'availability_check', 'price_check']
  },
  [TRUST_LEVELS.PUBLIC]: {
    level: TRUST_LEVELS.PUBLIC,
    description: 'Read-only - basic info only',
    canExecute: false,
    canModify: false,
    canApprove: false,
    canAccessSensitive: false,
    canSpawnAgents: false,
    canScheduleJobs: false,
    requireApproval: ['*'],
    autoApprove: []
  }
};

/**
 * Action categories
 */
const ACTIONS = {
  // Informational (usually safe)
  INQUIRY: 'inquiry',
  AVAILABILITY_CHECK: 'availability_check',
  PRICE_CHECK: 'price_check',

  // Transactional (need approval for non-owners)
  BOOKING: 'booking',
  REFUND: 'refund',
  PAYMENT: 'payment',

  // Administrative (owner only)
  SETTINGS_CHANGE: 'settings_change',
  PROMOTION: 'promotion',
  PRICE_CHANGE: 'price_change',

  // System (owner only)
  EXECUTE_COMMAND: 'execute_command',
  SPAWN_AGENT: 'spawn_agent',
  SCHEDULE_JOB: 'schedule_job',
  ACCESS_SENSITIVE: 'access_sensitive'
};

class TrustPolicyManager {
  constructor() {
    this.ownerIds = this._loadOwnerIds();
    this.customerIds = new Set(); // Can be populated from DB
    this.customPolicies = new Map();
  }

  /**
   * Load owner IDs from config
   */
  _loadOwnerIds() {
    const owners = new Set();

    // LINE owner
    if (config.line?.owner_id) {
      owners.add(`line:${config.line.owner_id}`);
    }

    // Telegram owner
    if (config.telegram?.owner_id) {
      owners.add(`telegram:${config.telegram.owner_id}`);
    }

    // WhatsApp owner (future)
    if (config.whatsapp?.owner_id) {
      owners.add(`whatsapp:${config.whatsapp.owner_id}`);
    }

    return owners;
  }

  /**
   * Get trust level for a user
   * @param {string} channel - Channel type (line, telegram, etc.)
   * @param {string} userId - User ID
   * @returns {string} Trust level
   */
  getTrustLevel(channel, userId) {
    const fullId = `${channel}:${userId}`;

    if (this.ownerIds.has(fullId)) {
      return TRUST_LEVELS.OWNER;
    }

    if (this.customerIds.has(fullId)) {
      return TRUST_LEVELS.CUSTOMER;
    }

    // Default: treat as customer for DMs, public for groups
    return TRUST_LEVELS.CUSTOMER;
  }

  /**
   * Get permissions for a user
   * @param {string} channel - Channel type
   * @param {string} userId - User ID
   * @returns {object} Permissions object
   */
  getPermissions(channel, userId) {
    const trustLevel = this.getTrustLevel(channel, userId);
    const basePermissions = DEFAULT_PERMISSIONS[trustLevel];

    // Check for custom policy override
    const fullId = `${channel}:${userId}`;
    if (this.customPolicies.has(fullId)) {
      return { ...basePermissions, ...this.customPolicies.get(fullId) };
    }

    return basePermissions;
  }

  /**
   * Check if user can perform an action
   * @param {string} channel - Channel type
   * @param {string} userId - User ID
   * @param {string} action - Action to perform
   * @returns {object} { allowed: boolean, requiresApproval: boolean, reason: string }
   */
  canPerform(channel, userId, action) {
    const permissions = this.getPermissions(channel, userId);

    // Owner can do everything
    if (permissions.level === TRUST_LEVELS.OWNER) {
      return { allowed: true, requiresApproval: false, reason: 'Owner has full access' };
    }

    // Check specific capabilities
    switch (action) {
      case ACTIONS.EXECUTE_COMMAND:
        if (!permissions.canExecute) {
          return { allowed: false, requiresApproval: false, reason: 'Not allowed to execute commands' };
        }
        break;

      case ACTIONS.SPAWN_AGENT:
        if (!permissions.canSpawnAgents) {
          return { allowed: false, requiresApproval: false, reason: 'Not allowed to spawn agents' };
        }
        break;

      case ACTIONS.SCHEDULE_JOB:
        if (!permissions.canScheduleJobs) {
          return { allowed: false, requiresApproval: false, reason: 'Not allowed to schedule jobs' };
        }
        break;

      case ACTIONS.ACCESS_SENSITIVE:
        if (!permissions.canAccessSensitive) {
          return { allowed: false, requiresApproval: false, reason: 'Not allowed to access sensitive data' };
        }
        break;
    }

    // Check if action is auto-approved
    if (permissions.autoApprove.includes('*') || permissions.autoApprove.includes(action)) {
      return { allowed: true, requiresApproval: false, reason: 'Auto-approved action' };
    }

    // Check if action requires approval
    if (permissions.requireApproval.includes('*') || permissions.requireApproval.includes(action)) {
      return { allowed: true, requiresApproval: true, reason: 'Requires owner approval' };
    }

    // Default: allow but may require approval
    return { allowed: true, requiresApproval: false, reason: 'Allowed by default' };
  }

  /**
   * Check if user is owner
   * @param {string} channel - Channel type
   * @param {string} userId - User ID
   * @returns {boolean}
   */
  isOwner(channel, userId) {
    return this.getTrustLevel(channel, userId) === TRUST_LEVELS.OWNER;
  }

  /**
   * Add a custom policy for a user
   * @param {string} channel - Channel type
   * @param {string} userId - User ID
   * @param {object} policy - Custom policy overrides
   */
  setCustomPolicy(channel, userId, policy) {
    const fullId = `${channel}:${userId}`;
    this.customPolicies.set(fullId, policy);
  }

  /**
   * Add user to customer list
   * @param {string} channel - Channel type
   * @param {string} userId - User ID
   */
  addCustomer(channel, userId) {
    this.customerIds.add(`${channel}:${userId}`);
  }

  /**
   * Get policy summary for a user
   * @param {string} channel - Channel type
   * @param {string} userId - User ID
   * @returns {object} Policy summary
   */
  getSummary(channel, userId) {
    const trustLevel = this.getTrustLevel(channel, userId);
    const permissions = this.getPermissions(channel, userId);

    return {
      userId: `${channel}:${userId}`,
      trustLevel,
      description: permissions.description,
      capabilities: {
        execute: permissions.canExecute,
        modify: permissions.canModify,
        approve: permissions.canApprove,
        sensitive: permissions.canAccessSensitive,
        spawnAgents: permissions.canSpawnAgents,
        scheduleJobs: permissions.canScheduleJobs
      },
      autoApprove: permissions.autoApprove,
      requireApproval: permissions.requireApproval
    };
  }

  /**
   * Get all trust levels info
   */
  static getTrustLevelsInfo() {
    return Object.entries(DEFAULT_PERMISSIONS).map(([level, perms]) => ({
      level,
      description: perms.description,
      capabilities: {
        execute: perms.canExecute,
        modify: perms.canModify,
        approve: perms.canApprove,
        sensitive: perms.canAccessSensitive,
        spawnAgents: perms.canSpawnAgents,
        scheduleJobs: perms.canScheduleJobs
      }
    }));
  }
}

// Singleton instance
const trustPolicy = new TrustPolicyManager();

export default trustPolicy;
export { TrustPolicyManager, TRUST_LEVELS, ACTIONS, DEFAULT_PERMISSIONS };
