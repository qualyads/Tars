/**
 * Tool Policy Manager
 * Control what tools/actions are allowed without asking
 *
 * Based on OpenClaw's approach:
 * - Allow/Deny lists (set once, use forever)
 * - Safe Bins (always-allowed commands)
 * - Policy over Prompts
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../config.json');

/**
 * Safe Bins - commands that are always safe (stdin only, no side effects)
 */
const SAFE_BINS = [
  'jq', 'grep', 'cut', 'sort', 'uniq', 'head', 'tail', 'tr', 'wc',
  'cat', 'echo', 'date', 'whoami', 'pwd', 'ls'
];

/**
 * Tool Groups - shortcuts for common tool sets
 */
const TOOL_GROUPS = {
  'group:runtime': ['exec', 'bash', 'process'],
  'group:fs': ['read', 'write', 'edit'],
  'group:sessions': ['sessions_list', 'sessions_spawn', 'sessions_send'],
  'group:memory': ['memory_search', 'memory_get', 'memory_write'],
  'group:automation': ['cron', 'heartbeat', 'schedule'],
  'group:network': ['fetch', 'webhook', 'api_call'],
  'group:all': ['*']
};

/**
 * Default tool policies per trust level
 */
const DEFAULT_POLICIES = {
  owner: {
    allow: ['*'],
    deny: [],
    execSecurity: 'full',  // full | allowlist | deny
    askMode: 'off'         // off | on-miss | always
  },
  customer: {
    allow: ['read', 'memory_search'],
    deny: ['exec', 'write', 'edit', 'cron', 'sessions_spawn'],
    execSecurity: 'deny',
    askMode: 'always'
  },
  public: {
    allow: ['read'],
    deny: ['*'],
    execSecurity: 'deny',
    askMode: 'always'
  }
};

class ToolPolicyManager {
  constructor() {
    this.policies = new Map();
    this.execAllowlist = new Set();
    this.safeBins = new Set(SAFE_BINS);

    // Load config-based allowlist
    this._loadConfigAllowlist();
  }

  /**
   * Load exec allowlist from config
   */
  _loadConfigAllowlist() {
    const allowlist = config.toolPolicy?.execAllowlist || [];
    allowlist.forEach(pattern => this.execAllowlist.add(pattern));

    // Add common safe patterns
    const defaultPatterns = [
      'git *',
      'npm *',
      'node *',
      'python *',
      'curl *',
      'ls *',
      'cat *',
      'grep *'
    ];
    defaultPatterns.forEach(p => this.execAllowlist.add(p));
  }

  /**
   * Expand tool groups to actual tools
   * @param {string[]} tools - Array of tools (may include groups)
   * @returns {string[]} Expanded array
   */
  _expandGroups(tools) {
    const expanded = new Set();

    for (const tool of tools) {
      if (tool.startsWith('group:') && TOOL_GROUPS[tool]) {
        TOOL_GROUPS[tool].forEach(t => expanded.add(t));
      } else {
        expanded.add(tool);
      }
    }

    return Array.from(expanded);
  }

  /**
   * Get policy for a trust level
   * @param {string} trustLevel - Trust level (owner, customer, public)
   * @returns {object} Policy
   */
  getPolicy(trustLevel) {
    // Check custom policy first
    if (this.policies.has(trustLevel)) {
      return this.policies.get(trustLevel);
    }

    // Return default
    return DEFAULT_POLICIES[trustLevel] || DEFAULT_POLICIES.public;
  }

  /**
   * Check if a tool is allowed
   * @param {string} trustLevel - Trust level
   * @param {string} tool - Tool name
   * @returns {object} { allowed: boolean, reason: string }
   */
  isToolAllowed(trustLevel, tool) {
    const policy = this.getPolicy(trustLevel);

    // Expand groups
    const allowList = this._expandGroups(policy.allow);
    const denyList = this._expandGroups(policy.deny);

    // Deny always wins
    if (denyList.includes('*') || denyList.includes(tool)) {
      return { allowed: false, reason: `Tool "${tool}" is denied` };
    }

    // Check allow
    if (allowList.includes('*') || allowList.includes(tool)) {
      return { allowed: true, reason: 'Tool is allowed by policy' };
    }

    // Default: deny
    return { allowed: false, reason: `Tool "${tool}" is not in allow list` };
  }

  /**
   * Check if a command can be executed
   * @param {string} trustLevel - Trust level
   * @param {string} command - Command to execute
   * @returns {object} { allowed: boolean, requiresApproval: boolean, reason: string }
   */
  canExecute(trustLevel, command) {
    const policy = this.getPolicy(trustLevel);

    // Check exec security level
    if (policy.execSecurity === 'deny') {
      return {
        allowed: false,
        requiresApproval: false,
        reason: 'Command execution is denied'
      };
    }

    // Extract binary from command
    const binary = command.trim().split(/\s+/)[0];

    // Check if it's a safe bin
    if (this.safeBins.has(binary)) {
      return {
        allowed: true,
        requiresApproval: false,
        reason: `"${binary}" is a safe bin`
      };
    }

    // Full security = allow everything
    if (policy.execSecurity === 'full') {
      return {
        allowed: true,
        requiresApproval: false,
        reason: 'Full exec access'
      };
    }

    // Allowlist security = check allowlist
    if (policy.execSecurity === 'allowlist') {
      const isAllowed = this._matchesAllowlist(command);

      if (isAllowed) {
        return {
          allowed: true,
          requiresApproval: false,
          reason: 'Command matches allowlist'
        };
      }

      // Check ask mode
      if (policy.askMode === 'off') {
        return {
          allowed: false,
          requiresApproval: false,
          reason: 'Command not in allowlist'
        };
      }

      if (policy.askMode === 'on-miss') {
        return {
          allowed: true,
          requiresApproval: true,
          reason: 'Command not in allowlist - requires approval'
        };
      }
    }

    // Default based on ask mode
    if (policy.askMode === 'always') {
      return {
        allowed: true,
        requiresApproval: true,
        reason: 'Approval required by policy'
      };
    }

    return {
      allowed: false,
      requiresApproval: false,
      reason: 'Not allowed by policy'
    };
  }

  /**
   * Check if command matches allowlist
   * @param {string} command - Command to check
   * @returns {boolean}
   */
  _matchesAllowlist(command) {
    for (const pattern of this.execAllowlist) {
      if (this._matchPattern(command, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Simple pattern matching (supports * wildcard)
   * @param {string} str - String to match
   * @param {string} pattern - Pattern with optional *
   * @returns {boolean}
   */
  _matchPattern(str, pattern) {
    // Convert glob pattern to regex
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(str);
  }

  /**
   * Add command to allowlist
   * @param {string} pattern - Command pattern
   */
  addToAllowlist(pattern) {
    this.execAllowlist.add(pattern);
  }

  /**
   * Remove command from allowlist
   * @param {string} pattern - Command pattern
   */
  removeFromAllowlist(pattern) {
    this.execAllowlist.delete(pattern);
  }

  /**
   * Set custom policy for a trust level
   * @param {string} trustLevel - Trust level
   * @param {object} policy - Policy object
   */
  setPolicy(trustLevel, policy) {
    this.policies.set(trustLevel, { ...DEFAULT_POLICIES[trustLevel], ...policy });
  }

  /**
   * Get status summary
   */
  getStatus() {
    return {
      safeBins: Array.from(this.safeBins),
      execAllowlist: Array.from(this.execAllowlist),
      toolGroups: Object.keys(TOOL_GROUPS),
      policies: {
        owner: this.getPolicy('owner'),
        customer: this.getPolicy('customer'),
        public: this.getPolicy('public')
      }
    };
  }
}

// Singleton instance
const toolPolicy = new ToolPolicyManager();

export default toolPolicy;
export { ToolPolicyManager, SAFE_BINS, TOOL_GROUPS, DEFAULT_POLICIES };
